/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { CHECK_LABELS } from "../../convex/lib/agreement";
import { personFields } from "./testHelpers";
import type { T } from "./workspace/helpers";

/**
 * The table both sweeps run from: `signedOut.test.ts` (every public function
 * refuses a signed-out caller) and `tenant.test.ts` (no public function reads
 * another workspace's ids). One table, so a new function can't join one sweep
 * and miss the other. Add each new public function to `callsFor`.
 */
const modules = import.meta.glob(
  [
    "../../convex/**/*.ts",
    "!../../convex/_generated/**",
    "!../../convex/**/*.config.ts",
  ],
  { eager: true },
) as Record<string, Record<string, unknown>>;

type Kind = "query" | "mutation" | "action";
export type Fn = { name: string; kind: Kind };

export function publicFunctions(): Fn[] {
  const found: Fn[] = [];
  for (const [path, exports] of Object.entries(modules)) {
    const file = path.replace("../../convex/", "").replace(/\.ts$/, "");
    for (const [name, value] of Object.entries(exports)) {
      const fn = value as {
        isPublic?: boolean;
        isQuery?: boolean;
        isMutation?: boolean;
      } | null;
      if (!fn?.isPublic) continue;
      const kind = fn.isQuery ? "query" : fn.isMutation ? "mutation" : "action";
      found.push({ name: `${file}:${name}`, kind });
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/** Call a public function by name, signed out (`t`) or as someone (`t.withIdentity`). */
export function call(
  t: Pick<T, "query" | "mutation" | "action">,
  fn: Fn,
  args: Record<string, unknown>,
) {
  if (fn.kind === "query") {
    return t.query(makeFunctionReference<"query">(fn.name), args);
  }
  if (fn.kind === "mutation") {
    return t.mutation(makeFunctionReference<"mutation">(fn.name), args);
  }
  return t.action(makeFunctionReference<"action">(fn.name), args);
}

export type Ids = {
  orgId: Id<"orgs">;
  roleId: Id<"orgRoles">;
  personId: Id<"people">;
  inviteId: Id<"orgInvites">;
  storageId: Id<"_storage">;
  // Optional: the canary builds its own ids, and sweeps no career mutation.
  careerProfileId?: Id<"careerProfiles">;
  careerProjectId?: Id<"careerProjects">;
};

/** Real ids, so argument validation passes and the auth check is what answers. */
export async function fixtures(t: T): Promise<Ids> {
  return await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", {
      name: "Aster Network",
      slug: "aster-network",
      privacyThreshold: 5,
      isDemo: false,
      createdAt: 0,
    });
    const roleId = await ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: "Employee",
      permissions: [],
      createdAt: 0,
    });
    const personId = await ctx.db.insert("people", {
      orgId,
      roleId,
      ...personFields("user_x"),
    });
    const inviteId = await ctx.db.insert("orgInvites", {
      orgId,
      roleId,
      token: "tok",
      status: "pending",
      invitedBy: "user_x",
      expiresAt: Date.now() + 60_000,
      createdAt: 0,
    });
    const storageId = await ctx.storage.store(new Blob(["x"]));
    const careerProfileId = await ctx.db.insert("careerProfiles", {
      userId: "user_amara",
      kind: "learner",
      firstName: "Amara",
      private: false,
    });
    const careerProjectId = await ctx.db.insert("careerProjects", {
      careerProfileId,
      credentialId: "data-fundamentals",
      task: "Tidy four store sales exports.",
      whatIDid: "",
      reflection: "",
      skills: [],
      addReflectionToProof: true,
    });
    return {
      orgId,
      roleId,
      personId,
      inviteId,
      storageId,
      careerProfileId,
      careerProjectId,
    };
  });
}

/** Valid project fields, so the gate is what answers. */
const PROJECT = {
  title: "Weekly report",
  before: "",
  change: "",
  after: "",
  resultTypes: [],
  headline: "",
  humanReviewed: true,
  dataSafe: true,
};

export const callsFor = ({
  orgId,
  roleId,
  personId,
  inviteId,
  storageId,
  careerProfileId,
  careerProjectId,
}: Ids): Record<string, Record<string, unknown>> => ({
  // These two answer signed out (SIGNED_OUT in signedOut.test.ts); the
  // tenant and canary sweeps still read them as a seated caller.
  "demo:personaPassword": {},
  "demo:status": {},
  "demo:reset": { expectOrgId: orgId },
  "demo:setClock": { target: "week1", expectOrgId: orgId },
  "demo:moveCareerClock": { target: "week2" },
  "onboarding:start": { acceptTerms: true },
  "careers/tracks:startPrivate": { contactEmail: "pat@home.example" },
  "careers/tracks:deleteCareer": {},
  "careers/drafts:savedMap": {},
  "careers/tracks:setContactEmail": { contactEmail: "pat@home.example" },
  "careers/crews:mine": {},
  "careers/crews:rules": {},
  "careers/crews:status": {},
  "careers/crews:joinCrew": {},
  // convex-test reads an id's table from its suffix, so this passes validation.
  "careers/crews:toggleRule": { ruleId: "1crewRules", on: true },
  "careers/crews:proposeRule": { text: "Camera optional on check-ins" },
  "careers/crews:removeMyRule": { ruleId: "1crewRules" },
  "careers/crews:agree": {},
  "careers/hours:mine": {},
  "careers/hours:weekPreview": { days: [0, 4] },
  "careers/hours:save": {
    days: [0, 4],
    startTime: "20:00",
    calendarHold: true,
  },
  "careers/learning:thisWeek": {},
  "careers/learning:completeLesson": { lessonId: "data-fundamentals-4" },
  "careers/learning:setListen": { on: true },
  "careers/learning:reentry": {},
  "careers/demoDay:session": {},
  "careers/demoDay:saveReflection": { reflection: "" },
  "careers/demoDay:setAddToProof": { on: true },
  "careers/demoDay:present": {},
  "careers/proof:mine": {},
  "careers/proof:rateConfidence": {
    credentialId: "data-fundamentals",
    value: 4,
  },
  "careers/proof:createProofLink": { credentialId: "data-fundamentals" },
  "careers/guide:myLearners": {},
  "careers/guide:endorse": {
    careerProfileId,
    credentialId: "data-fundamentals",
    text: "Good work",
  },
  "careers/guide:reviewProject": { projectId: careerProjectId },
  "careers/careerSettings:mine": {},
  "careers/careerSettings:set": { key: "researchOptIn", on: true },
  "careers/careerSettings:deleteAnswers": {},
  "home:summary": {},
  "privacy:byTrack": {},
  "privacy:setTeam": {
    key: "includeInTeamTotals",
    on: false,
    expectOrgId: orgId,
  },
  "privacy:setCareer": { key: "showDoneToCrew", on: false },
  "orgs:active": {},
  "orgs:bySlug": { slug: "aster-network" },
  "orgs:create": { name: "Aster Network" },
  "orgs:mine": {},
  "orgs:generateImageUploadUrl": { expectOrgId: orgId },
  "orgs:setImage": { storageId, expectOrgId: orgId },
  "orgs:clearImage": { expectOrgId: orgId },
  "orgs:remove": { name: "Aster Network", expectOrgId: orgId },
  "orgs:myPermissions": {},
  "orgRoles:list": {},
  "orgRoles:create": { name: "Lead", permissions: [], expectOrgId: orgId },
  "orgRoles:update": {
    roleId,
    name: "Lead",
    permissions: [],
    expectOrgId: orgId,
  },
  "orgRoles:remove": { roleId, expectOrgId: orgId },
  "members:list": {},
  "members:changeRole": { personId, roleId, expectOrgId: orgId },
  "members:remove": { personId, expectOrgId: orgId },
  "members:leave": { expectOrgId: orgId },
  "invites:list": {},
  "invites:create": { roleId, expectOrgId: orgId },
  "invites:resend": { inviteId, expectOrgId: orgId },
  "invites:revoke": { inviteId, expectOrgId: orgId },
  "invites:preview": { token: "tok" },
  "invites:accept": { token: "tok" },
  "invites:decline": { token: "tok" },
  "invites:teamPreview": {},
  "profiles:saveProfile": { displayName: "Pat" },
  "profiles:setActiveOrg": { orgId },
  "settings:mine": {},
  "settings:setToggle": {
    key: "weeklyReminder",
    on: false,
    expectOrgId: orgId,
  },
  "settings:saveProfile": {
    name: "Pat Lee",
    jobTitle: "",
    timeZone: "Australia/Melbourne",
    captionsByDefault: true,
    reduceMotion: false,
    expectOrgId: orgId,
  },
  "workspace:settings": {},
  "workspace:setThreshold": { threshold: 6, expectOrgId: orgId },
  "workspace:saveGeneral": {
    name: "Aster",
    teamName: "Team",
    expectOrgId: orgId,
  },
  "workspace:saveSprintDefaults": {
    weekday: 3,
    start: "14:00",
    timeZone: "UTC",
    expectOrgId: orgId,
  },
  "teams:current": {},
  "teams:saveProfile": { challenges: [], finish: false, expectOrgId: orgId },
  "sprints:current": {},
  "sprints:setProtectedHour": {
    weekday: 3,
    start: "14:00",
    expectOrgId: orgId,
  },
  "sprints:commit": { weekday: 3, start: "14:00", expectOrgId: orgId },
  "sprints:notReady": { choice: "keepExploring", expectOrgId: orgId },
  "pathway:forViewer": {},
  "pathway:completeModule": { moduleKey: "shared-norms", expectOrgId: orgId },
  "pathway:rateConfidence": { score: 4, expectOrgId: orgId },
  "agreements:current": {},
  "agreements:save": {
    tools: [],
    neverIn: [],
    // Valid checks, so the contact is what answers.
    checks: CHECK_LABELS.map((label) => ({ label, on: true })),
    escalation: "",
    contact: { kind: "person", personId },
    expectOrgId: orgId,
  },
  "agreements:forMe": {},
  "agreements:sign": { version: 1, expectOrgId: orgId },
  "sprints:launchPage": {},
  "sprints:launch": { emails: [], message: "", expectOrgId: orgId },
  "sprints:runAnother": { expectOrgId: orgId },
  "manager:overview": {},
  "manager:outcomes": {},
  "surveys:checkIn": { phase: "before", answers: null, expectOrgId: orgId },
  "me:home": {},
  "me:sprint": {},
  "learning:continueSession": { expectOrgId: orgId },
  "projects:mine": {},
  "projects:saveDraft": { ...PROJECT, expectOrgId: orgId },
  "projects:save": { ...PROJECT, expectOrgId: orgId },
  "projects:saveReflection": {
    learned: "",
    howChecked: "",
    expectOrgId: orgId,
  },
  "projects:generateUploadUrl": { expectOrgId: orgId },
  // null, not the fixture file: a foreign id would make the tenant sweep
  // expect NOT_FOUND from the handler instead of WORKSPACE_CHANGED.
  "projects:setScreenshot": { storageId: null, expectOrgId: orgId },
  "projects:present": { expectOrgId: orgId },
  "showAndTell:board": {},
  "badges:mine": {},
  "badges:attachReflection": { expectOrgId: orgId },
});
