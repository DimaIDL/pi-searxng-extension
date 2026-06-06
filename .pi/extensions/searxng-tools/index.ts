import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { fetch as undiciFetch, request as undiciRequest } from "undici";
import { URL } from "node:url";
import { parseHTML } from "linkedom";
import { Defuddle } from "defuddle/node";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
// ===== .env reader — reads file on every call via fs (no dotenv/process.env caching) =====
function readEnvFile(): Record<string, string | undefined> {
  const envPath = path.join(__dirname, ".env");
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    const vars: Record<string, string | undefined> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      vars[trimmed.substring(0, eqIndex).trim()] = trimmed.substring(eqIndex + 1).trim();
    }
    return vars;
  } catch (e) {
    throw new Error("Failed to read .env file at " + envPath + ": " + (e instanceof Error ? e.message : String(e)));
  }
}

// ===== Type Definitions =====

interface ArticleResult {
  content: string;
  title: string;
  author: string;
  description: string;
  published: string;
  image: string;
}

interface DefuddleArticle extends ArticleResult {
  wordCount?: number;
  method: "defuddle";
}

interface JsonLdArticle extends ArticleResult {
  method: "json-ld";
}

type ExtractedArticle = DefuddleArticle | JsonLdArticle;

interface SearxngSearchData {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
}

interface RawFilePaths {
  htmlPath: string;
  mdPath: string;
}

// Priority: 1. OS env (set/$env) → 2. .env file → 3. Default placeholder
function getSearexngUrl(): string {
  return process.env.SEARXNG_URL || readEnvFile().SEARXNG_URL || "<SEARXNG_URL>";
}

// ===== Configuration =============

/**
 * Приоритет: 1. OS env (set/$env) → 2. .env file → 3. Default.
 * По умолчанию true — сырые данные (.html и .md) сохраняются в .pi/fetch-raw/.
 * Динамически читает .env при каждом вызове для реагирования на изменения настроек.
 */
function isSaveRawData(): boolean {
  return process.env.SAVE_RAW_DATA !== undefined
    ? process.env.SAVE_RAW_DATA === "true"
    : readEnvFile().SAVE_RAW_DATA !== undefined
      ? readEnvFile().SAVE_RAW_DATA === "true"
      : true;
}

// Raw fetch storage directory
const RAW_FETCH_DIR = path.join(".pi", "fetch-raw");

/**
 * Creates the raw fetch directory if it doesn't exist.
 */
function ensureRawFetchDir(): void {
  try { fs.mkdirSync(RAW_FETCH_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

/**
 * Generates a short hash from any string.
 * Returns first 10 hex chars of MD5 digest.
 */
function generateUrlHash(input: string): string {
  return crypto.createHash("md5").update(input).digest("hex").substring(0, 10);
}

/**
 * Generates a base filename for raw fetch storage.
 * Format: <domain>_<hash 10 chars>_<YYYYMMDD_HHMMSS>
 */
function generateRawBaseFilename(url: string): string {
  const parsed = new URL(url);
  const domain = parsed.hostname.replace(/\./g, "_");
  const hash = generateUrlHash(url);
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `${domain}_${hash}_${dateStr}`;
}

/**
 * Сохраняет сырой HTML и Markdown файлы с одинаковым базовым именем.
 * Генерирует имя ОДИН раз, затем добавляет оба расширения.
 */
function saveRawHtmlAndMarkdown(url: string, html: string, markdown: string): RawFilePaths {
  ensureRawFetchDir();
  const baseFilename = generateRawBaseFilename(url);
  const htmlPath = path.join(RAW_FETCH_DIR, `${baseFilename}.html`);
  const mdPath = path.join(RAW_FETCH_DIR, `${baseFilename}.md`);
  fs.writeFileSync(htmlPath, html, "utf-8");
  fs.writeFileSync(mdPath, markdown, "utf-8");
  return { htmlPath, mdPath };
}

/**
 * Сохраняет результаты поиска SearXNG в структурированный JSON файл.
 * Используется только если isSaveRawData() = true.
 * Возвращает путь к файлу или undefined.
 */
function saveSearchResults(query: string, data: SearxngSearchData): string | undefined {
  if (!isSaveRawData()) return;
  ensureRawFetchDir();
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const safeQuery = query.replace(/[\s\/\*]/g, "_").substring(0, 15);
  const hash = generateUrlHash(query);
  const filename = `search_${safeQuery}_${hash}_${dateStr}.json`;
  const filepath = path.join(RAW_FETCH_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify({ query, data }, null, 2), "utf-8");
  return filepath;
}

/**
 * Fetches SearXNG API and returns parsed JSON.
 */
async function httpGet(url: string): Promise<SearxngSearchData> {
  const res = await undiciFetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { throw new Error("JSON parse failed: " + e); }
}

/**
 * Formats SearXNG search results into a readable string.
 */
function formatResults(data: SearxngSearchData): string {
  if (!data.results || data.results.length === 0) return "No results found.";
  const formatted = data.results.map((r, i) => {
    const title = r.title || "(no title)";
    const url = r.url || "(no url)";
    const content = (r.content || "").substring(0, 500);
    const score = r.score ? " | Relevance: " + r.score.toFixed(3) : "";
    return `${i + 1}. **${title}**\n   URL: ${url}\n   Snippet: ${content}${score}`;
  });
  return formatted.join("\n\n");
}

/**
 * Extract article content from HTML using Defuddle (DOM analysis + CSS selectors).
 * Returns cleaned Markdown with metadata.
 */
async function extractArticle(html: string, url: string): Promise<DefuddleArticle> {
  try {
    const { document } = parseHTML(html);
    const result = await Defuddle(document, url, { markdown: true });
    return {
      content: result.content || "",
      title: result.title || "",
      author: result.author || "",
      description: result.description || "",
      published: result.published || "",
      image: result.image || "",
      wordCount: result.wordCount || 0,
      method: "defuddle",
    };
  } catch (e) {
    throw new Error("Defuddle extraction failed: " + e);
  }
}

/**
 * Fallback: extract article content from JSON-LD metadata.
 * Used when Defuddle cannot find main content.
 */
function extractJsonLd(html: string): JsonLdArticle | null {
  try {
    const matches = html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    for (const match of matches) {
      try {
        const data = JSON.parse(match[1]);
        // Check if it's a NewsArticle or Article
        const isArticle = Array.isArray(data["@type"])
          ? data["@type"].includes("NewsArticle") || data["@type"].includes("Article")
          : data["@type"] === "NewsArticle" || data["@type"] === "Article";
        if (isArticle) {
          return {
            content: data.description || data.abstract || "",
            title: data.name || data.headline || "",
            author: typeof data.author === "string" ? data.author : JSON.stringify(data.author),
            published: data.datePublished || "",
            image: data.image || "",
            method: "json-ld",
          };
        }
      } catch (e) { /* skip invalid JSON */ }
    }
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * Multi-level content extraction:
 * Level 1: Defuddle (DOM analysis + CSS selectors)
 * Level 2: JSON-LD fallback
 */
async function extractArticleMultiLevel(html: string, url: string): Promise<ExtractedArticle> {
  // Level 1: Try Defuddle first
  try {
    const result = await extractArticle(html, url);
    if (result.content && result.content.length > 50) {
      return { ...result, method: "defuddle" };
    }
  } catch (e) { /* fall through to fallback */ }

  // Level 2: Try JSON-LD fallback
  const jsonLd = extractJsonLd(html);
  if (jsonLd && jsonLd.content) {
    return { ...jsonLd, method: "json-ld" };
  }

  throw new Error("Content extraction failed at all levels");
}

/**
 * Fetches a URL and returns raw text content.
 */
async function httpGetText(url: string): Promise<string> {
  const res = await undiciFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache'
    }
  });
  return res.text();
}

export default function (pi: ExtensionAPI) {

  // ===== SearXNG Search Tool =====
  /**
   * Инструмент для поиска через метапоисковик SearXNG.
   *
   * Назначение:
   *   Выполняет поисковый запрос к локальному экземпляру SearXNG и возвращает
   *   агрегированные результаты из 249+ поисковых сервисов (Google, Bing,
   *   DuckDuckGo, Wikipedia и др.).
   *
   * Параметры:
   *   query        — строка поиска (обязательно)
   *   language     — код языка (например "ru", "en"), по умолчанию все языки
   *   safesearch   — 0 = выключен, 1 = умеренный, 2 = строгий
   *   time_range   — фильтр по времени: "day", "month", "year"
   *
   * Возвращает:
   *   content      — отформатированный список результатов (нумерация, заголовок,
   *                  URL, сниппет, score релевантности)
   *   details      — resultsCount: количество найденных результатов, savedPaths: { jsonPath }
   *
   * Особенности:
   *   Если SAVE_RAW_DATA = true, результаты сохраняются в .pi/fetch-raw/
   *   как JSON файл с именем search_<запрос>_<хэш>_<дата>.json.
   */
  pi.registerTool({
    name: "searxng_search",
    label: "SearXNG Search",
    description: isSaveRawData()
      ? "Search the web using SearXNG metasearch engine, AND save results to .pi/fetch-raw/. Do NOT read saved files without special permission."
      : "Search the web using SearXNG metasearch engine.",
    parameters: Type.Object({
      query: Type.String({ description: "The search query" }),
      language: Type.Optional(Type.String({ description: "Language code (e.g., en, ru). Default: all." })),
      safesearch: Type.Optional(Type.Number({ description: "0=off, 1=moderate, 2=strict. Default: 0" })),
      time_range: Type.Optional(StringEnum(["day", "month", "year"] as const, { description: "Time range filter" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }] };
      const url = new URL(getSearexngUrl() + "/search");
      url.searchParams.set("q", params.query);
      url.searchParams.set("format", "json");
      if (params.language) url.searchParams.set("language", params.language);
      if (params.safesearch !== undefined) url.searchParams.set("safesearch", String(params.safesearch));
      if (params.time_range) url.searchParams.set("time_range", params.time_range);
      onUpdate?.({ content: [{ type: "text", text: "Searching SearXNG..." }] });
      try {
        const data = await httpGet(url.toString());
        // Сохраняем результаты поиска если включено
        const jsonPath = saveSearchResults(params.query, data);
        let text = formatResults(data);
        if (jsonPath) {
          text += "\n\n[Results saved to .pi/fetch-raw/" + path.basename(jsonPath) + "]";
        }
        return { content: [{ type: "text", text }] };
      } catch (error) {
        throw new Error("SearXNG search failed: " + (error instanceof Error ? error.message : String(error)));
      }
    },
  });

  // ===== SearXNG Fetch Tool — DO NOT REMOVE until ~2026.09.05 =====
  /**
   * ⚠️ НЕ УДАЛЯТЬ! Закомментировано временно до ~2026.09.05.
   *
   * Инструмент для чтения веб-страниц с конвертацией HTML → Markdown.
   *
   * Назначение:
   *   Загружает страницу по URL, извлекает основной контент статьи и
   *   конвертирует его в чистый Markdown. Использует многоуровневый подход:
   *   1. Defuddle (DOM analysis + CSS selectors) — удаляет sidebar, footer, ads
   *   2. JSON-LD fallback — парсит <script type="application/ld+json">
   *
   * Параметры:
   *   url          — URL страницы для загрузки (обязательно)
   *   max_length   — максимальная длина результата в символах (по умолчанию 10000)
   *
   * Возвращает:
   *   content      — чистый Markdown с текстом статьи
   *   details      — url, length, method ("defuddle" или "json-ld"), title
   *
   * Особенности:
   *   - Автоматически удаляет рекламу, меню, футер по CSS-классам
   *   - Возвращает metadata: заголовок, автор, описание, дата публикации
   *   - Если Defuddle не справляется — используется JSON-LD fallback
   */
  /*
    pi.registerTool({
      name: "searxng_fetch",
      label: "SearXNG Fetch",
      description:
        "Fetch and read web page content. Uses Defuddle (DOM analysis) + JSON-LD fallback to extract clean article Markdown.",
      parameters: Type.Object({
        url: Type.String({ description: "The URL to fetch" }),
        max_length: Type.Optional(Type.Number({ description: "Max characters (default: 10000)" })),
      }),
      async execute(toolCallId, params, signal, onUpdate, ctx) {
        if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }] };
        onUpdate?.({ content: [{ type: "text", text: "Fetching " + params.url + "..." }] });
        try {
          const html = await httpGetText(params.url);
          const article = await extractArticleMultiLevel(html, params.url);
          let markdown = article.content;
          const maxLength = params.max_length || 10000;
          if (markdown.length > maxLength) markdown = markdown.substring(0, maxLength) + "\n\n[Content truncated]";
          return {
            content: [{ type: "text", text: markdown }],
            details: { url: params.url, length: markdown.length, method: article.method, title: article.title },
          };
        } catch (error) {
          throw new Error("Failed to fetch URL: " + (error instanceof Error ? error.message : String(error)));
        }
      },
    });
  */

  // ===== Web Fetch Tool =====
  /**
   * Инструмент для чтения веб-страниц с конвертацией HTML → Markdown
   * и сохранением сырых данных (.html + .md) в .pi/fetch-raw/.
   *
   * Назначение:
   *   Загружает страницу по URL, извлекает основной контент через Defuddle
   *   (DOM analysis) или JSON-LD fallback, конвертирует в Markdown,
   *   и дополнительно сохраняет сырой HTML + готовый Markdown.
   *
   * Параметры:
   *   url          — URL страницы для загрузки (обязательно)
   *   max_length   — максимальная длина результата в символах (по умолчанию 10000)
   *
   * Возвращает:
   *   content      — чистый Markdown с текстом статьи
   *   details      — url, length, method, title, savedPaths: { htmlPath, mdPath }
   *
   * Особенности:
   *   - Сохраняет оба файла (.html и .md) с одинаковым базовым именем
   *   - Имя файла: <домен>_<хэш 10 символов>_<YYYYMMDD_HHMMSS>.<расширение>
   *   - ⚠️ НЕ читать сохранённые файлы без особого разрешения!
   *
   * Зависит от SAVE_RAW_DATA:
   *   Если SAVE_RAW_DATA = true, сохраняет сырые данные и возвращает savedPaths.
   *   Если false — не сохраняет файлы и не возвращает savedPaths.
   */
  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description: isSaveRawData()
      ? "Fetch, convert to Markdown (Defuddle + JSON-LD), AND save raw HTML and Markdown to .pi/fetch-raw/. Do NOT read saved files without special permission."
      : "Fetch and read web page content. Uses Defuddle (DOM analysis) + JSON-LD fallback to extract clean article Markdown.",
    promptSnippet: "то что находится в теге <IT_IS_NOT_FETCH_DATA> - это метаданные, они не ясляются контентом, это вспомогательная информация для LLM",
    parameters: Type.Object({
      url: Type.String({ description: "The URL to fetch" }),
      max_length: Type.Optional(Type.Number({ description: "Max characters (default: 10000)" })),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }] };
      onUpdate?.({ content: [{ type: "text", text: "Fetching " + params.url + "..." }] });

      try {
        const html = await httpGetText(params.url);
        const article = await extractArticleMultiLevel(html, params.url);
        let markdown = article.content;
        const maxLength = params.max_length || 10000;
        if (markdown.length > maxLength) markdown = markdown.substring(0, maxLength) + "\n\n[Content truncated]";

        // Save raw HTML and Markdown only if isSaveRawData() is true
        let savedPaths: RawFilePaths | undefined;
        if (isSaveRawData()) {
          savedPaths = saveRawHtmlAndMarkdown(params.url, html, markdown);
        }

        const details: { url: string; length: number; method: string; title: string; savedPaths?: RawFilePaths } = {
          url: params.url,
          length: markdown.length,
          method: article.method,
          title: article.title,
        };
        if (isSaveRawData()) {
          details.savedPaths = savedPaths!;
        }

        const metadataJson = `<IT_IS_NOT_FETCH_DATA>${JSON.stringify({ metadata: details })}</IT_IS_NOT_FETCH_DATA>`;
        return { content: [{ type: "text", text: markdown+metadataJson }], details };
      } catch (error) {
        throw new Error("Failed to fetch URL: " + (error instanceof Error ? error.message : String(error)));
      }
    },
  });

  pi.on("session_start", async () => { console.log("[searxng-tools] Loaded, SEARXNG_URL=" + getSearexngUrl()); });
}