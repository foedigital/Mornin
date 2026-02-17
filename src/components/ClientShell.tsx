"use client";

import { ReactNode, useEffect, useState } from "react";
import { LibraryAudioProvider } from "@/components/library/LibraryAudioContext";
import LibraryAudioPlayer from "@/components/library/LibraryAudioPlayer";
import BottomTabBar from "@/components/BottomTabBar";
import { restoreIfNeeded, startSyncListener } from "@/lib/cloud-sync";

export default function ClientShell({ children }: { children: ReactNode }) {
  const [restoring, setRestoring] = useState(false);
  const [ready, setReady] = useState(false);

  // Restore from cloud on fresh install, then start sync listener
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init() {
      try {
        setRestoring(true);
        const restored = await restoreIfNeeded();
        if (restored) {
          // Force a full re-render so components pick up restored data
          window.location.reload();
          return;
        }
      } catch (err) {
        console.warn("[cloud-sync] Restore failed:", err);
      } finally {
        setRestoring(false);
        setReady(true);
      }

      // Start listening for data changes and syncing to cloud
      cleanup = startSyncListener();
    }

    init();

    // Request persistent storage so the browser won't evict our IndexedDB data
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }

    return () => {
      cleanup?.();
    };
  }, []);

  // Show loading overlay during restore
  if (restoring || !ready) {
    return (
      <div className="fixed inset-0 bg-[#1a1a2e] flex items-center justify-center z-50">
        <div className="text-center">
          <svg
            className="w-8 h-8 text-accent animate-spin mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-gray-400 text-sm">Restoring your data...</p>
        </div>
      </div>
    );
  }

  return (
    <LibraryAudioProvider>
      {children}
      <LibraryAudioPlayer />
      <BottomTabBar />
    </LibraryAudioProvider>
  );
}
