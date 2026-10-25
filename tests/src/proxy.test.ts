import { expect, test } from "vitest";
import { PRIVATE } from "@/proxy";

// L1: the lookahead is the only thing keeping /careers/* private, so every
// path that matters is pinned here. Anything under /careers that is not
// exactly a map page fails closed.
test.each([
  "/manager",
  "/manager/learning",
  "/me",
  "/me/settings",
  "/settings",
  "/workspace/settings",
  "/setup",
  "/setup/team",
  "/guide",
  "/home",
  "/join/preview",
  "/tracks",
  "/tracks/private/new",
  "/careers",
  "/careers/",
  "/careers/journey",
  "/careers/proof",
  "/careers/settings",
  "/careers/mapx",
  "/careers/map/x",
  "/careers/map/new/x",
  "/careers//map",
  "/careers/MAP",
])("%s is private", (path) => expect(PRIVATE.test(path)).toBe(true));

test.each([
  "/",
  "/start",
  "/login",
  "/signup",
  "/join/abc",
  "/signed-out",
  "/careers/map",
  "/careers/map/",
  "/careers/map/new",
  "/careers/map/new/",
  "/proof/abc123",
  "/careersx",
  "/homework",
])("%s is public", (path) => expect(PRIVATE.test(path)).toBe(false));
