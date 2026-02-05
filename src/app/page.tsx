"use client";

import { useEffect, useState } from "react";
import QuoteSection from "@/components/QuoteSection";
import BattleSection from "@/components/BattleSection";
import GospelSection from "@/components/GospelSection";
import SaintSection from "@/components/SaintSection";
import ArtSection from "@/components/ArtSection";
import { getToday } from "@/lib/dates";

export default function Home() {
  const [date, setDate] = useState<{
    dayOfWeek: string;
    month: string;
    day: number;
    year: number;
  } | null>(null);

  useEffect(() => {
    setDate(getToday());
  }, []);

  if (!date) return null;

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      {/* Date Header */}
      <header className="mb-8 text-center">
        <p className="text-accent font-medium text-sm uppercase tracking-widest mb-1">
          {date.dayOfWeek}
        </p>
        <h1 className="text-4xl font-bold text-gray-100">
          {date.month} {date.day}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{date.year}</p>
      </header>

      {/* Content Sections */}
      <div className="space-y-6">
        <QuoteSection />
        <BattleSection />
        <GospelSection />
        <SaintSection />
        <ArtSection />
      </div>

      <footer className="text-center mt-12 mb-4">
        <p className="text-gray-600 text-xs">Morning Motivation</p>
      </footer>
    </main>
  );
}
