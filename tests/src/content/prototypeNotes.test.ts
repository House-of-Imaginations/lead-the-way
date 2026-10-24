import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  PROTOTYPE_NOTES,
  noteFor,
  splitNoteLine,
} from "../../../src/content/prototypeNotes";

/** Every research note in screens.md, by route; the desktop screen wins (R12). */
function notesFromScreens() {
  const md = readFileSync(
    join(process.cwd(), "docs/design/wireframes/screens.md"),
    "utf8",
  );
  const notes: Record<string, { screen: string; lines: string[] }> = {};
  for (const section of md.split("\n## ").slice(1)) {
    const screen = section.slice(0, section.indexOf("\n"));
    const route = /- Route: `([^`]*)`/.exec(section)?.[1];
    const block = /\*\*Research note\*\*\n\n((?:> .*\n?)+)/.exec(section)?.[1];
    // Desktop wins (R12): M1's route reads "/join/[token] at 390px", so it is
    // skipped, and a repeated route keeps its first screen.
    if (!route || !block || route.endsWith(" at 390px") || route in notes)
      continue;
    notes[route] = {
      screen,
      lines: block
        .trim()
        .split("\n")
        .map((l) => l.slice(2)),
    };
  }
  return notes;
}

test("the notes match screens.md, route by route", () => {
  const parsed = notesFromScreens();
  // 22 notes in screens.md: 01 to 19, 02a, 02b and M1. M1 is skipped, so 21
  // routes (with `/`, which noteFor never shows). A parser that matches nothing can't pass.
  expect(Object.keys(parsed)).toHaveLength(21);
  expect(PROTOTYPE_NOTES).toEqual(parsed);
});

test("routes find their note", () => {
  expect(noteFor("/manager")?.screen).toBe("08 Manager overview");
  expect(noteFor("/join/abc123")?.screen).toBe("09 Employee invitation");
  expect(noteFor("/join/preview")?.screen).toBe("09 Employee invitation");
  expect(noteFor("/")).toBeNull(); // R12: the landing replaced 02
  expect(noteFor("/guide")).toBeNull();
});

test("note lines get display labels, pins in lower case", () => {
  expect(splitNoteLine("WHY: Tests whether a partner works.")).toEqual({
    label: "Why",
    text: "Tests whether a partner works.",
  });
  expect(splitNoteLine("HMW: Part of the working week")).toEqual({
    label: "How might we",
    text: "Part of the working week",
  });
  expect(
    splitNoteLine("EVIDENCE, pin 1 VIABLE: extends IBM's channel."),
  ).toEqual({
    label: "Evidence, pin 1 viable",
    text: "extends IBM's channel.",
  });
  expect(
    splitNoteLine("EVIDENCE, pin 8 PRIVACY. All figures are mock data."),
  ).toEqual({
    label: "Evidence",
    text: "pin 8 privacy. All figures are mock data.",
  });
  expect(splitNoteLine("Mobile covers Dan's core loop")).toEqual({
    label: null,
    text: "Mobile covers Dan's core loop",
  });
});
