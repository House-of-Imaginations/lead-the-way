# Checklist before commit

A checklist, not a process. Nothing here gates anything; it is the set of things that turn out to
matter, in the order they come up. Skip what your change cannot break.

Work through it before `git commit`, not after. Pushing lands on `main`, and CI is filtered by
path, so for some changes no pipeline runs at all -- a commit nothing checked is not a commit that
passed.

- [ ] **Know what you touched.** `git status --short` and `git diff --name-only`. Anything in the
      list you did not mean to change, deal with now; a stray reformat or a regenerated file inside
      an unrelated commit is a review problem later.
- [ ] **Run the checks your diff can break.** The table below says which. When in doubt run all six.
- [ ] **Read the output, not the exit code.** A warning you introduced still counts. Say so in the
      commit body rather than leaving the reviewer to find it.
- [ ] **Regenerate what a tool owns.** Edited `docs/architecture.html`? Run
      `python3 scripts/architecture-svg.py` and commit the SVG with it. Added a Convex module?
      `npx convex dev` regenerates `convex/_generated`.
- [ ] **Update `.docs` in the same commit** if this moved a command, an environment variable, an
      ownership rule or a contract. A handbook that lags the code is worse than no handbook.
- [ ] **Write the commit message as a reason, not a summary.** Subject in the imperative, body
      explaining why the change exists. `git log` is the house style.
- [ ] **Confirm the branch before pushing.** `git status --short --branch`. This matters most after
      a resume, a compaction, or work inside a linked worktree.
- [ ] **After pushing, read the actual check results.** `gh run list` -- do not assume the set you
      expected is the set that ran.

## Which checks your diff needs

| What the diff touches                                                             | Run before committing                                                                                 | CI then runs |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------ |
| `convex/**`                                                                       | `npm run format:check`, `npm run lint`, `npm run build`, `npm run typecheck`, `npm run test:backend`  | all five     |
| `src/**`, `public/**`                                                             | `npm run format:check`, `npm run lint`, `npm run build`, `npm run typecheck`, `npm run test:frontend` | all five     |
| `tests/**`                                                                        | `npm run format:check`, `npm run lint`, and the suite you changed                                     | all five     |
| `package.json`, `package-lock.json`, `tsconfig.json`, `*.ts`, `*.mjs` at the root | everything below                                                                                      | all five     |
| `.github/workflows/**`                                                            | nothing local can run a workflow; read the run after pushing                                          | all five     |
| `.docs/**`, `README.md`, `.github/ISSUE_TEMPLATE/**`, `.claude/**`, `.agents/**`  | `npm run format:check`                                                                                | Format only  |
| `docs/**` (the architecture diagram)                                              | `python3 scripts/architecture-svg.py`, then commit the regenerated SVG                                | nothing      |

The full set, in the order a clean checkout needs:

```sh
npm run format:check   # `npm run format` fixes what it reports
npm run lint
npm run build          # writes .next/types, which the typecheck reads
npm run typecheck
npm run test:frontend
npm run test:backend
```

`npm run build` before `npm run typecheck` is not a preference. On a clean checkout `tsc` fails
without the route types that `next build` writes.

## Three things that are not evidence

- **A pipeline that did not run.** Path filters mean four of the five are absent on a
  documentation-only change. Absent is not green. [setup.md](setup.md) lists the filters.
- **A green suite with a pending scheduled function.** Drain what you scheduled inside the test that
  scheduled it. `tests/globalsetup.ts` fails the run for a network call that fires after teardown,
  but a job that never fires is silent.
- **A check you ran before your last edit.** Re-run after the final change, including after
  resolving review findings. A repair invalidates the evidence that preceded it.

## If the work becomes a pull request

Use [the template](../.github/pull_request_template.md). Its checklist stays unticked until somebody
has actually run the commands above; ticking it is the claim, not the check.
