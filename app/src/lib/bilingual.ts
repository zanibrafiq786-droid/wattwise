// The month-end AI report (brain/report.py) writes every piece twice: the
// explanation as "English paragraph, blank line, Roman Urdu paragraph", and
// each plan step as "English sentence -- Roman Urdu sentence". The app shows
// only the half that matches the chosen language.

export function pickReportText(text: string, language: string): string {
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return text.trim();
  // English comes first, Roman Urdu second (half and half if there are more).
  const half = Math.ceil(parts.length / 2);
  return (language === "ur" ? parts.slice(half) : parts.slice(0, half)).join("\n\n");
}

export function pickPlanStep(step: string, language: string): string {
  const [en, ur] = step.split(/\s+(?:--|—|–)\s+/);
  return (language === "ur" ? ur ?? en : en).trim();
}
