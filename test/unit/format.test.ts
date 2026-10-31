// The formatters as a consumer imports them: the package's ./format.js export, which resolves to
// the dist/ mise run build wrote. Every case pins its locale, en-US, and a date's time zone, UTC.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { RelativeOptions } from "@jaimestill/spike-html-apps-foundation/format.js";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatDuration,
  formatRelative,
} from "@jaimestill/spike-html-apps-foundation/format.js";

const LOCALE = "en-US";
const UTC = { timeZone: "UTC" };

describe("formatBytes", () => {
  test("picks the largest base-1000 unit that keeps the value at 1 or more", () => {
    assert.equal(formatBytes(0, LOCALE), "0 bytes");
    assert.equal(formatBytes(999, LOCALE), "999 bytes");
    assert.equal(formatBytes(1000, LOCALE), "1 kB");
    assert.equal(formatBytes(1500, LOCALE), "1.5 kB");
    assert.equal(formatBytes(2.5e6, LOCALE), "2.5 MB");
    assert.equal(formatBytes(1e9, LOCALE), "1 GB");
    assert.equal(formatBytes(1e12, LOCALE), "1 TB");
    assert.equal(formatBytes(1e15, LOCALE), "1 PB");
    // Past a petabyte it stays in petabytes.
    assert.equal(formatBytes(2e18, LOCALE), "2,000 PB");
  });

  test("steps a negative count by its magnitude", () => {
    assert.equal(formatBytes(-1500, LOCALE), "-1.5 kB");
  });

  test("words the byte unit in full, so Intl pluralizes it", () => {
    assert.equal(formatBytes(0, LOCALE), "0 bytes");
    assert.equal(formatBytes(1, LOCALE), "1 byte");
    assert.equal(formatBytes(13, LOCALE), "13 bytes");
    assert.equal(formatBytes(999, LOCALE), "999 bytes");
    // The units above it stay short.
    assert.equal(formatBytes(1000, LOCALE), "1 kB");
  });

  test("leaves the byte unit's plural and its word to the locale", () => {
    // French's short byte unit is "o", whatever the count; its long one pluralizes. French sets
    // the byte unit off by a no-break space and the short ones by a narrow no-break space.
    assert.equal(formatBytes(1, "fr"), "1\u00a0octet");
    assert.equal(formatBytes(13, "fr"), "13\u00a0octets");
    assert.equal(formatBytes(1500, "fr"), "1,5\u202fko");
  });

  test("keeps a caller's unitDisplay for the byte unit too", () => {
    assert.equal(formatBytes(13, LOCALE, { unitDisplay: "short" }), "13 byte");
    assert.equal(formatBytes(13, LOCALE, { unitDisplay: "narrow" }), "13B");
  });

  // An independent byte formatter, stepping by log10 to at most gigabytes at one fraction digit,
  // the byte unit long and the others short, for the counts it handles: none past a gigabyte's
  // unit, none negative.
  const entryUnits = ["byte", "kilobyte", "megabyte", "gigabyte"].map(
    (unit) =>
      new Intl.NumberFormat(LOCALE, {
        style: "unit",
        unit,
        unitDisplay: unit === "byte" ? "long" : "short",
        maximumFractionDigits: 1,
      }),
  );
  const entrySize = (bytes: number) => {
    const step = Math.min(Math.floor(Math.log10(Math.max(bytes, 1)) / 3), entryUnits.length - 1);
    return entryUnits[step].format(bytes / 1000 ** step);
  };

  test("its defaults print what an independent one-fraction-digit formatter prints", () => {
    const counts = [0, 1, 999, 1000, 1049, 1050, 12_345, 999_949, 999_950, 1e6, 123_456_789, 4.2e9];
    for (const bytes of counts)
      assert.equal(formatBytes(bytes, LOCALE), entrySize(bytes), String(bytes));
  });

  test("passes the caller's other NumberFormat options through", () => {
    assert.equal(formatBytes(1234, LOCALE, { maximumFractionDigits: 3 }), "1.234 kB");
    assert.equal(formatBytes(1500, LOCALE, { unitDisplay: "long" }), "1.5 kilobytes");
    assert.equal(formatBytes(1000, LOCALE, { minimumFractionDigits: 2 }), "1.00 kB");
  });

  test("keeps its own style and unit over a caller's", () => {
    // BytesOptions omits both, so it's a caller holding a whole NumberFormatOptions that passes them.
    const theirs: Intl.NumberFormatOptions = { style: "percent", unit: "meter" };
    assert.equal(formatBytes(1500, LOCALE, theirs), "1.5 kB");
  });
});

// 2026-03-04 05:06:07 UTC.
const moment = Date.UTC(2026, 2, 4, 5, 6, 7);

describe("formatDate and formatDateTime", () => {
  test("formatDate defaults to dateStyle medium", () => {
    assert.equal(formatDate(moment, LOCALE, UTC), "Mar 4, 2026");
    assert.equal(formatDate(new Date(moment), LOCALE, UTC), "Mar 4, 2026");
  });

  test("formatDateTime adds timeStyle short", () => {
    assert.equal(formatDateTime(moment, LOCALE, UTC), "Mar 4, 2026, 5:06 AM");
  });

  test("a caller's own field replaces the defaults instead of throwing", () => {
    assert.equal(formatDate(moment, LOCALE, { year: "numeric", ...UTC }), "2026");
    assert.equal(formatDateTime(moment, LOCALE, { hour: "numeric", ...UTC }), "5 AM");
    const fields = {
      month: "long",
      day: "2-digit",
      weekday: "short",
      era: "short",
      minute: "numeric",
      second: "numeric",
      fractionalSecondDigits: 2,
      dayPeriod: "narrow",
      timeZoneName: "short",
    };
    for (const [field, value] of Object.entries(fields)) {
      const options = { [field]: value, ...UTC };
      assert.doesNotThrow(() => formatDate(moment, LOCALE, options), field);
      assert.doesNotThrow(() => formatDateTime(moment, LOCALE, options), field);
    }
  });

  test("a caller's style replaces the default style it names", () => {
    assert.equal(formatDate(moment, LOCALE, { dateStyle: "short", ...UTC }), "3/4/26");
    assert.equal(formatDateTime(moment, LOCALE, { dateStyle: "short", ...UTC }), "3/4/26, 5:06 AM");
  });
});

const SECOND = 1000;
const DAY = 86_400 * SECOND;

describe("formatRelative", () => {
  /** `offset` milliseconds from a fixed now, formatted relative to it. */
  const relative = (offset: number, options: RelativeOptions = {}) =>
    formatRelative(moment + offset, LOCALE, { now: moment, ...options });

  test("seconds up to a minute, then the largest whole unit", () => {
    assert.equal(relative(-59 * SECOND), "59 seconds ago");
    assert.equal(relative(-60 * SECOND), "1 minute ago");
    assert.equal(relative(-60 * 60 * SECOND), "1 hour ago");
    assert.equal(relative(-DAY), "1 day ago");
    assert.equal(relative(-6 * DAY), "6 days ago");
    assert.equal(relative(-7 * DAY), "1 week ago");
    assert.equal(relative(-29 * DAY), "4 weeks ago");
    assert.equal(relative(-30 * DAY), "1 month ago");
    assert.equal(relative(-364 * DAY), "12 months ago");
    assert.equal(relative(-365 * DAY), "1 year ago");
  });

  test("works in the future, as in the past", () => {
    assert.equal(relative(59 * SECOND), "in 59 seconds");
    assert.equal(relative(60 * SECOND), "in 1 minute");
    assert.equal(relative(7 * DAY), "in 1 week");
    assert.equal(relative(30 * DAY), "in 1 month");
    assert.equal(relative(365 * DAY), "in 1 year");
  });

  test("truncates toward zero", () => {
    assert.equal(relative(-119 * SECOND), "1 minute ago");
    assert.equal(relative(119 * SECOND), "in 1 minute");
    assert.equal(relative(-1500), "1 second ago");
    assert.equal(relative(0), "in 0 seconds");
  });

  test("takes now as a Date, and passes RelativeTimeFormat's options through", () => {
    const now = new Date(moment);
    assert.equal(formatRelative(moment - DAY, LOCALE, { now }), "1 day ago");
    assert.equal(relative(-DAY, { numeric: "auto" }), "yesterday");
    assert.equal(relative(-2 * DAY, { style: "short" }), "2 days ago");
  });

  test("is relative to the current time without now", () => {
    assert.equal(formatRelative(Date.now() - 3 * DAY - 1000, LOCALE), "3 days ago");
    assert.equal(formatRelative(new Date(Date.now() + 2 * DAY + 60_000), LOCALE), "in 2 days");
  });
});

describe("formatDuration", () => {
  test("zero and anything under a second print zero seconds", () => {
    assert.equal(formatDuration(0, LOCALE), "0 sec");
    assert.equal(formatDuration(999, LOCALE), "0 sec");
    assert.equal(formatDuration(-999, LOCALE), "0 sec");
  });

  test("whole seconds, the fraction rounded down", () => {
    assert.equal(formatDuration(1000, LOCALE), "1 sec");
    assert.equal(formatDuration(1999, LOCALE), "1 sec");
  });

  test("splits into days, hours, minutes, and seconds", () => {
    const span = 2 * DAY + 3 * 3_600_000 + 4 * 60_000 + 5 * SECOND + 678;
    assert.equal(formatDuration(span, LOCALE), "2 days, 3 hr, 4 min, 5 sec");
    assert.equal(formatDuration(90 * 60_000, LOCALE), "1 hr, 30 min");
    assert.equal(formatDuration(-90 * 60_000, LOCALE), "-1 hr, 30 min");
  });

  test("takes Intl.DurationFormat's style", () => {
    const span = 3_600_000 + 5 * SECOND;
    assert.equal(formatDuration(span, LOCALE, { style: "long" }), "1 hour, 5 seconds");
    assert.equal(formatDuration(span, LOCALE, { style: "narrow" }), "1h 5s");
    assert.equal(formatDuration(span, LOCALE, { style: "digital" }), "1:00:05");
    assert.equal(formatDuration(0, LOCALE, { style: "long" }), "0 seconds");
  });
});
