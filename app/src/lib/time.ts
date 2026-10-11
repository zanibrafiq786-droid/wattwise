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
