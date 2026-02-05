// === Battle of the Day (Wikipedia) ===

export interface BattleEvent {
  text: string;
  year: number;
  thumbnail?: string;
  wikiUrl?: string;
}

const MILITARY_KEYWORDS = [
  "battle", "war", "military", "army", "invasion", "siege",
  "attacked", "defeated", "conquered", "revolution", "revolt",
  "forces", "troops", "surrender", "campaign", "offensive",
  "naval", "bombing", "raid", "occupation", "liberation",
];

export async function fetchBattleOfTheDay(): Promise<BattleEvent | null> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const events = data.events || [];

    // Filter for military/battle events
    const battles = events.filter((e: { text: string }) =>
      MILITARY_KEYWORDS.some((kw) => e.text.toLowerCase().includes(kw))
    );

    // Pick a battle, or fall back to any event
    const source = battles.length > 0 ? battles : events;
    if (source.length === 0) return null;

    // Pick based on day of year for consistency
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const event = source[dayOfYear % source.length];

    const page = event.pages?.[0];
    return {
      text: event.text,
      year: event.year,
      thumbnail: page?.thumbnail?.source,
      wikiUrl: page?.content_urls?.desktop?.page,
    };
  } catch {
    return null;
  }
}

// === Daily Gospel (Evangelizo) ===

export interface GospelReading {
  reference: string;
  text: string;
}

export async function fetchDailyGospel(): Promise<GospelReading | null> {
  const now = new Date();
  const dateStr =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  try {
    const [refRes, textRes] = await Promise.all([
      fetch(
        `https://feed.evangelizo.org/v2/reader.php?date=${dateStr}&type=reading_st&lang=AM&content=GSP`
      ),
      fetch(
        `https://feed.evangelizo.org/v2/reader.php?date=${dateStr}&type=reading&lang=AM&content=GSP`
      ),
    ]);

    if (!refRes.ok || !textRes.ok) return null;

    const reference = (await refRes.text()).trim();
    const rawText = (await textRes.text()).trim();

    // Clean up HTML tags from the response
    const text = rawText
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/Copyright[\s\S]*$/, "")
      .trim();

    if (!text) return null;

    return { reference, text };
  } catch {
    return null;
  }
}

// === Featured Art (Art Institute of Chicago) ===

export interface Artwork {
  title: string;
  artist: string;
  date: string;
  imageUrl: string;
  altText: string;
}

const FEATURED_ARTISTS = [
  "Van Gogh",
  "Picasso",
  "Dalí",
  "Monet",
  "Rembrandt",
  "Renoir",
  "Cézanne",
  "Degas",
  "Manet",
  "Winslow Homer",
  "Edward Hopper",
  "Georgia O'Keeffe",
];

export async function fetchFeaturedArt(): Promise<Artwork | null> {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );

  // Rotate through artists by day
  const artist = FEATURED_ARTISTS[dayOfYear % FEATURED_ARTISTS.length];

  try {
    const res = await fetch(
      `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(artist)}&limit=15&fields=id,title,artist_display,image_id,date_display,thumbnail`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const works = (data.data || []).filter(
      (w: { image_id: string | null }) => w.image_id
    );

    if (works.length === 0) return null;

    // Pick one based on day
    const work = works[dayOfYear % works.length];

    return {
      title: work.title,
      artist: work.artist_display,
      date: work.date_display,
      imageUrl: `https://www.artic.edu/iiif/2/${work.image_id}/full/843,/0/default.jpg`,
      altText: work.thumbnail?.alt_text || work.title,
    };
  } catch {
    return null;
  }
}
