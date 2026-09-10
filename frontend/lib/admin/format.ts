// Returns a string format of passed in disk space
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1000;
  let unit = 0;

  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }

  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unit]}`;
}

// Returns a string format of passed in time duration in seconds
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));

  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  const rest = total % 60;

  if (minutes < 60) return `${minutes}m ${rest.toString().padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${(minutes % 60).toString().padStart(2, "0")}m`;
}

export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

// Convert fraction to percentage
export function formatChange(change: number | null | undefined): string | null {
  if (change === null || change === undefined || !Number.isFinite(change)) return null;

  const percent = change * 100;
  const sign = percent > 0 ? "+" : "";

  return `${sign}${percent.toFixed(1)}%`;
}

export function formatShare(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

// "Sep 9" — the weekday label under a chart column
export function formatChartDay(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
