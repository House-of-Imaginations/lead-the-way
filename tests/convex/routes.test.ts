import { readFileSync, readdirSync } from "node:fs";
import type { FunctionReference } from "convex/server";
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import {
  ROUTE_PERMISSION,
  type ManagerRoute,
  type Permission,
} from "../../convex/lib/orgs/permissions";
import { harness, seat, workspace } from "./workspace/helpers";

/**
 * Ruling 5: each manager page and the query it renders from. The page must
 * call it (read from its source), and the query must need exactly the
 * permission `ROUTE_PERMISSION` names. The nav shows the link on that
 * permission, so a query that needs another would show a link that bounces.
 */
const PAGES: Partial<
  Record<ManagerRoute, { name: string; fn: FunctionReference<"query"> }>
> = {
  "/manager": { name: "api.manager.overview", fn: api.manager.overview },
  "/manager/sprint/launch": {
    name: "api.sprints.launchPage",
    fn: api.sprints.launchPage,
  },
  "/manager/agreement": {
    name: "api.agreements.current",
    fn: api.agreements.current,
  },
  "/manager/learning": {
    name: "api.pathway.forViewer",
    fn: api.pathway.forViewer,
  },
};

/** Mapped routes with no page and query yet. Task 4 adds `/manager/outcomes`. */
const NO_ROW_YET = ["/manager/outcomes"];

const MANAGER_PERMISSIONS: Permission[] = ["sprint:manage", "team:insights"];

const dir = new URL("../../src/app/(app)/manager/", import.meta.url);

/** Each manager page's route: "sprint/launch/page.tsx" is "/manager/sprint/launch". */
function managerPages(): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((file) => file === "page.tsx" || file.endsWith("/page.tsx"))
    .map((file) =>
      file === "page.tsx"
        ? "/manager"
        : `/manager/${file.slice(0, -"/page.tsx".length)}`,
    );
}

test("every manager page renders from the query its row names (Ruling 5)", () => {
  const pages = managerPages();
  // Nothing found would pass vacuously.
  expect(pages).toEqual(
    expect.arrayContaining(["/manager", "/manager/agreement"]),
  );
  for (const href of pages) {
    const row = PAGES[href as ManagerRoute];
    expect(row, href).toBeDefined();
    const file =
      href === "/manager"
        ? "page.tsx"
        : `${href.slice("/manager/".length)}/page.tsx`;
    expect(readFileSync(new URL(file, dir), "utf8"), href).toContain(
      row!.name,
    );
  }
  expect(
    Object.keys(ROUTE_PERMISSION).filter((href) => !(href in PAGES)),
  ).toEqual(NO_ROW_YET);
});

/** The refusal's code, or null when the query answered. */
const refusal = (answer: Promise<unknown>) =>
  answer.then(
    () => null,
    (e: { data?: { code?: string } }) => e.data?.code ?? "THREW",
  );

test("each manager page's query needs exactly the permission the map names (Ruling 5)", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  let n = 0;
  const holding = async (permissions: Permission[]) =>
    (await seat(t, orgId, `user_${n++}`, permissions)).as;
  for (const [href, row] of Object.entries(PAGES)) {
    const need = ROUTE_PERMISSION[href as ManagerRoute];
    // The mapped permission alone is enough; a null route takes any manager.
    const enough = need ? [[need]] : MANAGER_PERMISSIONS.map((p) => [p]);
    for (const held of enough) {
      const answer = (await holding(held)).query(row!.fn, {});
      expect(await refusal(answer), `${href} ${held.join()}`).not.toBe(
        "FORBIDDEN",
      );
    }
    // Every other manager permission, without it, is refused.
    const others = MANAGER_PERMISSIONS.filter((p) => p !== need);
    const answer = (await holding(need ? others : [])).query(row!.fn, {});
    expect(await refusal(answer), href).toBe("FORBIDDEN");
  }
});
