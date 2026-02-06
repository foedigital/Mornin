"use client";

import { useState } from "react";
import { addBook, type Book } from "@/lib/library-db";

interface AddBookFormProps {
  onBookAdded: (book: Book) => void;
}

export default function AddBookForm({ onBookAdded }: AddBookFormProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server returned an invalid response. The URL may be unreachable or blocked.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to extract content");
      }

      const book: Book = {
        id: crypto.randomUUID(),
        url: url.trim(),
        title: data.title,
        author: data.author,
        chapters: data.chapters,
        dateAdded: Date.now(),
        lastPlayed: 0,
      };

      await addBook(book);
      onBookAdded(book);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card mb-6">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste article or book URL..."
          className="flex-1 bg-dark-bg border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
          disabled={loading}
          required
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="bg-accent hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed text-dark-bg font-semibold px-5 py-3 rounded-xl text-sm transition-colors whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Extracting...
            </span>
          ) : (
            "Add"
          )}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-xs mt-2">{error}</p>
      )}
    </form>
  );
}
