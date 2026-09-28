---
name: phased-work
description: Use when you are working a ticket yourself in this session, not handing it to another agent. Runs the same gated phase workflow the delegation brief imposes - Phase 0 recon and report, Phase 1 plan, Phase 2 implement, Phase 3 test and fix, Phase 4 PR - with you as the agent. Triggers on "work this ticket", "run the workflow here", "phase 0 this", "do this yourself, no delegation", "three-phase this".
---

# Phased work

Same gates as [`delegation-brief`](../delegation-brief/SKILL.md), applied to
this session instead of a fresh one. Use `delegation-brief` when the work goes
to another worktree or another agent. Use this when the work stays here.

The gate structure is the point. It exists because an agent that plans and
implements in one breath implements its first guess. You are that agent here,
so the gates bind you, not someone else.

**Do not compose a brief. Do not create a worktree. Do not spawn an Orca
session.** If you catch yourself writing "you own TICKET-X" in the second
person, you have picked the wrong skill.

## Establish the lane first

Before Phase 0, say in one or two lines what this ticket owns and what it
explicitly does not - the neighbouring tickets, the tempting adjacent fix.
Name the blockers and whether they are cleared. Then hold that line for the
rest of the work.

## Phase 0: recon. No code. Ends in a report.

**0. Sync first.** `git fetch origin && git merge origin/main` on the current
branch, resolve conflicts, confirm `npm run lint` is clean on the merged base
before changing anything. Report what came down.

If this is a git worktree, the stash stack is shared with every other
worktree. Never bare `git stash` / `git stash pop`. Prefer a temporary WIP
commit; if you must stash, `git stash push -u -m "<unique-tag>"`, capture the
SHA from `git stash list --format='%H %gs'`, restore with `git stash apply
<sha>`.

**1. Read the ticket** - and its parent, blocker and dependent.

**2. Read the house rules.** Root `CLAUDE.md` and `AGENTS.md` end to end. They
override your defaults.

**3. Deep scan - fan out, do not skim.** Write down the questions you actually
have about this codebase, then dispatch one subagent per question in parallel.
Each prompt names the question, where to start looking, and that the answer
comes back as file paths plus one line each on what the file teaches. One agent
per question - a single agent handed the whole ticket returns a file tour and no
answers.

If oh-my-claudecode is installed, use `oh-my-claudecode:explore` for "where
does X live" and `oh-my-claudecode:architect` for "why is X shaped this way".
Under Codex or Cursor, or with no OMC, use plain read-only subagents with the
same prompts.

Then read the files they named yourself - every file you are about to change. A
subagent summary is not a substitute for code you will edit. Read existing
comments in full where they record measured failures; those are the traps you
are about to walk into.

**4. Read the design**, if the ticket has one. Exact values, not impressions.

**5. Stand it up.** App, env, dev command, port. Confirm you can reach it.

**6. Report and STOP.** Post, in this shape:

- **SYSTEM STATE**: what came down in the merge, what is running and where,
  what you could and could not reach.
- **THE PATTERN / THE CAUSE / THE DIFF**: whichever this ticket is about, with
  your own measurements. Numbers, not adjectives.
- **THE PLAN SHAPE**: each change with the file it lands in and the exact
  value that decides it.
- **THE TEST STRATEGY**: which Phase 3 harness this ticket needs (unit only,
  or browser too) and what you will actually test. Say plainly what is not
  unit-testable rather than padding the suite.
- **RISKS**: what you could not resolve, what could regress.
- **WHAT I COULD NOT VERIFY**: sampled a colour off a render instead of a
  variable? Blocked by an SSO wall? Say so and say who confirms it.

Then stop and wait for approval. Phase 0 ends in a report in the chat - plan
mode is the Phase 1 gate, not this one. Do not start coding because the plan
looks obvious.

## Phase 1: plan. Only after Phase 0 is approved.

Ordered plan, one line per change. Get it approved before writing code.

Before you propose it, close off the wrong fixes by name - for any bug with an
obvious-but-wrong shortcut, say why you are not taking it. And record the
decisions already made with their reasoning, so a later phase does not
relitigate them.

**End Phase 1 in plan mode.** Do not ask "shall I start?" in prose - put the
plan through your harness's own plan gate. Claude Code: `EnterPlanMode`, then
`ExitPlanMode` with the plan as the proposal. Codex and Cursor: their plan / ask
mode equivalent. Same point everywhere - the user gets the whole plan as one
reviewable overview and approves or edits it before a single file changes.

The overview is: the lane, the ordered changes each with its file, the test
strategy from Phase 0, and what is deliberately out of scope. Approving that is
the gate into Phase 2. A comment on the plan is an edit to the plan, not a green
light.

## Phase 2: implement. Stop at the test gate.

Work the approved plan in order. Do not commit, do not open a PR.

## Phase 3: test, then fix. Nothing commits until this is green.

Pick the harness from what you actually changed:

- **Backend, library or CLI only** - nothing that renders: unit tests are
  enough. `npm run test` plus at least one test that fails if this specific
  change breaks.
- **Anything that renders** - a component, a route, a style, a copy string:
  unit tests do not cover it. Drive the running app in a browser. Default to
  Claude in Chrome, or Codex's browser use when you are running under Codex.
  Use the repo's own browser harness (Playwright, Cypress, whatever is wired)
  only when the user asks for it or it already exists and covers this path.
- **Both** - do both. A passing backend suite is not coverage for a UI change.

Phrase every check so it can fail: the starting state, the action, the exact
value you expect to observe. "It looks right" is not a check.

**Fix before commit.** A failing check is a fix, not a line in the PR body.
Loop back into Phase 2 and re-run Phase 3 until every check passes and
`npm run lint` is clean with zero errors. If a failure is genuinely out of this
ticket's lane, say so explicitly and get it agreed before committing - do not
commit around it silently.

## Phase 4: commit and PR.

Run the repo's checklist before commit. Then the PR: body from the repo
template, `Closes <TICKET-ID>` on its own line. After pushing,
`gh pr checks <pr> --watch`. Do not walk away assuming green.

## Known traps

- **The Orca browser cannot resize its viewport.** `resize_window` reports
  success and `innerWidth` does not change. Use a sized same-origin iframe as
  the probe.
- **The Orca browser throttles `requestAnimationFrame` to roughly 2fps.**
  Await two frames or scroll reads are stale.
- **A hidden Claude-in-Chrome tab freezes rAF and CSS animations.**
  Screenshots go stale. Verify motion by numbers, not by paint.
- **Do not edit a migration CI has already applied.** `db push` says "Remote
  database is up to date" and applies nothing.
- **The stash stack is shared across worktrees.**

## Not Claude-only

This skill is mirrored at `.claude/skills/phased-work/` and
`.agents/skills/phased-work/` so Codex and Cursor find it too. The `.agents`
copy is a symlink to the `.claude` one, so editing either edits both.
