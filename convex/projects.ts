import { literals } from "convex-helpers/validators";
import { v, type Infer, type ObjectType } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { timedViewerQuery, viewerMutation } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { logEvent } from "./lib/events";
import {
  PROJECT_LIMITS,
  RESULT_TYPES,
  screenshotProblem,
} from "./lib/projectLimits";
import { isPresented, projectOf, savedProject } from "./lib/projects";
import { launchedSprint } from "./lib/sprint";
import { parts, weekOf } from "./lib/sprintTime";
import { isAdoptable } from "./lib/storage";
import type { Viewer } from "./lib/viewer";

/**
 * Dan's work project (12). One row per person per sprint (writer contract).
 * Every function here reads and writes only the viewer's own row; the one
 * read of other people's projects is `showAndTell.board`, and it shows only
 * presented ones.
 */

export const projectFieldsValidator = {
  title: v.string(),
  before: v.string(),
  change: v.string(),
  after: v.string(),
  resultTypes: v.array(v.string()),
  headline: v.string(),
  humanReviewed: v.boolean(),
  dataSafe: v.boolean(),
};
export type ProjectFields = ObjectType<typeof projectFieldsValidator>;

const myProjectValidator = v.object({
  week: v.number(), // 1 to sprint.weeks: which session's tip the aside shows
  project: v.union(
    v.null(),
    v.object({
      ...projectFieldsValidator,
      status: literals("draft", "saved"),
      presented: v.boolean(),
      learned: v.string(), // "" until written
      howChecked: v.string(),
      screenshotUrl: v.union(v.string(), v.null()),
      autosavedLabel: v.string(), // "Draft saved at 2:14 PM" | "Saved at 5:00 PM"
    }),
  ),
});
export type MyProject = Infer<typeof myProjectValidator>;

/** The current week, held to 1 to the sprint's last: the tip and `startedWeek`. */
const weekNow = (sprint: Doc<"sprints">, now: number) =>
  Math.min(Math.max(weekOf(sprint, now), 1), sprint.weeks);

/** "2:14 PM", in the viewer's own time zone: when they saved. */
function timeLabel(at: number, timeZone: string) {
  const p = parts(at, timeZone, { hour: "numeric", minute: "2-digit" });
  return `${p.hour}:${p.minute} ${p.dayPeriod}`;
}

function refuseTooLong(texts: [string, number][]) {
  if (texts.some(([text, max]) => text.length > max)) {
    throwUserError(
      "PROJECT_TOO_LONG",
      "That's longer than this form allows. Shorten it and try again.",
    );
  }
}

/** Caps from `projectLimits`, and only the form's result types, in its order. */
function checked(f: ProjectFields): ProjectFields {
  refuseTooLong([
    [f.title, PROJECT_LIMITS.title],
    [f.before, PROJECT_LIMITS.text],
    [f.change, PROJECT_LIMITS.text],
    [f.after, PROJECT_LIMITS.text],
    [f.headline, PROJECT_LIMITS.headline],
  ]);
  return { ...f, resultTypes: RESULT_TYPES.filter((r) => f.resultTypes.includes(r)) };
}

async function sprintOf(ctx: QueryCtx, viewer: Viewer) {
  const sprint = await launchedSprint(ctx, viewer.org._id);
  if (!sprint) {
    throwUserError("NO_SPRINT", "Your team's sprint hasn't started yet.");
  }
  return sprint;
}

/** Insert or update the viewer's one row. A new row starts private (Ruling 4). */
async function upsert(
  ctx: MutationCtx,
  viewer: Viewer,
  sprint: Doc<"sprints">,
  project: Doc<"projects"> | null,
  fields: ProjectFields & { status: "draft" | "saved" },
) {
  const now = viewer.now;
  if (project) {
    await ctx.db.patch(project._id, { ...fields, autosavedAt: now });
    return;
  }
  await ctx.db.insert("projects", {
    orgId: viewer.org._id,
    personId: viewer.person._id,
    sprintId: sprint._id,
    startedWeek: weekNow(sprint, now),
    ...fields,
    sharing: "private",
    autosavedAt: now,
  });
}

export const mine = timedViewerQuery()({
  args: {},
  returns: v.union(v.null(), myProjectValidator),
  handler: async (ctx): Promise<MyProject | null> => {
    const { viewer } = ctx;
    const sprint = await launchedSprint(ctx, viewer.org._id);
    if (!sprint) return null;
    const week = weekNow(sprint, viewer.now);
    const p = await projectOf(ctx, viewer.person._id, sprint._id);
    if (!p) return { week, project: null };
    return {
      week,
      project: {
        title: p.title,
        before: p.before,
        change: p.change,
        after: p.after,
        resultTypes: p.resultTypes,
        headline: p.headline ?? "",
        humanReviewed: p.humanReviewed,
        dataSafe: p.dataSafe,
        status: p.status,
        presented: isPresented(p),
        learned: p.learned ?? "",
        howChecked: p.howChecked ?? "",
        // Served only here, on the owner's own read (Ruling 11).
        screenshotUrl: p.screenshotId
          ? await ctx.storage.getUrl(p.screenshotId)
          : null,
        autosavedLabel: `${p.status === "draft" ? "Draft saved" : "Saved"} at ${timeLabel(p.autosavedAt, viewer.person.timeZone)}`,
      },
    };
  },
});

/** Autosave, 1 s after typing stops. A saved project is left alone: only "Save project" writes it again. */
export const saveDraft = viewerMutation()({
  args: projectFieldsValidator,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { viewer } = ctx;
    const fields = checked(args);
    const sprint = await sprintOf(ctx, viewer);
    const project = await projectOf(ctx, viewer.person._id, sprint._id);
    if (project?.status === "saved") return null;
    await upsert(ctx, viewer, sprint, project, { ...fields, status: "draft" });
    return null;
  },
});

export const save = viewerMutation()({
  args: projectFieldsValidator,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { viewer } = ctx;
    const fields = checked(args);
    if (!fields.title.trim()) {
      throwUserError("PROJECT_TITLE_REQUIRED", "Add a project title to save.");
    }
    if (!fields.humanReviewed || !fields.dataSafe) {
      throwUserError("PROJECT_CHECKS_REQUIRED", "Tick both checks to save.");
    }
    const sprint = await sprintOf(ctx, viewer);
    const project = await projectOf(ctx, viewer.person._id, sprint._id);
    await upsert(ctx, viewer, sprint, project, { ...fields, status: "saved" });
    // Logged when the project becomes saved, as the script logs it: once.
    // A later edit is the same project, not another one saved.
    if (project?.status !== "saved") {
      const fieldsFilled =
        [fields.after, fields.headline].filter((s) => s.trim()).length +
        (fields.resultTypes.length > 0 ? 1 : 0);
      await logEvent(ctx, {
        orgId: viewer.org._id,
        sprintId: sprint._id,
        type: "project.saved",
        at: viewer.now,
        meta: { fieldsFilled },
      });
    }
    return null;
  },
});

export const saveReflection = viewerMutation()({
  args: { learned: v.string(), howChecked: v.string() },
  returns: v.null(),
  handler: async (ctx, { learned, howChecked }): Promise<null> => {
    refuseTooLong([
      [learned, PROJECT_LIMITS.text],
      [howChecked, PROJECT_LIMITS.text],
    ]);
    const project = await savedProject(ctx, ctx.viewer);
    await ctx.db.patch(project._id, {
      learned: learned.trim() || undefined,
      howChecked: howChecked.trim() || undefined,
    });
    return null;
  },
});

/** Step one of an upload: the browser posts the file straight to storage. */
export const generateUploadUrl = viewerMutation()({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> =>
    await ctx.storage.generateUploadUrl(),
});

/**
 * Step two: the uploaded file becomes the viewer's screenshot, or null removes it.
 *
 * The `_storage` row is the real gate: it holds the type and size that landed.
 * Refusals come first and the delete comes last, because a throw rolls back a
 * delete too (orgs.ts `setImage` says the same).
 *
 * ponytail: storage ids carry no workspace, so any fresh id that no other row
 * holds (an org's `imageId`, another project's `screenshotId`) is accepted. A
 * stale one is refused. A refused upload (type, size, age) also stays in storage, because the
 * throw rolls back any cleanup: orphans are a prototype ceiling. Add an
 * `uploads` table (id, person, time), swept by a cron, if ids ever leak wider
 * or the orphans matter.
 */
export const setScreenshot = viewerMutation()({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { storageId }): Promise<null> => {
    const { viewer } = ctx;
    const sprint = await launchedSprint(ctx, viewer.org._id);
    const project = sprint
      ? await projectOf(ctx, viewer.person._id, sprint._id)
      : null;
    if (!project) {
      throwUserError(
        "PROJECT_MISSING",
        "Start your project before adding a screenshot.",
      );
    }
    if (storageId !== null) {
      const uploaded = await ctx.db.system.get("_storage", storageId);
      if (!uploaded) {
        throwUserError(
          "SCREENSHOT_STALE",
          "That upload has expired. Upload the file again.",
        );
      }
      const problem = screenshotProblem(uploaded.contentType, uploaded.size);
      if (problem) throwUserError(problem.code, problem.message);
      // Stale, or a file some other row holds: not yours to take.
      if (!(await isAdoptable(ctx, uploaded, { projectId: project._id }))) {
        throwUserError(
          "SCREENSHOT_STALE",
          "That upload has expired. Upload the file again.",
        );
      }
    }
    const previous = project.screenshotId;
    await ctx.db.patch(project._id, { screenshotId: storageId ?? undefined });
    if (previous && previous !== storageId) await ctx.storage.delete(previous);
    return null;
  },
});

/** "Present to team": sharing and the moment together (Ruling 4). Idempotent. */
export const present = viewerMutation()({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const { viewer } = ctx;
    const project = await savedProject(ctx, viewer);
    if (isPresented(project)) return null;
    const now = viewer.now;
    await ctx.db.patch(project._id, { sharing: "team", presentedAt: now });
    await logEvent(ctx, {
      orgId: viewer.org._id,
      sprintId: project.sprintId,
      type: "project.presented",
      at: now,
    });
    return null;
  },
});
