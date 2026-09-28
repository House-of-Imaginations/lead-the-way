// @vitest-environment node
import { describe, expect, test } from "vitest";
import { lintSource } from "../../scripts/copy-lint.mts";

const rules = (source: string, file = "x.tsx") =>
  lintSource(source, file).map((f) => f.rule);

describe("flags", () => {
  test("em and en dashes in JSX text and strings", () => {
    expect(rules(`const a = <p>Week 2 — sessions</p>;`)).toEqual(["dash"]);
    expect(rules(`const s = "9–30 September";`)).toEqual(["dash"]);
  });
  test("a minus sign used as a dash", () => {
    expect(rules(`const s = "Set temperature to −5 degrees";`)).toEqual([
      "dash",
    ]);
  });
  test("a spaced hyphen used as a dash", () => {
    expect(rules(`const a = <p>Save it - then share</p>;`)).toEqual([
      "spaced-hyphen",
    ]);
  });
  test("a spaced hyphen with a non-breaking space", () => {
    expect(rules(`const a = <p>Save it - then share</p>;`)).toEqual([
      "spaced-hyphen",
    ]);
  });
  test("hyphenated number and time ranges", () => {
    expect(rules(`const s = "2-5 people";`)).toEqual(["range"]);
    expect(rules(`const a = <p>2:00 - 3:00 PM</p>;`)).toContain("range");
  });
  test("emoji", () => {
    expect(rules(`const s = "Done 🎉";`)).toEqual(["emoji"]);
  });
  test("more than one middle dot in a string", () => {
    expect(rules(`const s = "Week 2 · Session 3 · 15 min";`)).toEqual([
      "middle-dot",
    ]);
  });
  test("title-case button labels", () => {
    expect(rules(`const b = <Button>Save Agreement</Button>;`)).toEqual([
      "title-case-button",
    ]);
    expect(rules(`const b = <button type="button">Log In</button>;`)).toEqual([
      "title-case-button",
    ]);
  });
  test("title-case button labels inside nested elements and fragments", () => {
    expect(
      rules(`const b = <Button><span>Save Agreement</span></Button>;`),
    ).toEqual(["title-case-button"]);
    expect(rules(`const b = <Button><>Save Agreement</></Button>;`)).toEqual([
      "title-case-button",
    ]);
  });
  test("a CSS function elsewhere in the string doesn't hide a real spaced hyphen", () => {
    expect(
      rules(`const s = "Width is calc(100% - 48px) - adjust if needed";`),
    ).toEqual(["spaced-hyphen"]);
  });
  test("template literal text", () => {
    expect(rules("const s = `${n}–${m} people`;")).toEqual(["dash"]);
  });
  test("reports the line number", () => {
    expect(lintSource(`const a = 1;\nconst s = "a — b";`, "x.ts")[0].line).toBe(
      2,
    );
  });
});

describe("does not flag", () => {
  test("sentence-case buttons, proper nouns and acronyms", () => {
    expect(rules(`const b = <Button>Save agreement</Button>;`)).toEqual([]);
    expect(rules(`const b = <Button>Switch to Dan's view</Button>;`)).toEqual(
      [],
    );
    expect(rules(`const b = <Button>Download PDF</Button>;`)).toEqual([]);
    expect(rules(`const b = <Button>Continue with Google</Button>;`)).toEqual(
      [],
    );
    expect(
      rules(`const b = <Button><span>Save agreement</span></Button>;`),
    ).toEqual([]);
  });
  test("the one title-case product term", () => {
    expect(rules(`const b = <Button>Open Team AI Agreement</Button>;`)).toEqual(
      [],
    );
  });
  test("class names, calc(), ISO dates and import paths", () => {
    expect(
      rules(
        `const c = <div className="grid-cols-2 gap-01 -translate-x-1/2" />;`,
      ),
    ).toEqual([]);
    expect(rules(`const s = { width: "calc(100% - 48px)" };`)).toEqual([]);
    expect(rules(`const d = "2026-09-09";`)).toEqual([]);
    expect(rules(`import x from "../lib/a-b";`)).toEqual([]);
  });
  test("ranges written with to, and a single middle dot", () => {
    expect(
      rules(`const a = <p>Wednesday 2:00 to 3:00 PM · 4 weeks</p>;`),
    ).toEqual([]);
  });
  test("comments", () => {
    expect(rules(`// 9–30 September — draft\nconst a = 1;`)).toEqual([]);
  });
});
