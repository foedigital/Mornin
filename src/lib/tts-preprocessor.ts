/**
 * TTS Text Preprocessor
 *
 * Cleans text BEFORE sending to /api/tts so Edge TTS doesn't choke on
 * non-English passages, unusual Unicode, or broken formatting.
 *
 * Uses `any-ascii` to transliterate non-Latin scripts (Greek, Cyrillic, etc.)
 * into pronounceable Latin equivalents instead of stripping them.
 *
 * Two modes:
 *  - preprocessForTTS()    — standard cleanup, preserves meaning
 *  - aggressiveCleanup()   — nuclear option, strips everything non-ASCII
 */

import anyAscii from "any-ascii";

// ── Formatting artifact removal (HTML, markdown) ────────────────────────

/**
 * Strip HTML tags and markdown formatting from text.
 * Preserves the actual words but removes all formatting markers
 * that would be read aloud by TTS (underscores, asterisks, HTML tags, etc.).
 */
function stripFormattingArtifacts(text: string): string {
  let t = text;

  // 1. Remove HTML tags completely (keep inner text)
  t = t.replace(/<\/?[^>]+(>|$)/g, "");

  // 2. Remove markdown images before links: ![alt](url) → alt
  t = t.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

  // 3. Remove markdown links but keep link text: [text](url) → text
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 4. Remove markdown bold/italic markers (KEEP the words inside)
  //    Order matters: do bold-italic first, then bold, then italic
  t = t.replace(/\*\*\*(.+?)\*\*\*/g, "$1"); // ***bold italic***
  t = t.replace(/___(.+?)___/g, "$1"); // ___bold italic___
  t = t.replace(/\*\*(.+?)\*\*/g, "$1"); // **bold**
  t = t.replace(/__(.+?)__/g, "$1"); // __bold__
  t = t.replace(/\*(.+?)\*/g, "$1"); // *italic*
  t = t.replace(/_([^_]+)_/g, "$1"); // _italic_

  // 5. Handle stray underscores that aren't part of italic pairs
  t = t.replace(/_{2,}/g, " "); // multiple underscores → space
  t = t.replace(/_/g, " "); // any remaining single underscores → space

  // 6. Handle stray asterisks
  t = t.replace(/\*{2,}/g, " ");
  t = t.replace(/\*/g, " ");

  // 7. Remove markdown headers
  t = t.replace(/^#{1,6}\s+/gm, "");

  // 8. Remove markdown blockquote markers
  t = t.replace(/^>\s+/gm, "");

  // 9. Remove markdown horizontal rules
  t = t.replace(/^[-*_]{3,}\s*$/gm, "");

  return t;
}

// ── Transliteration ─────────────────────────────────────────────────────

/**
 * Transliterate non-ASCII characters to their Latin/ASCII equivalents.
 * Greek "ὁμολογουμένος ζῆν" → "homologoymenos zin"
 * French "Château" → "Chateau"
 * Leaves plain English unchanged.
 * Also removes emoji and other symbols that have no text equivalent.
 */
function transliterateForTTS(text: string): string {
  let t = text;

  // Handle special punctuation BEFORE anyAscii (which would flatten them to basic ASCII)
  // Em/en dashes → comma pause (better for TTS than a plain hyphen)
  t = t.replace(/[—–]/g, ", ");
  t = t.replace(/,\s*,/g, ",");
  // Smart quotes → straight quotes
  t = t.replace(/[""„‟❝❞«»‹›❮❯]/g, '"');
  t = t.replace(/[''‚‛❛❜]/g, "'");
  // Ellipsis
  t = t.replace(/…/g, "...");

  // Transliterate remaining non-ASCII → Latin/ASCII
  t = anyAscii(t);

  // anyAscii converts emoji to :name: tokens — remove them
  t = t.replace(/:[a-z_]+:/g, "");

  // Clean up extra spaces from removals
  t = t.replace(/ {2,}/g, " ");

  return t;
}

// ── Special character cleaning ─────────────────────────────────────────

function cleanSpecialCharacters(text: string): string {
  let t = text;

  // HTML entities that survived extraction
  t = t.replace(/&amp;/g, "and");
  t = t.replace(/&nbsp;/g, " ");
  t = t.replace(/&mdash;/g, ", ");
  t = t.replace(/&ndash;/g, ", ");
  t = t.replace(/&ldquo;|&rdquo;/g, '"');
  t = t.replace(/&lsquo;|&rsquo;/g, "'");
  t = t.replace(/&hellip;/g, "...");
  t = t.replace(/&#\d+;/g, " ");
  t = t.replace(/&\w+;/g, " ");

  // Em/en dashes → commas (natural pause)
  t = t.replace(/[—–]/g, ", ");
  // Clean up double commas from dash replacement
  t = t.replace(/,\s*,/g, ",");

  // Ellipsis variants
  t = t.replace(/…/g, "...");

  // Ampersand
  t = t.replace(/&/g, " and ");

  // Footnote markers, superscripts, bracket references
  t = t.replace(/\[\d+\]/g, "");
  t = t.replace(/\{\d+\}/g, "");
  t = t.replace(/\*{1,3}/g, "");

  // Unusual Unicode punctuation
  t = t.replace(/[«»‹›„"‟‛❝❞❮❯]/g, '"');
  t = t.replace(/[''‚‛❛❜]/g, "'");
  t = t.replace(/[•·●]/g, ". ");
  t = t.replace(/[†‡§¶]/g, "");
  t = t.replace(/[™©®]/g, "");

  // Non-breaking spaces, zero-width chars, soft hyphens
  t = t.replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u00AD]/g, " ");

  // Tab characters
  t = t.replace(/\t/g, " ");

  // Multiple spaces → single space
  t = t.replace(/ {2,}/g, " ");

  return t;
}

// ── Poetry / formatting cleanup ────────────────────────────────────────

function cleanPoetryFormatting(text: string): string {
  let t = text;

  // Remove leading indentation on each line
  t = t.replace(/^[ \t]+/gm, "");

  // Collapse 3+ blank lines into 2 (paragraph-level pause)
  t = t.replace(/\n{4,}/g, "\n\n\n");

  // Single line breaks → pause marker for TTS
  // (Double line breaks = paragraph, keep them)
  // We add a period to create a natural TTS pause at line breaks
  t = t.replace(/([^\n])\n([^\n])/g, "$1. $2");

  // Clean up cases where we added a period after existing punctuation
  t = t.replace(/([.!?])\.\s/g, "$1 ");

  // Double/triple periods from cleanup
  t = t.replace(/\.{2,}/g, "...");

  return t;
}

// ── Main preprocessor ──────────────────────────────────────────────────

/**
 * Standard preprocessing: cleans text for TTS while preserving meaning.
 * Safe to run on normal English text (acts as a no-op for clean content).
 */
export function preprocessForTTS(text: string): string {
  let t = text;

  // Step 0: Strip HTML tags and markdown formatting artifacts
  // _italic_ → italic, **bold** → bold, <em>text</em> → text
  t = stripFormattingArtifacts(t);

  // Step 1: Transliterate non-Latin scripts to pronounceable Latin
  // Greek "ὁμολογουμένος" → "homologoymenos", French "Château" → "Chateau"
  t = transliterateForTTS(t);

  // Step 2: Clean special characters (HTML entities, punctuation, etc.)
  t = cleanSpecialCharacters(t);

  // Step 3: Clean poetry/formatting
  t = cleanPoetryFormatting(t);

  // Step 4: Final whitespace normalization
  t = t.replace(/ {2,}/g, " ");
  t = t.trim();

  return t;
}

/**
 * Aggressive cleanup: strips EVERYTHING that isn't basic ASCII English.
 * Used as a last resort when standard preprocessing still fails.
 * Loses nuance but guarantees TTS can handle the text.
 */
export function aggressiveCleanup(text: string): string {
  let t = text;

  // Strip ALL non-ASCII characters
  t = t.replace(/[^\x20-\x7E\n]/g, " ");

  // Only keep: letters, numbers, basic punctuation (. , ! ? ' " - : ;)
  t = t.replace(/[^a-zA-Z0-9\s.,!?'":;\-()]/g, " ");

  // Collapse whitespace
  t = t.replace(/ {2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");

  // Remove very short lines (likely artifacts)
  const lines = t.split("\n");
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed.length === 0 || trimmed.split(/\s+/).length >= 2;
  });
  t = cleaned.join("\n");

  t = t.trim();
  return t;
}

/**
 * Split text that's over the word limit into smaller pieces at sentence boundaries.
 * Safety net for chapters that are still too long after preprocessing.
 */
export function splitIfTooLong(text: string, maxWords: number = 550): string[] {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return [text];

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;

    if (currentWordCount + sentenceWords > maxWords && currentWordCount > 0) {
      chunks.push(current.join(" "));
      current = [sentence];
      currentWordCount = sentenceWords;
    } else {
      current.push(sentence);
      currentWordCount += sentenceWords;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}
