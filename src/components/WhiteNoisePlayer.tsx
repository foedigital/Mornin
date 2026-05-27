"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function generateBrownNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const frameCount = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frameCount; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = Math.max(-1, Math.min(1, last * 3.5));
  }
  return buffer;
}

export default function WhiteNoisePlayer() {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    const AudioCtx = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.55;
    gain.connect(ctx.destination);
    gainRef.current = gain;
    bufferRef.current = generateBrownNoise(ctx, 30);
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch {}
        sourceRef.current = null;
      }
      ctx.close();
    };
  }, []);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    setPlaying(false);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  }, []);

  const start = useCallback(() => {
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    const gain = gainRef.current;
    if (!ctx || !buffer || !gain) return;
    if (ctx.state === "suspended") ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    sourceRef.current = source;
    setPlaying(true);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Brown Noise",
        artist: "Mornin",
      });
      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.setActionHandler("pause", stop);
      navigator.mediaSession.setActionHandler("stop", stop);
    }
  }, [stop]);

  const toggle = useCallback(() => {
    if (playing) stop();
    else start();
  }, [playing, start, stop]);

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`transition-opacity ${playing ? "opacity-100" : "opacity-40"}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
              <path d="M3 18c0-3.3 2.7-6 6-6h.5A6.5 6.5 0 0 1 16 6a6.5 6.5 0 0 1 6.5 6.5" strokeLinecap="round"/>
              <path d="M7 18v2M10 17v3M13 18v2M16 17v3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
              Brown Noise
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {playing ? "Playing — continues with screen locked" : "Tap to start"}
            </p>
          </div>
        </div>

        <button
          onClick={toggle}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            playing
              ? "bg-accent text-white shadow-lg shadow-accent/30"
              : "bg-white/10 text-gray-400"
          }`}
          aria-label={playing ? "Stop brown noise" : "Start brown noise"}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="4" height="10" rx="1" />
              <rect x="9" y="3" width="4" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2.5l10 5.5-10 5.5V2.5z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
