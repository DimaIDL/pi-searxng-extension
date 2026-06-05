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

// Load .env file (graceful fallback if dotenv not installed)
let dotenvConfig = null;
try { const d = require("dotenv"); dotenvConfig = d.config({ path: path.join(__dirname, ".env") }); } catch (e) { /* dotenv not available */ }

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
const SEARXNG_URL = process.env.SEARXNG_URL || dotenvConfig?.parsed?.SEARXNG_URL || "<SEARXNG_URL>";

// ===== Configuration =====

/**
 * Приоритет: 1. OS env (set/$env) → 2. .env file → 3. Default.
 * По умолчанию true — сырые данные (.html и .md) сохраняются в .pi/fetch-raw/.
 */
const SAVE_RAW_DATA = process.env.SAVE_RAW_DATA !== undefined
  ? process.env.SAVE_RAW_DATA === "true"
  : dotenvConfig?.parsed?.SAVE_RAW_DATA !== undefined
    ? dotenvConfig.parsed.SAVE_RAW_DATA === "true"
    : true;

// Raw fetch storage directory
const RAW_FETCH_DIR = path.join(".pi", "fetch-raw");

/**
 * Creates the raw fetch directory if it doesn't exist.
 */
function ensureRawFetchDir(): void {
  try { fs.mkdirSync(RAW_FETCH_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

/**
 * Generates a base filename for raw fetch storage.
 * Format: <domain>_<hash 10 chars>_<YYYYMMDD_HHMMSS>
 */
function generateRawBaseFilename(url: string): string {
  const parsed = new URL(url);
  const domain = parsed.hostname.replace(/\./g, "_");
  const hash = crypto.createHash("md5").update(url).digest("hex").substring(0, 10);
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
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
 * Сохраняет результаты поиска SearXNG в JSON файл.
 * Используется только если SAVE_RAW_DATA = true.
 */
function saveSearchResults(query: string, data: SearxngSearchData): void {
  if (!SAVE_RAW_DATA) return;
  ensureRawFetchDir();
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
  const safeQuery = query.replace(/[\s\/\*]/g, "_").substring(0, 50);
  const filename = `${safeQuery}_${dateStr}.json`;
  const filepath = path.join(RAW_FETCH_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Fetches SearXNG API and returns parsed JSON.
 */
async function httpGet(url: string): Promise<SearxngSearchData> {
  const res = await undiciFetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { throw new Error("JSON parse failed: " + e); }
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
 *   details      — resultsCount: количество найденных результатов
 *
 * Особенности:
 *   Если SAVE_RAW_DATA = true, результаты сохраняются в .pi/fetch-raw/
 *   как JSON файл с именем <запрос>_<дата>.json.
 */
export default function(pi: ExtensionAPI) {
  pi.registerTool({
    name: "searxng_search",
    label: "SearXNG Search",
    description: "Search the web using SearXNG metasearch engine.",
    parameters: Type.Object({
      query: Type.String({ description: "The search query" }),
      language: Type.Optional(Type.String({ description: "Language code (e.g., en, ru). Default: all." })),
      safesearch: Type.Optional(Type.Number({ description: "0=off, 1=moderate, 2=strict. Default: 0" })),
      time_range: Type.Optional(StringEnum(["day", "month", "year"] as const, { description: "Time range filter" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }] };
      const url = new URL(SEARXNG_URL + "/search");
      url.searchParams.set("q", params.query);
      url.searchParams.set("format", "json");
      if (params.language) url.searchParams.set("language", params.language);
      if (params.safesearch !== undefined) url.searchParams.set("safesearch", String(params.safesearch));
      if (params.time_range) url.searchParams.set("time_range", params.time_range);
      onUpdate?.({ content: [{ type: "text", text: "Searching SearXNG..." }] });
      try {
        const data = await httpGet(url.toString());
        // Сохраняем результаты поиска если включено
        saveSearchResults(params.query, data);
        return { content: [{ type: "text", text: formatResults(data) }], details: { resultsCount: data.results?.length || 0 }};
      } catch (error) {
        throw new Error("SearXNG search failed: " + (error instanceof Error ? error.message : String(error)));
      }
    },
  });

// ===== SearXNG Fetch Tool =====
/**
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

// ===== SearXNG Fetch Raw Tool =====
/**
 * Инструмент для чтения веб-страниц с сохранением сырых данных.
 *
 * Назначение:
 *   Выполняет те же действия, что и searxng_fetch (загрузка страницы,
 *   извлечение контента через Defuddle + JSON-LD, конвертация в Markdown),
 *   НО дополнительно сохраняет:
 *   - Сырой HTML → .pi/fetch-raw/<имя>.html
 *   - Конвертированный Markdown → .pi/fetch-raw/<имя>.md
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
    name: "searxng_fetch_raw",
    label: "SearXNG Fetch Raw",
    description: SAVE_RAW_DATA
      ? "Fetch, convert to Markdown (Defuddle + JSON-LD), AND save raw HTML and Markdown. Same as searxng_fetch but saves the original HTML and converted Markdown to .pi/fetch-raw/. Do NOT read saved files without special permission."
      : "Fetch and convert to Markdown (Defuddle + JSON-LD). Saves raw HTML and Markdown to .pi/fetch-raw/.",

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

        // Save raw HTML and Markdown only if SAVE_RAW_DATA is true
        let savedPaths: RawFilePaths | undefined;
        if (SAVE_RAW_DATA) {
          savedPaths = saveRawHtmlAndMarkdown(params.url, html, markdown);
        }

        const details: { url: string; length: number; method: string; title: string } & (typeof SAVE_RAW_DATA extends true ? { savedPaths: RawFilePaths } : {}) = {
          url: params.url,
          length: markdown.length,
          method: article.method,
          title: article.title,
        };
        if (SAVE_RAW_DATA) {
          details.savedPaths = savedPaths!;
        }

        return { content: [{ type: "text", text: markdown }], details };
      } catch (error) {
        throw new Error("Failed to fetch URL: " + (error instanceof Error ? error.message : String(error)));
      }
    },
  });

  pi.on("session_start", async () => { console.log("[searxng-tools] Loaded, SEARXNG_URL=" + SEARXNG_URL); });
}