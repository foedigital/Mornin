import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { chunkIntoChapters } from "@/lib/chunker";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch the page
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MorninApp/1.0)",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();

    // Parse with Readability
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      return NextResponse.json(
        { error: "Could not extract readable content from this URL" },
        { status: 422 }
      );
    }

    // Clean up the text
    const cleanText = article.textContent
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const chapters = chunkIntoChapters(cleanText);

    if (chapters.length === 0) {
      return NextResponse.json(
        { error: "No content found after extraction" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      title: article.title || "Untitled",
      author: article.byline || "Unknown author",
      chapters,
    });
  } catch (err) {
    console.error("Extract error:", err);
    return NextResponse.json(
      { error: "Failed to extract content" },
      { status: 500 }
    );
  }
}
