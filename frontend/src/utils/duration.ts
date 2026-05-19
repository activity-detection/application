const ISO_DURATION_PATTERN =
  /^(-)?P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Parses an ISO-8601 duration string (as produced by Java's {@code Duration#toString()},
 * e.g. {@code PT0S}, {@code PT1M5.5S}, {@code PT1H2M}) into a number of seconds.
 *
 * Returns {@code null} if the input is undefined, empty, or does not match the expected
 * subset of ISO-8601 (days + hours + minutes + seconds, optionally negative). This is
 * the subset the backend produces for video event timestamps.
 */
export function parseIsoDurationToSeconds(input?: string | null): number | null {
  if (!input) {
    return null;
  }

  const match = ISO_DURATION_PATTERN.exec(input);
  if (!match) {
    return null;
  }

  const [, sign, daysRaw, hoursRaw, minutesRaw, secondsRaw] = match;

  const days = daysRaw ? Number.parseFloat(daysRaw) : 0;
  const hours = hoursRaw ? Number.parseFloat(hoursRaw) : 0;
  const minutes = minutesRaw ? Number.parseFloat(minutesRaw) : 0;
  const seconds = secondsRaw ? Number.parseFloat(secondsRaw) : 0;

  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  return sign === "-" ? -total : total;
}

/**
 * Formats a number of seconds as {@code H:MM:SS} (or {@code M:SS} for durations under an
 * hour). Used for timeline tooltips.
 */
export function formatSecondsAsClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0:00";
  }

  const whole = Math.floor(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;

  const pad = (value: number) => value.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}
