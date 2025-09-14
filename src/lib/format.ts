export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
) {
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: opts.month ?? "long",
      day: opts.day ?? "numeric",
      year: opts.year ?? "numeric",
      ...opts,
    }).format(new Date(date));
  } catch (_err) {
    return "";
  }
}

export function formatRelativeTime(
  date: Date | string | number | undefined,
  locale: string = "sv-SE",
) {
  if (!date) return "";
  try {
    const d = new Date(date).getTime();
    const now = Date.now();
    let diff = Math.round((d - now) / 1000); // seconds difference (future negative)

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
      { amount: 60, unit: "second" },
      { amount: 60, unit: "minute" },
      { amount: 24, unit: "hour" },
      { amount: 7, unit: "day" },
      { amount: 4.34524, unit: "week" }, // approx weeks per month
      { amount: 12, unit: "month" },
      { amount: Number.POSITIVE_INFINITY, unit: "year" },
    ];

    let unit: Intl.RelativeTimeFormatUnit = "second";
    for (const division of divisions) {
      if (Math.abs(diff) < division.amount) {
        return rtf.format(diff, unit);
      }
      diff = Math.round(diff / division.amount);
      unit = division.unit;
    }

    return rtf.format(diff, unit);
  } catch (_err) {
    return "";
  }
}
