/**
 * TTS Text Preprocessor
 *
 * Cleans text BEFORE sending to /api/tts so Edge TTS doesn't choke on
 * non-English passages, unusual Unicode, or broken formatting.
 *
 * Two modes:
 *  - preprocessForTTS()    — standard cleanup, preserves meaning
 *  - aggressiveCleanup()   — nuclear option, strips everything non-ASCII
 */

// ── Non-English detection ──────────────────────────────────────────────

/** Unicode ranges for scripts that are NOT basic Latin / English */
const NON_LATIN_RE =
  /[\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0B00-\u0B7F\u0C00-\u0C7F\u0D00-\u0D7F\u0E00-\u0E7F\u1000-\u109F\u1100-\u11FF\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/;

/** Extended Latin characters used in French, German, Spanish, Italian, etc. */
const EXTENDED_LATIN_RE = /[À-ÖØ-öø-ÿĀ-žƀ-ɏ]/;

/**
 * Heuristic: is this line primarily non-English?
 * Returns true if >40% of alphabetic chars are non-Latin or extended-Latin.
 */
function isNonEnglishLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3) return false;

  const alphaChars = trimmed.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿĀ-žƀ-ɏ\u0370-\u9FFF\uAC00-\uD7AF]/g, "");
  if (alphaChars.length < 3) return false;

  let nonEnglishCount = 0;
  for (const ch of alphaChars) {
    if (NON_LATIN_RE.test(ch) || EXTENDED_LATIN_RE.test(ch)) {
      nonEnglishCount++;
    }
  }

  return nonEnglishCount / alphaChars.length > 0.4;
}

/**
 * Detect and replace blocks of non-English text with a spoken note.
 * Groups consecutive non-English lines into a single replacement.
 */
function replaceNonEnglishBlocks(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inForeignBlock = false;

  for (const line of lines) {
    if (isNonEnglishLine(line)) {
      if (!inForeignBlock) {
        result.push("[Foreign language passage.]");
        inForeignBlock = true;
      }
      // skip the line (already replaced)
    } else {
      inForeignBlock = false;
      result.push(line);
    }
  }

  return result.join("\n");
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

  // Step 1: Replace non-English blocks
  t = replaceNonEnglishBlocks(t);

  // Step 2: Clean special characters
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
