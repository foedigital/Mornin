"use client";

import { useEffect, useState } from "react";
import saintsData from "../../data/saints.json";

interface Saint {
  name: string;
  type: string;
  description: string;
  prayer: string;
}

export default function SaintSection() {
  const [saint, setSaint] = useState<Saint | null>(null);

  useEffect(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const key = `${mm}-${dd}` as keyof typeof saintsData.saints;
    const todaySaint = saintsData.saints[key] as Saint | undefined;
    setSaint(todaySaint || null);
  }, []);

  if (!saint) return null;

  const typeColors: Record<string, string> = {
    solemnity: "bg-accent/20 text-accent",
    feast: "bg-accent/15 text-accent-light",
    memorial: "bg-white/10 text-gray-300",
    "optional memorial": "bg-white/5 text-gray-400",
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-accent text-lg">&#9733;</span>
        <h2 className="text-accent font-semibold text-sm uppercase tracking-wider">
          Saint of the Day
        </h2>
      </div>

      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-xl font-semibold text-gray-100">{saint.name}</h3>
        <span
          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${typeColors[saint.type] || "bg-white/5 text-gray-400"}`}
        >
          {saint.type}
        </span>
      </div>

      <p className="text-gray-300 leading-relaxed mb-4">{saint.description}</p>

      <div className="bg-white/5 rounded-xl p-4 border-l-2 border-accent">
        <p className="text-gray-400 text-sm italic">&ldquo;{saint.prayer}&rdquo;</p>
      </div>
    </div>
  );
}
