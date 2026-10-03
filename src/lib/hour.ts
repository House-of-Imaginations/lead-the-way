const HOUR = 3_600_000;

/** Ruling 14: the `hour` the server sends to `viewer.shell` and `manager.overview`. */
export const hourOf = (now: number) => Math.floor(now / HOUR);

/** Milliseconds from `now` to the next top of the hour. */
export const msToNextHour = (now: number) => HOUR - (now % HOUR);
