const TARGET_WORDS = 450; // ~3 minutes at 150 wpm
const MIN_WORDS = 150;

export interface Chapter {
  index: number;
  title: string;
  text: string;
  wordCount: number;
}

export interface Part {
  index: number;
  label: string;
  startChapter: number;
  endChapter: number;
}

const CHAPTERS_PER_PART = 20;

/** Group chapters into Parts of 20. Returns empty array for books with ≤20 chapters. */
export function assignParts(chapters: Chapter[]): Part[] {
  const total = chapters.length;
  if (total <= CHAPTERS_PER_PART) return [];

  const numberOfParts = Math.ceil(total / CHAPTERS_PER_PART);
  const parts: Part[] = [];

  for (let p = 0; p < numberOfParts; p++) {
    const startIdx = p * CHAPTERS_PER_PART;
    const endIdx = Math.min(startIdx + CHAPTERS_PER_PART - 1, total - 1);
    parts.push({
      index: p,
      label: `Part ${p + 1} (Ch. ${startIdx + 1}\u2013${endIdx + 1})`,
      startChapter: startIdx,
      endChapter: endIdx,
    });
  }

  return parts;
}

export function chunkIntoChapters(text: string): Chapter[] {
  const totalWords = text.split(/\s+/).length;

  // Short texts (poems, short essays): single chapter
  if (totalWords <= 550) {
    return [
      {
        index: 0,
        title: "Full Text",
        text,
        wordCount: totalWords,
      },
    ];
  }

  // Check for explicit chapter markers in the text
  const chapterPattern = /\n\s*(CHAPTER|Chapter|PART|Part|BOOK|Book|ACT|Act|SECTION|Section)\s+([IVXLCDM\d]+[.:)  ]*.*)/g;
  const markers: { index: number; label: string }[] = [];
  let match;
  while ((match = chapterPattern.exec(text)) !== null) {
    markers.push({ index: match.index, label: match[0].trim() });
  }

  // If we found chapter markers, split on them
  if (markers.length >= 2) {
    const chapters: Chapter[] = [];
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index;
      const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
      const chapterText = text.slice(start, end).trim();
      const wordCount = chapterText.split(/\s+/).length;
      if (wordCount > 20) {
        chapters.push({
          index: chapters.length,
          title: markers[i].label.slice(0, 80),
          text: chapterText,
          wordCount,
        });
      }
    }
    // Prepend any text before the first marker as a "Preface" if substantial
    if (markers[0].index > 0) {
      const preface = text.slice(0, markers[0].index).trim();
      const prefaceWords = preface.split(/\s+/).length;
      if (prefaceWords > 50) {
        chapters.unshift({
          index: 0,
          title: "Preface",
          text: preface,
          wordCount: prefaceWords,
        });
        // Re-index
        for (let i = 1; i < chapters.length; i++) {
          chapters[i].index = i;
        }
      }
    }
    if (chapters.length >= 2) return finalizeChapters(enforceMaxChapterSize(chapters));
  }

  // Try paragraph-based splitting first
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // If text has paragraph breaks, split by paragraphs at ~450 words
  if (paragraphs.length >= 2) {
    const chapters: Chapter[] = [];
    let currentParagraphs: string[] = [];
    let currentWordCount = 0;

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).length;

      if (currentWordCount + paraWords > TARGET_WORDS && currentWordCount >= MIN_WORDS) {
        chapters.push({
          index: chapters.length,
          title: `Chapter ${chapters.length + 1}`,
          text: currentParagraphs.join("\n\n"),
          wordCount: currentWordCount,
        });
        currentParagraphs = [para];
        currentWordCount = paraWords;
      } else {
        currentParagraphs.push(para);
        currentWordCount += paraWords;
      }
    }

    // Flush remaining
    if (currentParagraphs.length > 0) {
      if (currentWordCount < MIN_WORDS && chapters.length > 0) {
        const last = chapters[chapters.length - 1];
        last.text += "\n\n" + currentParagraphs.join("\n\n");
        last.wordCount += currentWordCount;
      } else {
        chapters.push({
          index: chapters.length,
          title: `Chapter ${chapters.length + 1}`,
          text: currentParagraphs.join("\n\n"),
          wordCount: currentWordCount,
        });
      }
    }

    if (chapters.length >= 2) return finalizeChapters(enforceMaxChapterSize(chapters));
  }

  // Fallback: split on sentence boundaries when no paragraph breaks exist
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chapters: Chapter[] = [];
  let currentSentences: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;

    if (currentWordCount + sentenceWords > TARGET_WORDS && currentWordCount >= MIN_WORDS) {
      chapters.push({
        index: chapters.length,
        title: `Chapter ${chapters.length + 1}`,
        text: currentSentences.join(" "),
        wordCount: currentWordCount,
      });
      currentSentences = [sentence];
      currentWordCount = sentenceWords;
    } else {
      currentSentences.push(sentence);
      currentWordCount += sentenceWords;
    }
  }

  // Flush remaining
  if (currentSentences.length > 0) {
    if (currentWordCount < MIN_WORDS && chapters.length > 0) {
      const last = chapters[chapters.length - 1];
      last.text += " " + currentSentences.join(" ");
      last.wordCount += currentWordCount;
    } else {
      chapters.push({
        index: chapters.length,
        title: `Chapter ${chapters.length + 1}`,
        text: currentSentences.join(" "),
        wordCount: currentWordCount,
      });
    }
  }

  return finalizeChapters(enforceMaxChapterSize(chapters));
}

const MAX_CHAPTER_WORDS = 580; // Hard cap — must stay under TTS 600-word limit

/** Split any oversized chapter at sentence boundaries */
function enforceMaxChapterSize(chapters: Chapter[]): Chapter[] {
  const result: Chapter[] = [];

  for (const ch of chapters) {
    if (ch.wordCount <= MAX_CHAPTER_WORDS) {
      result.push({ ...ch, index: result.length });
      continue;
    }

    // Split this chapter at sentence boundaries
    const sentences = ch.text.split(/(?<=[.!?])\s+/);
    let current: string[] = [];
    let currentWords = 0;
    let isFirstPart = true;

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;

      if (currentWords + sentenceWords > TARGET_WORDS && currentWords >= MIN_WORDS) {
        result.push({
          index: result.length,
          title: isFirstPart && !isGenericTitle(ch.title) ? ch.title : `Chapter ${result.length + 1}`,
          text: current.join(" "),
          wordCount: currentWords,
        });
        isFirstPart = false;
        current = [sentence];
        currentWords = sentenceWords;
      } else {
        current.push(sentence);
        currentWords += sentenceWords;
      }
    }

    if (current.length > 0) {
      if (currentWords < MIN_WORDS && result.length > 0) {
        const last = result[result.length - 1];
        last.text += " " + current.join(" ");
        last.wordCount += currentWords;
      } else {
        result.push({
          index: result.length,
          title: isFirstPart && !isGenericTitle(ch.title) ? ch.title : `Chapter ${result.length + 1}`,
          text: current.join(" "),
          wordCount: currentWords,
        });
      }
    }
  }

  return result;
}

/** Check if a chapter title is auto-generated (vs extracted from source text) */
function isGenericTitle(title: string): boolean {
  return /^Chapter \d+$/.test(title);
}

/** Final pass: ensure sequential indices and zero-padded generic titles */
function finalizeChapters(chapters: Chapter[]): Chapter[] {
  const total = chapters.length;
  const padLen = String(total).length;

  return chapters.map((ch, i) => ({
    ...ch,
    index: i,
    title: isGenericTitle(ch.title)
      ? `Chapter ${String(i + 1).padStart(padLen, "0")}`
      : ch.title,
  }));
}

export function estimateChapterDuration(wordCount: number): number {
  // Average TTS speaking rate ~150 words per minute
  return Math.ceil((wordCount / 150) * 60);
}
