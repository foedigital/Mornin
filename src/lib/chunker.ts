const TARGET_WORDS = 750;
const MIN_WORDS = 200;

export interface Chapter {
  index: number;
  title: string;
  text: string;
  wordCount: number;
}

export function chunkIntoChapters(text: string): Chapter[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) return [];

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
    // If the last chunk is too small, merge with previous chapter
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

  return chapters;
}

export function estimateChapterDuration(wordCount: number): number {
  // Average TTS speaking rate ~150 words per minute
  return Math.ceil((wordCount / 150) * 60);
}
