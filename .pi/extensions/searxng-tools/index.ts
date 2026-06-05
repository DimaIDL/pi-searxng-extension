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

const SEARXNG_URL = process.env.SEARXNG_URL || "http://ub2026-mini:9098";

// Raw fetch storage directory
const RAW_FETCH_DIR = path.join(".pi", "fetch-raw");

/**
 * Creates the raw fetch directory if it doesn't exist.
 */
function ensureRawFetchDir() {
  try { fs.mkdirSync(RAW_FETCH_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

/**
 * Generates a base filename for raw fetch storage.
 * Format: <domain>_<hash 10 chars>_<YYYYMMDD_HHMMSS>
 */
function generateRawBaseFilename(url) {
  const parsed = new URL(url);
  const domain = parsed.hostname.replace(/\./g, "_");
  const hash = crypto.createHash("md5").update(url).digest("hex").substring(0, 10);
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
  return `${domain}_${hash}_${dateStr}`;
}

/**
 * Saves content to a file in the raw fetch directory.
 * @param url - The URL (used for filename generation)
 * @param content - Content to save
 * @param extension - File extension (e.g., '.html' or '.md')
 */
function saveRawFile(url, content, extension) {
  ensureRawFetchDir();
  const baseFilename = generateRawBaseFilename(url);
  const filepath = path.join(RAW_FETCH_DIR, `${baseFilename}${extension}`);
  fs.writeFileSync(filepath, content, "utf-8");
  return filepath;
}

/**
 * Saves raw HTML and Markdown files with the same base filename.
 * Generates the base name ONCE, then appends both extensions.
 * @returns {Object} paths to both saved files
 */
function saveRawHtmlAndMarkdown(url, html, markdown) {
  ensureRawFetchDir();
  const baseFilename = generateRawBaseFilename(url);
  const htmlPath = path.join(RAW_FETCH_DIR, `${baseFilename}.html`);
  const mdPath = path.join(RAW_FETCH_DIR, `${baseFilename}.md`);
  fs.writeFileSync(htmlPath, html, "utf-8");
  fs.writeFileSync(mdPath, markdown, "utf-8");
  return { htmlPath, mdPath };
}

async function httpGet(url) {
  const res = await undiciFetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { throw new Error("JSON parse failed: " + e); }
}

function formatResults(data) {
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
async function extractArticle(html, url) {
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
    };
  } catch (e) {
    throw new Error("Defuddle extraction failed: " + e);
  }
}

/**
 * Fallback: extract article content from JSON-LD metadata.
 * Used when Defuddle cannot find main content.
 */
function extractJsonLd(html) {
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
async function extractArticleMultiLevel(html, url) {
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

async function httpGetText(url) {
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

export default function(pi) {
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
        return { content: [{ type: "text", text: formatResults(data) }], details: { resultsCount: data.results?.length || 0 }};
      } catch (error) {
        throw new Error("SearXNG search failed: " + (error instanceof Error ? error.message : String(error)));
      }
    },
  });

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
  pi.registerTool({
    name: "searxng_fetch_raw",
    label: "SearXNG Fetch Raw",
    description:
      "Fetch, convert to Markdown (Defuddle + JSON-LD), AND save raw HTML. Same as searxng_fetch but saves the original HTML to .pi/fetch-raw/. Do NOT read saved files without special permission.",

    parameters: Type.Object({
      url: Type.String({ description: "The URL to fetch" }),
      max_length: Type.Optional(Type.Number({ description: "Max characters (default: 10000)" })),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }] };
      onUpdate?.({ content: [{ type: "text", text: "Fetching and saving raw HTML from " + params.url + "..." }] });

      try {
        const html = await httpGetText(params.url);
        const article = await extractArticleMultiLevel(html, params.url);
        let markdown = article.content;
        const maxLength = params.max_length || 10000;
        if (markdown.length > maxLength) markdown = markdown.substring(0, maxLength) + "\n\n[Content truncated]";

        // Save raw HTML and Markdown
        const { htmlPath, mdPath } = saveRawHtmlAndMarkdown(params.url, html, markdown);

        return {
          content: [{ type: "text", text: markdown }],
          details: { url: params.url, length: markdown.length, method: article.method, title: article.title, savedPaths: { htmlPath, mdPath } },
        };
      } catch (error) {
        throw new Error("Failed to fetch URL: " + (error instanceof Error ? error.message : String(error)));
      }
    },
  });

  pi.on("session_start", async () => { console.log("[searxng-tools] Loaded, SEARXNG_URL=" + SEARXNG_URL); });
}