import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { chunkIntoChapters } from "@/lib/chunker";

export const maxDuration = 30;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function fallbackExtract(html: string): string {
  // Strip script, style, nav, header, footer tags and their contents
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // Extract text from remaining tags
  cleaned = cleaned
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
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

    // Fetch the page with a realistic User-Agent and timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
        redirect: "follow",
      });
    } catch (err) {
      clearTimeout(timeout);
      const msg = err instanceof Error && err.name === "AbortError"
        ? "The URL took too long to respond"
        : "Could not reach this URL. It may be blocked or down.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    clearTimeout(timeout);

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

    // Try Readability first
    let title = "Untitled";
    let author = "Unknown author";
    let cleanText = "";

    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article && article.textContent && article.textContent.trim().length > 200) {
        title = article.title || title;
        author = article.byline || author;
        cleanText = article.textContent;
      }
    } catch (e) {
      console.warn("Readability failed, using fallback:", e);
    }

    // Fallback: manual extraction
    if (!cleanText || cleanText.trim().length < 200) {
      cleanText = fallbackExtract(html);

      // Try to get title from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

    if (cleanText.length < 100) {
      return NextResponse.json(
        { error: "Couldn't extract enough readable text from this URL. The page may require JavaScript or login." },
        { status: 422 }
      );
    }

    const chapters = chunkIntoChapters(cleanText);

    if (chapters.length === 0) {
      return NextResponse.json(
        { error: "No content found after extraction" },
        { status: 422 }
      );
    }

    return NextResponse.json({ title, author, chapters });
  } catch (err) {
    console.error("Extract error:", err);
    return NextResponse.json(
      { error: "Failed to extract content. Please try a different URL." },
      { status: 500 }
    );
  }
}
