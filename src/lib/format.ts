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

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/sv";

dayjs.extend(relativeTime);
dayjs.locale("sv");

export function formatRelativeTime(
  date: Date | string | number | undefined,
  locale: string = "sv",
) {
  if (!date) return "";
  try {
    return dayjs(date).fromNow();
  } catch (_err) {
    return "";
  }
}
