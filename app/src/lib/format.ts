import type { MinutesOfDay } from "./convert";

/** 12-hour clock with am/pm, no leading zero on hour. */
export function format12h(minutes: MinutesOfDay): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const period = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatRange(startText: string, endText?: string): string {
  if (!endText) return startText;
  return `${startText} – ${endText}`;
}
