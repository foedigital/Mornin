"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  splitIntoChunks,
  estimateDuration,
  estimateElapsedTime,
  getChunkSkipCount,
} from "@/lib/tts-utils";

const POSITION_KEY_PREFIX = "mornin-tts-pos-";
const VOICE_KEY = "mornin-tts-voice";

interface UseTextToSpeechOptions {
  text: string;
  contentId: string;
  isPoetry?: boolean;
  rate?: number;
}

interface UseTextToSpeechReturn {
  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  progress: number; // 0-1
  currentChunkIndex: number;
  totalChunks: number;
  elapsedTime: number;
  totalTime: number;
  currentText: string;
  // Voice
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice) => void;
  // Controls
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  seekTo: (progress: number) => void;
  // Browser support
  isSupported: boolean;
  hasSavedPosition: boolean;
}

function loadSavedPosition(contentId: string): number {
  try {
    const val = localStorage.getItem(POSITION_KEY_PREFIX + contentId);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

function savePosition(contentId: string, index: number) {
  try {
    localStorage.setItem(POSITION_KEY_PREFIX + contentId, String(index));
  } catch {}
}

function loadSavedVoiceName(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

function saveVoiceName(name: string) {
  try {
    localStorage.setItem(VOICE_KEY, name);
  } catch {}
}

export function useTextToSpeech({
  text,
  contentId,
  isPoetry = false,
  rate = 1,
}: UseTextToSpeechOptions): UseTextToSpeechReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoiceState] = useState<SpeechSynthesisVoice | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const chunksRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const contentIdRef = useRef(contentId);
  const rateRef = useRef(rate);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Update refs when props change
  contentIdRef.current = contentId;
  rateRef.current = rate;

  // Compute chunks
  useEffect(() => {
    chunksRef.current = splitIntoChunks(text, isPoetry);
  }, [text, isPoetry]);

  const chunks = splitIntoChunks(text, isPoetry);
  const totalChunks = chunks.length;
  const totalTime = estimateDuration(chunks, rate);
  const elapsedTime = estimateElapsedTime(chunks, currentChunkIndex, rate);
  const progress = totalChunks > 0 ? currentChunkIndex / totalChunks : 0;
  const currentText = chunks[currentChunkIndex] || "";

  // Check browser support
  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Load voices (they load async, especially on iOS)
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        // Restore saved voice preference
        const savedName = loadSavedVoiceName();
        const saved = savedName ? voices.find((v) => v.name === savedName) : null;
        const defaultVoice = saved || voices.find((v) => v.default) || voices[0];
        setSelectedVoiceState(defaultVoice);
        selectedVoiceRef.current = defaultVoice;
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [isSupported]);

  // Check saved position
  const hasSavedPosition = (() => {
    if (typeof window === "undefined") return false;
    try {
      const val = localStorage.getItem(POSITION_KEY_PREFIX + contentId);
      return val !== null && parseInt(val, 10) > 0;
    } catch {
      return false;
    }
  })();

  const setSelectedVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoiceState(voice);
    selectedVoiceRef.current = voice;
    saveVoiceName(voice.name);
  }, []);

  // Speak a single chunk, then chain to the next via onend
  const speakChunk = useCallback((index: number) => {
    const chks = chunksRef.current;
    if (index >= chks.length || !isPlayingRef.current) {
      // Done
      setIsPlaying(false);
      setIsPaused(false);
      isPlayingRef.current = false;
      setCurrentChunkIndex(0);
      currentIndexRef.current = 0;
      savePosition(contentIdRef.current, 0);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chks[index]);
    utterance.rate = rateRef.current;
    if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current;
    }

    utterance.onend = () => {
      if (!isPlayingRef.current) return;
      const nextIndex = currentIndexRef.current + 1;
      currentIndexRef.current = nextIndex;
      setCurrentChunkIndex(nextIndex);
      savePosition(contentIdRef.current, nextIndex);
      speakChunk(nextIndex);
    };

    utterance.onerror = (e) => {
      // "interrupted" is expected when we cancel, don't treat as error
      if (e.error === "interrupted" || e.error === "canceled") return;
      console.warn("TTS error:", e.error);
      setIsPlaying(false);
      setIsPaused(false);
      isPlayingRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const play = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();

    const savedPos = loadSavedPosition(contentId);
    const startIndex = savedPos < chunksRef.current.length ? savedPos : 0;

    currentIndexRef.current = startIndex;
    setCurrentChunkIndex(startIndex);
    isPlayingRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);

    speakChunk(startIndex);
  }, [isSupported, contentId, speakChunk]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    isPlayingRef.current = false;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    savePosition(contentIdRef.current, currentIndexRef.current);
  }, [isSupported]);

  const skipForward = useCallback(() => {
    if (!isSupported || !isPlayingRef.current) return;
    const skip = getChunkSkipCount(chunksRef.current);
    const newIndex = Math.min(
      currentIndexRef.current + skip,
      chunksRef.current.length - 1
    );
    currentIndexRef.current = newIndex;
    setCurrentChunkIndex(newIndex);
    savePosition(contentIdRef.current, newIndex);
    window.speechSynthesis.cancel();
    speakChunk(newIndex);
  }, [isSupported, speakChunk]);

  const skipBackward = useCallback(() => {
    if (!isSupported || !isPlayingRef.current) return;
    const skip = getChunkSkipCount(chunksRef.current);
    const newIndex = Math.max(currentIndexRef.current - skip, 0);
    currentIndexRef.current = newIndex;
    setCurrentChunkIndex(newIndex);
    savePosition(contentIdRef.current, newIndex);
    window.speechSynthesis.cancel();
    speakChunk(newIndex);
  }, [isSupported, speakChunk]);

  const seekTo = useCallback(
    (seekProgress: number) => {
      if (!isSupported) return;
      const newIndex = Math.min(
        Math.floor(seekProgress * chunksRef.current.length),
        chunksRef.current.length - 1
      );
      currentIndexRef.current = Math.max(0, newIndex);
      setCurrentChunkIndex(currentIndexRef.current);
      savePosition(contentIdRef.current, currentIndexRef.current);
      if (isPlayingRef.current) {
        window.speechSynthesis.cancel();
        speakChunk(currentIndexRef.current);
      }
    },
    [isSupported, speakChunk]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      isPlayingRef.current = false;
    };
  }, []);

  return {
    isPlaying,
    isPaused,
    progress,
    currentChunkIndex,
    totalChunks,
    elapsedTime,
    totalTime,
    currentText,
    availableVoices,
    selectedVoice,
    setSelectedVoice,
    play,
    pause,
    resume,
    stop,
    skipForward,
    skipBackward,
    seekTo,
    isSupported,
    hasSavedPosition,
  };
}
