"use client";

import { ReactNode, useEffect } from "react";
import { TTSProvider } from "@/components/TTSContext";
import { LibraryAudioProvider } from "@/components/library/LibraryAudioContext";
import AudioPlayerBar from "@/components/AudioPlayerBar";
import LibraryAudioPlayer from "@/components/library/LibraryAudioPlayer";
import BottomTabBar from "@/components/BottomTabBar";

export default function ClientShell({ children }: { children: ReactNode }) {
  // Request persistent storage so the browser won't evict our IndexedDB data
  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }, []);

  return (
    <TTSProvider>
      <LibraryAudioProvider>
        {children}
        <AudioPlayerBar />
        <LibraryAudioPlayer />
        <BottomTabBar />
      </LibraryAudioProvider>
    </TTSProvider>
  );
}
