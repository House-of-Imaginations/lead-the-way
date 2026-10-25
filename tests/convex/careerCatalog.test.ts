import { expect, test } from "vitest";
import {
  CREDENTIALS,
  CURRENT_ROLES,
  LESSONS,
  TARGETS,
  lessonsFor,
  strengthsFor,
  weeksForHours,
} from "../../convex/lib/careers/catalog";

test("weeks for the whole map: 18, 9 or 6, split evenly across three credentials", () => {
  expect(weeksForHours(1)).toEqual({ total: 18, perCredential: 6 });
  expect(weeksForHours(2)).toEqual({ total: 9, perCredential: 3 });
  expect(weeksForHours(3)).toEqual({ total: 6, perCredential: 2 });
});

test("Data Fundamentals has 11 lessons, 4 of them done by Excel basics in week 2", () => {
  const lessons = lessonsFor("data-fundamentals");
  expect(lessons).toHaveLength(11);
  expect(lessons.map((l) => l.order)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  ]);
  expect(lessons.filter((l) => l.week === 1)).toHaveLength(3);
  expect(lessons[3]).toMatchObject({
    title: "Excel basics for data",
    week: 2,
    minutes: 12,
    kind: "lesson",
  });
  expect(
    lessons.filter((l) => l.week === 3).map((l) => [l.title, l.minutes]),
  ).toContainEqual(["Joining two tables", 15]);
  expect(lessonsFor("business-analysis-fundamentals")).toHaveLength(11);
});

test("project steps are projects with no audio, and lesson ids are unique", () => {
  for (const l of LESSONS)
    expect(l.kind === "project", l.id).toBe(l.title.startsWith("Project step"));
  expect(LESSONS.every((l) => l.hasAudio === (l.kind === "lesson"))).toBe(true);
  expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
});

test("each target has three skills, each on a catalog credential", () => {
  const ids = new Set<string>(CREDENTIALS.map((c) => c.id));
  expect(TARGETS.map((t) => t.name)).toEqual([
    "Data Analyst",
    "Business Analyst",
  ]);
  for (const target of TARGETS) {
    expect(target.skills).toHaveLength(3);
    for (const skill of target.skills)
      expect(ids.has(skill.credentialId), skill.name).toBe(true);
  }
});

test("strengths: Amara's and Dan's roles have their own, every other role the generic set", () => {
  expect(strengthsFor("Retail Store Manager")).toEqual({
    strengths: [
      "Sales reporting",
      "Leading a team",
      "Problem-solving",
      "Rosters and budgets",
    ],
    note: "From six years running a store",
  });
  expect(strengthsFor("Account Executive").strengths).toContain(
    "Understanding business needs",
  );
  const generic = strengthsFor("Something else");
  expect(generic.note).toBe("From your experience so far");
  expect(strengthsFor("Primary Teacher")).toEqual(generic);
  expect(strengthsFor("Not on the list")).toEqual(generic);
  expect(CURRENT_ROLES).toContain("Account Executive");
  expect(CURRENT_ROLES.at(-1)).toBe("Something else");
});
