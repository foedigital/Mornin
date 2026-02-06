import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { chunkIntoChapters } from "@/lib/chunker";

export const maxDuration = 30;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type ContentType = "poem" | "story" | "speech" | "essay" | "novella" | "article";

interface ExtractResult {
  title: string;
  author: string;
  text: string;
  type: ContentType;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&hellip;/g, "\u2026")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function cleanProse(text: string): string {
  return decodeEntities(text)
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanPoetry(text: string): string {
  return decodeEntities(text)
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Fetch a URL with timeout and realistic headers */
async function fetchUrl(
  url: string,
  accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: accept,
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract text from a cheerio element, preserving line breaks */
function extractTextWithBreaks($: cheerio.CheerioAPI, el: ReturnType<cheerio.CheerioAPI>): string {
  // Replace <br> with newline markers before getting text
  el.find("br").replaceWith("\n");
  // Add double newlines after block elements
  el.find("p, div, h1, h2, h3, h4, h5, h6, li, blockquote").each((_, e) => {
    const $e = $(e);
    $e.append("\n\n");
  });
  return el.text();
}

/** Try to extract JSON-LD data */
function extractJsonLd($: cheerio.CheerioAPI): { title?: string; author?: string; text?: string } {
  const result: { title?: string; author?: string; text?: string } = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "");
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item.name && !result.title) result.title = item.name;
        if (item.headline && !result.title) result.title = item.headline;
        if (item.author) {
          const a = typeof item.author === "string" ? item.author : item.author?.name;
          if (a && !result.author) result.author = a;
        }
        if (item.text && !result.text) result.text = item.text;
        if (item.articleBody && !result.text) result.text = item.articleBody;
      }
    } catch { /* ignore invalid JSON-LD */ }
  });
  return result;
}

/** Get meta title from common sources */
function extractTitle($: cheerio.CheerioAPI): string {
  return (
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    "Untitled"
  );
}

/** Get meta author from common sources */
function extractAuthor($: cheerio.CheerioAPI): string {
  return (
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    $('[rel="author"]').first().text().trim() ||
    $(".byline, .author, .writer").first().text().trim() ||
    ""
  );
}

// ---------------------------------------------------------------------------
// Source-specific parsers
// ---------------------------------------------------------------------------

async function parseGutenberg(url: string): Promise<ExtractResult> {
  // Extract the ebook ID from the URL
  const idMatch = url.match(/gutenberg\.org\/ebooks\/(\d+)/);
  if (!idMatch) throw new Error("Could not parse Gutenberg ebook ID from URL");
  const id = idMatch[1];

  // Try plain text first
  const txtUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
  let text = "";
  let title = "Untitled";
  let author = "Unknown author";

  try {
    const res = await fetchUrl(txtUrl, "text/plain");
    if (res.ok) {
      const raw = await res.text();

      // Strip Gutenberg boilerplate
      const startMatch = raw.match(/\*\*\*\s*START OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*\n/i);
      const endMatch = raw.match(/\*\*\*\s*END OF (?:THE |THIS )?PROJECT GUTENBERG/i);

      const startIdx = startMatch ? (startMatch.index! + startMatch[0].length) : 0;
      const endIdx = endMatch ? endMatch.index! : raw.length;
      text = raw.slice(startIdx, endIdx).trim();

      // Extract title/author from the boilerplate header
      const header = raw.slice(0, startIdx);
      const titleMatch = header.match(/Title:\s*(.+)/i);
      const authorMatch = header.match(/Author:\s*(.+)/i);
      if (titleMatch) title = titleMatch[1].trim();
      if (authorMatch) author = authorMatch[1].trim();
    }
  } catch { /* txt failed, try HTML */ }

  // Fallback: HTML version
  if (!text || text.length < 100) {
    const htmlUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}-images.html`;
    const res = await fetchUrl(htmlUrl);
    if (!res.ok) throw new Error(`Gutenberg returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove TOC, pg header/footer
    $("table.header, div.pg-boilerplate, pre.pg-boilerplate, section.pg-boilerplate").remove();

    const body = $("body");
    text = extractTextWithBreaks($, body);
    text = cleanProse(text);

    if (title === "Untitled") title = extractTitle($);
    if (author === "Unknown author") {
      const a = extractAuthor($);
      if (a) author = a;
    }
  }

  text = cleanProse(text);

  // Infer type from length
  const wordCount = text.split(/\s+/).length;
  let type: ContentType = "story";
  if (wordCount > 30000) type = "novella";
  else if (wordCount < 3000) type = "essay";

  return { title, author, text, type };
}

async function parsePoetryFoundation(url: string, html: string): Promise<ExtractResult> {
  const $ = cheerio.load(html);

  // Try multiple selectors for the poem body
  let poemEl =
    $("[data-poem-body]").first().length ? $("[data-poem-body]").first() :
    $(".o-poem").first().length ? $(".o-poem").first() :
    $(".poem-body").first().length ? $(".poem-body").first() :
    $(".c-feature-bd .o-vr").first().length ? $(".c-feature-bd .o-vr").first() :
    $("article .o-vr").first().length ? $("article .o-vr").first() :
    null;

  let text = "";

  if (poemEl && poemEl.length) {
    text = extractTextWithBreaks($, poemEl);
  }

  // JSON-LD fallback
  if (!text || text.trim().length < 20) {
    const ld = extractJsonLd($);
    if (ld.text) text = ld.text;
  }

  // Last resort: grab all <div> inside article that looks like verse
  if (!text || text.trim().length < 20) {
    const article = $("article").first();
    if (article.length) {
      text = extractTextWithBreaks($, article);
    }
  }

  text = cleanPoetry(text);

  const title = $("h1").first().text().trim() || extractTitle($);
  let author =
    $(".c-feature-sub a").first().text().trim() ||
    $(".c-txt_attribution a").first().text().trim() ||
    extractAuthor($);

  // Clean "By " prefix
  author = author.replace(/^By\s+/i, "");

  return { title, author: author || "Unknown poet", text, type: "poem" };
}

async function parsePoetsOrg(url: string, html: string): Promise<ExtractResult> {
  const $ = cheerio.load(html);

  let text = "";

  // Try specific selectors
  const selectors = [
    ".field--name-body",
    ".poem-body",
    ".field--name-field-poem-body",
    "article .field--type-text-long",
    "article .node__content",
  ];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 20) {
      text = extractTextWithBreaks($, el);
      break;
    }
  }

  if (!text || text.trim().length < 20) {
    const ld = extractJsonLd($);
    if (ld.text) text = ld.text;
  }

  if (!text || text.trim().length < 20) {
    const article = $("article").first();
    if (article.length) {
      text = extractTextWithBreaks($, article);
    }
  }

  text = cleanPoetry(text);

  const title = $("h1").first().text().trim() || extractTitle($);
  let author =
    $(".field--name-field-author a").first().text().trim() ||
    $(".node__author a").first().text().trim() ||
    extractAuthor($);
  author = author.replace(/^By\s+/i, "");

  return { title, author: author || "Unknown poet", text, type: "poem" };
}

async function parseAmericanLiterature(url: string, html: string): Promise<ExtractResult> {
  const $ = cheerio.load(html);

  // Remove ads, sidebars, nav
  $("script, style, nav, header, footer, .sidebar, .ad, .advertisement, #comments, .related-posts").remove();

  let text = "";

  const selectors = [
    ".entry-content",
    ".post-content",
    ".node__content",
    "article .field--name-body",
    "article",
    "main",
  ];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      text = extractTextWithBreaks($, el);
      break;
    }
  }

  // JSON-LD fallback
  if (!text || text.trim().length < 200) {
    const ld = extractJsonLd($);
    if (ld.text) text = ld.text;
  }

  text = cleanProse(text);

  const title = $("h1.entry-title, h1.page-title, h1").first().text().trim() || extractTitle($);

  // Author is often in the URL path
  let author = "";
  const authorMatch = url.match(/author\/([^/]+)/);
  if (authorMatch) {
    author = authorMatch[1]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (!author) author = extractAuthor($) || "Unknown author";

  // Detect type from URL
  let type: ContentType = "story";
  if (url.includes("/essay/")) type = "essay";
  else if (url.includes("/poem/") || url.includes("/poetry/")) type = "poem";

  return { title, author, text, type };
}

async function parsePresidency(url: string, html: string): Promise<ExtractResult> {
  const $ = cheerio.load(html);

  let text = "";

  const selectors = [
    ".field-docs-content",
    ".field--name-field-docs-content",
    ".pane-node-field-docs-content",
    "article .node__content",
    "article",
  ];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 100) {
      text = extractTextWithBreaks($, el);
      break;
    }
  }

  text = cleanProse(text);

  const title = $("h1").first().text().trim() || extractTitle($);
  const author =
    $(".field-title a").first().text().trim() ||
    $(".field--name-field-docs-person a").first().text().trim() ||
    extractAuthor($) ||
    "Unknown speaker";

  return { title, author, text, type: "speech" };
}

// ---------------------------------------------------------------------------
// Generic fallback parser
// ---------------------------------------------------------------------------

function parseGeneric(url: string, html: string): ExtractResult {
  const $ = cheerio.load(html);

  // Remove noise
  $("script, style, nav, header, footer, aside, iframe, .sidebar, .ad, .advertisement, .nav, .menu, .comments, #comments, .share, .social").remove();

  let text = "";

  // Priority: article > main > .content > .entry-content > .post-content > body paragraphs
  const selectors = [
    "article",
    "main",
    ".content",
    ".entry-content",
    ".post-content",
    '[role="main"]',
    "#content",
  ];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      text = extractTextWithBreaks($, el);
      break;
    }
  }

  // Last resort: grab all <p> tags
  if (!text || text.trim().length < 200) {
    const paragraphs: string[] = [];
    $("body p").each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 30) paragraphs.push(t);
    });
    text = paragraphs.join("\n\n");
  }

  // JSON-LD fallback
  if (!text || text.trim().length < 100) {
    const ld = extractJsonLd($);
    if (ld.text) text = ld.text;
  }

  text = cleanProse(text);

  let title = extractTitle($);
  let author = extractAuthor($) || "Unknown author";

  // Also check JSON-LD for metadata
  const ld = extractJsonLd($);
  if (ld.title && title === "Untitled") title = ld.title;
  if (ld.author && author === "Unknown author") author = ld.author;

  // Infer type
  const wordCount = text.split(/\s+/).length;
  let type: ContentType = "article";
  if (wordCount > 30000) type = "novella";
  else if (wordCount > 5000) type = "story";

  return { title, author, text, type };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

function detectSource(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host.includes("gutenberg.org")) return "gutenberg";
  if (host.includes("poetryfoundation.org")) return "poetryfoundation";
  if (host.includes("poets.org")) return "poetsorg";
  if (host.includes("americanliterature.com")) return "americanlit";
  if (host.includes("presidency.ucsb.edu")) return "presidency";
  return "generic";
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return NextResponse.json({ error: "Only HTTP/HTTPS URLs are supported" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const source = detectSource(url);
    let result: ExtractResult;

    if (source === "gutenberg") {
      // Gutenberg handles its own fetching (txt vs html)
      result = await parseGutenberg(url);
    } else {
      // All other sources: fetch HTML first, then parse
      let res: Response;
      try {
        res = await fetchUrl(url);
      } catch (err) {
        const msg =
          err instanceof Error && err.name === "AbortError"
            ? "The URL took too long to respond"
            : "Could not reach this URL. It may be blocked or down.";
        return NextResponse.json({ error: msg }, { status: 502 });
      }

      if (!res.ok) {
        return NextResponse.json(
          { error: `Site returned error ${res.status}. It may require login or block scrapers.` },
          { status: 502 }
        );
      }

      const html = await res.text();

      if (!html || html.length < 100) {
        return NextResponse.json(
          { error: "The page returned very little content" },
          { status: 422 }
        );
      }

      switch (source) {
        case "poetryfoundation":
          result = await parsePoetryFoundation(url, html);
          break;
        case "poetsorg":
          result = await parsePoetsOrg(url, html);
          break;
        case "americanlit":
          result = await parseAmericanLiterature(url, html);
          break;
        case "presidency":
          result = await parsePresidency(url, html);
          break;
        default:
          result = parseGeneric(url, html);
      }
    }

    // Validate we got enough text
    if (!result.text || result.text.length < 50) {
      return NextResponse.json(
        {
          error:
            "Couldn't extract enough readable text from this URL. The page may require JavaScript or login.",
        },
        { status: 422 }
      );
    }

    const wordCount = result.text.split(/\s+/).length;

    // Chunk into chapters
    const chapters = chunkIntoChapters(result.text);

    if (chapters.length === 0) {
      return NextResponse.json(
        { error: "No content found after extraction" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      title: result.title,
      author: result.author,
      chapters,
      type: result.type,
      wordCount,
    });
  } catch (err) {
    console.error("Extract error:", err);
    const msg =
      err instanceof Error ? err.message : "Failed to extract content";
    return NextResponse.json(
      { error: `Extraction failed: ${msg}` },
      { status: 500 }
    );
  }
}
