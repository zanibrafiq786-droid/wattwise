// Rupee amounts that are small but real (a 12 W bulb left on for a few
// minutes is a fraction of a rupee) shouldn't round down to "0" -- show
// the actual figure, with just enough decimals to be non-zero.
export function formatRs(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 10) return n.toFixed(0);
  if (n >= 1) return n.toFixed(1);
  if (n >= 0.01) return n.toFixed(2);
  if (n >= 0.001) return n.toFixed(3);
  return "<0.001";
}
