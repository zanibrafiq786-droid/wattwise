// "YYYY-MM" month-key helpers shared by the bill screens.
const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function monthName(key: string) {
  const [y, m] = key.split("-");
  return `${LONG[parseInt(m, 10) - 1] ?? m} ${y}`;
}

// The month whose bill should be the "current" one: the month that just
// ended. The running month can't have a bill yet.
export function lastCompletedMonth() {
  return shiftMonth(currentMonthKey(), -1);
}
