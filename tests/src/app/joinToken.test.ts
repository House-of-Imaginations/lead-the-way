import { expect, test } from "vitest";
import { joinTokenOf } from "../../../src/app/setup/start/joinToken";

test.each([
  ["/join/abc", "abc"],
  ["/join/abc/", "abc"],
  ["/join/abc?x=1", "abc"],
  ["/join/abc#top", "abc"],
  ["/join/abc/def", undefined],
  ["/join/", undefined],
  ["/elsewhere/abc", undefined],
  ["https://evil.test/join/abc", undefined],
  [undefined, undefined],
  [["/join/abc"], undefined],
])("joinTokenOf(%j) is %j", (next, token) => {
  expect(joinTokenOf(next)).toBe(token);
});
