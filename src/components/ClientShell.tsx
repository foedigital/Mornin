"use client";

import { ReactNode } from "react";
import { TTSProvider } from "@/components/TTSContext";
import { LibraryAudioProvider } from "@/components/library/LibraryAudioContext";
import AudioPlayerBar from "@/components/AudioPlayerBar";
import LibraryAudioPlayer from "@/components/library/LibraryAudioPlayer";
import BottomTabBar from "@/components/BottomTabBar";

export default function ClientShell({ children }: { children: ReactNode }) {
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
