export function getToday() {
  const now = new Date();
  return {
    dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
    month: now.toLocaleDateString("en-US", { month: "long" }),
    day: now.getDate(),
    year: now.getFullYear(),
    dayOfYear: getDayOfYear(now),
  };
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export function getFormattedDate(): string {
  const { dayOfWeek, month, day, year } = getToday();
  return `${dayOfWeek}, ${month} ${day}, ${year}`;
}
