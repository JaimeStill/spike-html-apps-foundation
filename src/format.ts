// The foundation's Intl formatters: byte counts, dates, relative times, and durations, on the
// platform's Intl alone, no package and no other layer.
// Adapted from spike-html-packages-foundation (5dd8a58): src/format.d.ts, its declarations given a
// runtime. test/fixtures/v0.1.0/format.d.ts is that file, which the emitted declaration matches.

/** Options for formatBytes: Intl.NumberFormat's, less its style and unit, which it sets. */
export type BytesOptions = Omit<Intl.NumberFormatOptions, "style" | "unit">;

// The byte units Intl.NumberFormat sanctions, smallest first: unit i is 1000 ** i bytes.
const byteUnits = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte"];

/** A byte count in SI units, base 1000 (kB, MB, GB, ...), with Intl.NumberFormat's byte units. */
export function formatBytes(
  bytes: number,
  locale?: Intl.LocalesArgument,
  options?: BytesOptions,
): string {
  // The largest unit that keeps the value at 1 or more, by its magnitude, so a negative count
  // steps as its positive does; anything under 1 kB, NaN included, stays in bytes.
  let step = 0;
  while (step < byteUnits.length - 1 && Math.abs(bytes) >= 1000 ** (step + 1)) step++;
  // At most one fraction digit by default, unless the caller sets either bound: a minimum above a
  // default maximum would throw.
  const fraction =
    options?.minimumFractionDigits === undefined && options?.maximumFractionDigits === undefined
      ? { maximumFractionDigits: 1 }
      : {};
  // The byte unit long by default, so Intl words and pluralizes it ("1 byte", "13 bytes"): en-US's
  // short byte is "byte" at every count. The units above it stay short ("1.5 kB"). A caller's own
  // unitDisplay wins at every unit.
  return new Intl.NumberFormat(locale, {
    unitDisplay: step === 0 ? "long" : "short",
    ...fraction,
    ...options,
    style: "unit",
    unit: byteUnits[step],
  }).format(bytes / 1000 ** step);
}

// The options that set a date or time field one by one, which Intl.DateTimeFormat refuses to mix
// with dateStyle or timeStyle.
const dateTimeFields = [
  "year",
  "month",
  "day",
  "weekday",
  "era",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "dayPeriod",
  "timeZoneName",
] as const;

/** `options` over `styles`, the styles dropped when `options` sets any field of its own. */
function withStyles(
  styles: Intl.DateTimeFormatOptions,
  options: Intl.DateTimeFormatOptions = {},
): Intl.DateTimeFormatOptions {
  const fields = dateTimeFields.some((field) => options[field] !== undefined);
  return fields ? options : { ...styles, ...options };
}

/** A calendar date, dateStyle "medium" by default. */
export function formatDate(
  date: Date | number,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, withStyles({ dateStyle: "medium" }, options)).format(date);
}

/** A date and time, dateStyle "medium" and timeStyle "short" by default. */
export function formatDateTime(
  date: Date | number,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string {
  const styles: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  return new Intl.DateTimeFormat(locale, withStyles(styles, options)).format(date);
}

/** Options for formatRelative: Intl.RelativeTimeFormat's, and the moment it is relative to, the
 * current time by default. */
export interface RelativeOptions extends Intl.RelativeTimeFormatOptions {
  now?: Date | number;
}

const second = 1000;
const day = 86_400 * second;
// The relative units, largest first, each a fixed length: a month is 30 days and a year 365.
const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * day],
  ["month", 30 * day],
  ["week", 7 * day],
  ["day", day],
  ["hour", 3_600 * second],
  ["minute", 60 * second],
  ["second", second],
];

/** A date relative to now in its largest whole unit ("3 days ago", "in 2 hours"). */
export function formatRelative(
  date: Date | number,
  locale?: Intl.LocalesArgument,
  options?: RelativeOptions,
): string {
  const { now = Date.now(), ...format } = options ?? {};
  const difference = Number(date) - Number(now);
  // The largest unit the difference fills once, seconds when it fills none; truncated toward zero,
  // so 59 seconds is 59 seconds and 89 seconds is 1 minute, either way in time.
  const [unit, length] = relativeUnits.find(([, length]) => Math.abs(difference) >= length) ?? [
    "second",
    second,
  ];
  return new Intl.RelativeTimeFormat(locale, format).format(Math.trunc(difference / length), unit);
}

/** Options for formatDuration: Intl.DurationFormat's style, "short" by default. */
export interface DurationOptions {
  style?: "long" | "short" | "narrow" | "digital";
}

/** A duration given in milliseconds, in days, hours, minutes, and seconds, by Intl.DurationFormat. */
export function formatDuration(
  milliseconds: number,
  locale?: Intl.LocalesArgument,
  options?: DurationOptions,
): string {
  // Whole seconds, the fraction dropped toward zero, split into fields that share its sign, as
  // Intl.DurationFormat requires; `|| 0` turns a negative zero into zero.
  const total = Math.trunc(milliseconds / second);
  const duration = {
    days: Math.trunc(total / 86_400) || 0,
    hours: Math.trunc((total % 86_400) / 3_600) || 0,
    minutes: Math.trunc((total % 3_600) / 60) || 0,
    seconds: total % 60 || 0,
  };
  // Intl.DurationFormat prints "" when every field is zero, so a zero duration shows its seconds.
  const zero = total === 0 ? { secondsDisplay: "always" as const } : {};
  return new Intl.DurationFormat(locale, { style: "short", ...options, ...zero }).format(duration);
}
