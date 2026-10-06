/**
 * The Profile tab's limits and choices, shared by `settings.saveProfile` and
 * 17 and 19. Pure (no imports), so `src` may import it (eslint allowlist).
 */

/** A display name is one line of a person's own choosing, not an identity claim. */
export const MAX_DISPLAY_NAME = 40;

export const MAX_JOB_TITLE = 60;

/**
 * R-h: whole-hour zones only, so a protected hour never starts at half past.
 * Adelaide, Darwin, Kolkata and Lord Howe are left out on purpose. Each label
 * is true all year: a zone with daylight saving names both abbreviations (the
 * PNG's "Sydney (AEST)" is wrong from October to April).
 */
export const TIME_ZONES = [
  "Australia/Melbourne",
  "Australia/Sydney",
  "Australia/Brisbane",
  "Australia/Perth",
  "Pacific/Auckland",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;
export type TimeZone = (typeof TIME_ZONES)[number];

export const TIME_ZONE_LABELS: Record<TimeZone, string> = {
  "Australia/Melbourne": "Australia/Melbourne (AEST/AEDT)",
  "Australia/Sydney": "Australia/Sydney (AEST/AEDT)",
  "Australia/Brisbane": "Australia/Brisbane (AEST)",
  "Australia/Perth": "Australia/Perth (AWST)",
  "Pacific/Auckland": "Pacific/Auckland (NZST/NZDT)",
  "Asia/Singapore": "Asia/Singapore (SGT)",
  "Asia/Tokyo": "Asia/Tokyo (JST)",
  "Europe/London": "Europe/London (GMT/BST)",
  "America/New_York": "America/New_York (EST/EDT)",
  "America/Los_Angeles": "America/Los_Angeles (PST/PDT)",
  UTC: "UTC",
};

/** The time zone select's options, on 17, 18 and 19. */
export const TIME_ZONE_OPTIONS = TIME_ZONES.map((zone) => ({
  value: zone,
  label: TIME_ZONE_LABELS[zone],
}));
