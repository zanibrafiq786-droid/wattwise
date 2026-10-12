// The firmware writes all timestamps (state.updated_at, events[].ts,
// alerts[].ts) as unix milliseconds (Date.now()-style), not unix seconds.
// Every screen formats time through this file so that fact lives in one
// place.
export function timeAgo(unixMs: number): string {
  const diffSeconds = (Date.now() - unixMs) / 1000;
  if (diffSeconds < 60) return `${Math.max(0, Math.floor(diffSeconds))}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

// "7 min", "2 h 5 min" -- how long something has been going on.
export function durationSince(unixMs: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - unixMs) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}
