"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  splitIntoChunks,
  estimateDuration,
  estimateElapsedTime,
  getChunkSkipCount,
} from "@/lib/tts-utils";

const POSITION_KEY_PREFIX = "mornin-tts-pos-";
const VOICE_KEY = "mornin-tts-voice";

interface TTSPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  progress: number;
  currentChunkIndex: number;
  totalChunks: number;
  elapsedTime: number;
  totalTime: number;
  currentText: string;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
}

interface TTSContextValue {
  // Content info
  isActive: boolean;
  title: string;
  author: string;
  activeContentId: string;
  // Playback state
  state: TTSPlaybackState;
  // Controls — these are called from UI (not from user gesture necessarily)
  playPause: () => void;
  stop: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  seekTo: (progress: number) => void;
  setVoice: (voice: SpeechSynthesisVoice) => void;
  // Called from click handler (user gesture) to start a new piece
  startPlaying: (opts: {
    text: string;
    contentId: string;
    title: string;
    author: string;
    isPoetry?: boolean;
  }) => void;
  close: () => void;
  // Utility
  isSupported: boolean;
  hasSavedPosition: (contentId: string) => boolean;
}

const TTSContext = createContext<TTSContextValue | null>(null);

export function useTTSContext(): TTSContextValue {
  const ctx = useContext(TTSContext);
  if (!ctx) throw new Error("useTTSContext must be used within TTSProvider");
  return ctx;
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

export function TTSProvider({ children }: { children: ReactNode }) {
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Content state
  const [contentTitle, setContentTitle] = useState("");
  const [contentAuthor, setContentAuthor] = useState("");
  const [activeContentId, setActiveContentId] = useState("");
  const [isActive, setIsActive] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

  // Refs for stable callbacks
  const chunksRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const contentIdRef = useRef("");
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Check support
  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Load voices
  useEffect(() => {
    if (!isSupported) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        const savedName = loadSavedVoiceName();
        const saved = savedName ? voices.find((v) => v.name === savedName) : null;
        const defaultVoice = saved || voices.find((v) => v.default) || voices[0];
        setSelectedVoice(defaultVoice);
        selectedVoiceRef.current = defaultVoice;
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [isSupported]);

  // Speak a chunk and chain to next
  const speakChunk = useCallback((index: number) => {
    const chks = chunksRef.current;
    if (index >= chks.length || !isPlayingRef.current) {
      setIsPlaying(false);
      setIsPaused(false);
      isPlayingRef.current = false;
      setCurrentChunkIndex(0);
      currentIndexRef.current = 0;
      savePosition(contentIdRef.current, 0);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chks[index]);
    utterance.rate = 1;
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
      if (e.error === "interrupted" || e.error === "canceled") return;
      console.warn("TTS error:", e.error);
      setIsPlaying(false);
      setIsPaused(false);
      isPlayingRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // Start playing — MUST be called from user click handler for iOS
  const startPlaying = useCallback(
    (opts: {
      text: string;
      contentId: string;
      title: string;
      author: string;
      isPoetry?: boolean;
    }) => {
      if (!isSupported) return;

      // Stop any current playback
      isPlayingRef.current = false;
      window.speechSynthesis.cancel();

      const chunks = splitIntoChunks(opts.text, opts.isPoetry);
      if (chunks.length === 0) return;

      // Set content info
      chunksRef.current = chunks;
      contentIdRef.current = opts.contentId;
      setContentTitle(opts.title);
      setContentAuthor(opts.author);
      setActiveContentId(opts.contentId);
      setIsActive(true);

      // Resume from saved position or start
      const savedPos = loadSavedPosition(opts.contentId);
      const startIndex = savedPos > 0 && savedPos < chunks.length ? savedPos : 0;
      currentIndexRef.current = startIndex;
      setCurrentChunkIndex(startIndex);
      isPlayingRef.current = true;
      setIsPlaying(true);
      setIsPaused(false);

      // Speak first chunk directly in click handler (iOS requirement)
      speakChunk(startIndex);
    },
    [isSupported, speakChunk]
  );

  const playPause = useCallback(() => {
    if (!isSupported) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } else {
      // Restart from current position
      isPlayingRef.current = true;
      setIsPlaying(true);
      setIsPaused(false);
      speakChunk(currentIndexRef.current);
    }
  }, [isSupported, isPaused, isPlaying, speakChunk]);

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
    const newIndex = Math.min(currentIndexRef.current + skip, chunksRef.current.length - 1);
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
      const newIndex = Math.max(
        0,
        Math.min(
          Math.floor(seekProgress * chunksRef.current.length),
          chunksRef.current.length - 1
        )
      );
      currentIndexRef.current = newIndex;
      setCurrentChunkIndex(newIndex);
      savePosition(contentIdRef.current, newIndex);
      if (isPlayingRef.current) {
        window.speechSynthesis.cancel();
        speakChunk(newIndex);
      }
    },
    [isSupported, speakChunk]
  );

  const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice);
    selectedVoiceRef.current = voice;
    saveVoiceName(voice.name);
  }, []);

  const close = useCallback(() => {
    isPlayingRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    savePosition(contentIdRef.current, currentIndexRef.current);
    setIsActive(false);
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const hasSavedPosition = useCallback((contentId: string) => {
    try {
      const val = localStorage.getItem(POSITION_KEY_PREFIX + contentId);
      return val !== null && parseInt(val, 10) > 0;
    } catch {
      return false;
    }
  }, []);

  // Compute derived state
  const chunks = chunksRef.current;
  const totalChunks = chunks.length;
  const totalTime = estimateDuration(chunks);
  const elapsedTime = estimateElapsedTime(chunks, currentChunkIndex);
  const progress = totalChunks > 0 ? currentChunkIndex / totalChunks : 0;
  const currentText = chunks[currentChunkIndex] || "";

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const value: TTSContextValue = {
    isActive,
    title: contentTitle,
    author: contentAuthor,
    activeContentId,
    state: {
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
    },
    playPause,
    stop,
    skipForward,
    skipBackward,
    seekTo,
    setVoice,
    startPlaying,
    close,
    isSupported,
    hasSavedPosition,
  };

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
}
