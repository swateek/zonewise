/** Minutes from midnight (0–1439). */
export type MinutesOfDay = number;

export type OffsetKind = "standard" | "daylight" | "single";

export type ZoneOffsets = {
  standardMinutes: number;
  daylightMinutes: number;
  hasDst: boolean;
};

export type ConvertedLine = {
  kind: OffsetKind;
  label: string;
  startText: string;
  endText?: string;
};

export type CityResult = {
  cityId: string;
  cityName: string;
  lines: ConvertedLine[];
};

/** UTC offset in minutes east of UTC for `iana` at a given Date. */
export function getOffsetMinutes(iana: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    timeZoneName: "shortOffset",
    hour: "numeric",
  }).formatToParts(date);

  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // Formats: GMT, GMT+5, GMT+5:30, GMT-8, UTC, UTC+1
  const match = tz.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const mins = Number(match[3] ?? "0");
  return sign * (hours * 60 + mins);
}

/**
 * Sample winter (Jan 15) and summer (Jul 15) of the current year.
 * Standard = the more "winter-like" offset (smaller absolute east offset in
 * northern-hemisphere DST zones is usually standard; we take the numerically
 * lesser offset as standard when they differ, which matches most zones).
 * Southern-hemisphere DST flips seasons — we still label lesser as Standard
 * and greater as Daylight for a consistent dual display without a date.
 */
export function getZoneOffsets(
  iana: string,
  year = new Date().getFullYear(),
): ZoneOffsets {
  const jan = getOffsetMinutes(iana, new Date(Date.UTC(year, 0, 15, 12, 0, 0)));
  const jul = getOffsetMinutes(iana, new Date(Date.UTC(year, 6, 15, 12, 0, 0)));

  if (jan === jul) {
    return { standardMinutes: jan, daylightMinutes: jan, hasDst: false };
  }

  const standardMinutes = Math.min(jan, jul);
  const daylightMinutes = Math.max(jan, jul);
  return { standardMinutes, daylightMinutes, hasDst: true };
}

export function parseTimeInput(value: string): MinutesOfDay | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Parse a typed time: 12h with am/pm (`10:30 am`, `10.30pm`) or 24h (`22:30`, `1030`).
 * Bare hours without minutes or am/pm are rejected so partial typing stays invalid.
 */
export function parseFlexibleTime(value: string): MinutesOfDay | null {
  const raw = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!raw) return null;

  const match = raw.match(
    /^(\d{1,2})(?:[:.\s]?(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/,
  );
  if (!match) return null;

  let hour = Number(match[1]);
  const hasMinutes = match[2] !== undefined;
  const minute = hasMinutes ? Number(match[2]) : 0;
  const periodRaw = match[3];

  if (!hasMinutes && !periodRaw) return null;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (minute < 0 || minute > 59) return null;

  if (periodRaw) {
    const isPm = periodRaw.startsWith("p");
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12;
    if (isPm) hour += 12;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

export function formatTimeInput(minutes: MinutesOfDay): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = ((minutes % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(minutes: MinutesOfDay, delta: number): MinutesOfDay {
  return (((minutes + delta) % 1440) + 1440) % 1440;
}

/**
 * Convert wall-clock minutes in a source offset to wall-clock minutes in a target offset.
 * Both offsets are minutes east of UTC.
 */
export function convertWallMinutes(
  sourceMinutes: MinutesOfDay,
  sourceOffset: number,
  targetOffset: number,
): MinutesOfDay {
  const utc = sourceMinutes - sourceOffset;
  return addMinutes(utc, targetOffset);
}

export type ConvertRequest = {
  mode: "point" | "range";
  startMinutes: MinutesOfDay;
  endMinutes?: MinutesOfDay;
  sourceIana: string;
  targetIana: string;
  targetName: string;
  targetId: string;
};

function lineForOffset(
  kind: OffsetKind,
  label: string,
  startMinutes: MinutesOfDay,
  endMinutes: MinutesOfDay | undefined,
  sourceOffset: number,
  targetOffset: number,
  formatTime: (m: MinutesOfDay) => string,
): ConvertedLine {
  const start = convertWallMinutes(startMinutes, sourceOffset, targetOffset);
  if (endMinutes === undefined) {
    return { kind, label, startText: formatTime(start) };
  }
  const end = convertWallMinutes(endMinutes, sourceOffset, targetOffset);
  return {
    kind,
    label,
    startText: formatTime(start),
    endText: formatTime(end),
  };
}

/**
 * Convert using both STD and DST offsets of source and target.
 * For each target offset variant, pair with the matching "season" source offset
 * when both have DST (std→std, dst→dst). If only one side has DST, show both
 * target variants using the single source offset (or both source variants
 * collapsed into target's single offset as one line).
 */
export function convertForCity(
  req: ConvertRequest,
  formatTime: (m: MinutesOfDay) => string,
): CityResult {
  const source = getZoneOffsets(req.sourceIana);
  const target = getZoneOffsets(req.targetIana);
  const end = req.mode === "range" ? req.endMinutes : undefined;

  const lines: ConvertedLine[] = [];

  if (!target.hasDst && !source.hasDst) {
    lines.push(
      lineForOffset(
        "single",
        "",
        req.startMinutes,
        end,
        source.standardMinutes,
        target.standardMinutes,
        formatTime,
      ),
    );
  } else if (!target.hasDst && source.hasDst) {
    // Target fixed; source varies — show both source seasons mapped into target
    const std = lineForOffset(
      "standard",
      "Standard",
      req.startMinutes,
      end,
      source.standardMinutes,
      target.standardMinutes,
      formatTime,
    );
    const dst = lineForOffset(
      "daylight",
      "Daylight",
      req.startMinutes,
      end,
      source.daylightMinutes,
      target.standardMinutes,
      formatTime,
    );
    // If they coincide, collapse
    if (std.startText === dst.startText && std.endText === dst.endText) {
      lines.push({ ...std, kind: "single", label: "" });
    } else {
      lines.push(std, dst);
    }
  } else if (target.hasDst && !source.hasDst) {
    lines.push(
      lineForOffset(
        "standard",
        "Standard",
        req.startMinutes,
        end,
        source.standardMinutes,
        target.standardMinutes,
        formatTime,
      ),
      lineForOffset(
        "daylight",
        "Daylight",
        req.startMinutes,
        end,
        source.standardMinutes,
        target.daylightMinutes,
        formatTime,
      ),
    );
  } else {
    // Both have DST: pair seasons
    lines.push(
      lineForOffset(
        "standard",
        "Standard",
        req.startMinutes,
        end,
        source.standardMinutes,
        target.standardMinutes,
        formatTime,
      ),
      lineForOffset(
        "daylight",
        "Daylight",
        req.startMinutes,
        end,
        source.daylightMinutes,
        target.daylightMinutes,
        formatTime,
      ),
    );
  }

  return {
    cityId: req.targetId,
    cityName: req.targetName,
    lines,
  };
}
