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
import localizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/sv";

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
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

export function formatAbsolute(
  date: Date | string | number | undefined,
  pattern: string = "LLLL",
  locale: string = "sv",
) {
  if (!date) return "";
  try {
    return dayjs(date).locale(locale).format(pattern);
  } catch (_err) {
    return "";
  }
}
