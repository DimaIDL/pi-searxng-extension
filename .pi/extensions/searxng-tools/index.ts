import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { fetch as undiciFetch, request as undiciRequest } from "undici";
import { URL } from "node:url";
import { NodeHtmlMarkdown } from "node-html-markdown";
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
 * Generates a filename for raw HTML storage.
 * Format: <domain>_<hash 10 chars>_<YYYYMMDD_HHMMSS>.html
 */
function generateRawFilename(url) {
  const parsed = new URL(url);
  const domain = parsed.hostname.replace(/\./g, "_");
  const hash = crypto.createHash("md5").update(url).digest("hex").substring(0, 10);
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
  return `${domain}_${hash}_${dateStr}.html`;
}

/**
 * Saves raw HTML content to a file in the raw fetch directory.
 */
function saveRawHtml(url, html) {
  ensureRawFetchDir();
  const filename = generateRawFilename(url);
  const filepath = path.join(RAW_FETCH_DIR, filename);
  fs.writeFileSync(filepath, html, "utf-8");
  return filepath;
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

function htmlToMarkdown(html) {
  try { return NodeHtmlMarkdown.translate(html).replace(/\s+/g, " ").replace(/([ \t]*)\n/g, "\n").trim(); } catch(e) { throw new Error("HTML to Markdown failed: " + e); }
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
    description: "Fetch and read web page content. Converts HTML to Markdown.",
    parameters: Type.Object({
      url: Type.String({ description: "The URL to fetch" }),
      max_length: Type.Optional(Type.Number({ description: "Max characters (default: 10000)" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }] };
      onUpdate?.({ content: [{ type: "text", text: "Fetching " + params.url + "..." }] });
      try {
        const html = await httpGetText(params.url);
        let markdown = htmlToMarkdown(html);
        const maxLength = params.max_length || 10000;
        if (markdown.length > maxLength) markdown = markdown.substring(0, maxLength) + "\n\n[Content truncated]";
        return { content: [{ type: "text", text: markdown }], details: { url: params.url, length: markdown.length }};
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
      "Fetch and save raw HTML content. Saves to .pi/fetch-raw/ with auto-generated filename.",

    parameters: Type.Object({
      url: Type.String({ description: "The URL to fetch" }),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }] };
      onUpdate?.({ content: [{ type: "text", text: "Fetching raw HTML from " + params.url + "..." }] });

      try {
        const html = await httpGetText(params.url);
        const filepath = saveRawHtml(params.url, html);
        return {
          content: [{ type: "text", text: `Saved to ${filepath}` }],
          details: { url: params.url, savedPath: filepath },
        };
      } catch (error) {
        throw new Error("Failed to fetch URL: " + (error instanceof Error ? error.message : String(error)));
      }
    },
  });

  pi.on("session_start", async () => { console.log("[searxng-tools] Loaded, SEARXNG_URL=" + SEARXNG_URL); });
}