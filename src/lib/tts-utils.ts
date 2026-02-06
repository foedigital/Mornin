/**
 * Text-to-Speech utility functions for chunking text
 * and estimating playback duration.
 */

const WORDS_PER_MINUTE = 150;

/**
 * Split text into speakable chunks.
 * Poetry mode splits on line breaks; prose splits on sentence boundaries.
 */
export function splitIntoChunks(text: string, isPoetry?: boolean): string[] {
  if (!text || !text.trim()) return [];

  if (isPoetry) {
    return text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  // Prose: split on sentence-ending punctuation followed by space or end
  const sentences = text.match(/[^.!?]*[.!?]+[\s]?|[^.!?]+$/g);
  if (!sentences) return [text.trim()];

  return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Count words in an array of chunks.
 */
function countWords(chunks: string[]): number {
  return chunks.reduce((total, chunk) => {
    return total + chunk.split(/\s+/).filter((w) => w.length > 0).length;
  }, 0);
}

/**
 * Estimate total duration in seconds for all chunks at a given speech rate.
 * rate is the SpeechSynthesis rate multiplier (1.0 = normal).
 */
export function estimateDuration(chunks: string[], rate = 1): number {
  const words = countWords(chunks);
  const minutes = words / (WORDS_PER_MINUTE * rate);
  return Math.ceil(minutes * 60);
}

/**
 * Estimate elapsed time in seconds up to (but not including) currentIndex.
 */
export function estimateElapsedTime(
  chunks: string[],
  currentIndex: number,
  rate = 1
): number {
  const elapsed = chunks.slice(0, currentIndex);
  return estimateDuration(elapsed, rate);
}

/**
 * Format seconds into "M:SS" display string.
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Calculate how many chunks to skip for approximately `secondsToSkip` seconds.
 * Returns at least 1 if there are chunks.
 */
export function getChunkSkipCount(
  chunks: string[],
  secondsToSkip = 15
): number {
  if (chunks.length === 0) return 0;
  const totalDuration = estimateDuration(chunks);
  if (totalDuration === 0) return 1;
  const secondsPerChunk = totalDuration / chunks.length;
  const skip = Math.max(1, Math.round(secondsToSkip / secondsPerChunk));
  return skip;
}
