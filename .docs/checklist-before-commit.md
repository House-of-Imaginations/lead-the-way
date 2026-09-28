# Checklist before commit

A checklist, not a process. Work through it before `git commit`, not after.

- [ ] **Know what you touched.** `git status --short` and `git diff --name-only`. Anything in the list you did not mean to change, deal with now.
- [ ] **Run the checks your diff can break.** The table below says which.
- [ ] **Read the output, not the exit code.** A warning you introduced still counts.
- [ ] **Update `.docs` in the same commit** if this moved a command, an environment variable, an ownership rule or a data model. A handbook that lags the code is worse than no handbook.
- [ ] **Never stage `docs/superpowers/` or `.superpowers/`.** Specs and plans from superpowers are working notes, not product source, and are not committed.
- [ ] **Write the commit message as a reason, not a summary.** Subject in the imperative, body explaining why the change exists.
- [ ] **Confirm the branch before pushing.** `git status --short --branch`.

## Which checks your diff needs

| What the diff touches | Run before committing |
| --- | --- |
| `convex/**` | `pnpm typecheck`, `pnpm lint`, `pnpm copy-lint`, `pnpm test:backend` |
| `src/**` | `pnpm typecheck`, `pnpm lint`, `pnpm copy-lint`, `pnpm test:frontend`; add `pnpm e2e` for anything a user can see or click |
| `scripts/**` | `pnpm typecheck`, `pnpm lint`, `pnpm copy-lint`, `pnpm test:frontend` (runs `tests/scripts`) |
| `tests/**` or `e2e/**` | `pnpm lint`, and the suite you changed |
| `DESIGN.md` | `npx @google/design.md lint DESIGN.md` (one expected warning: disabled button contrast) |
| `package.json`, `pnpm-lock.yaml`, `tsconfig.json` | the full set below |
| `.github/workflows/**` | nothing local can run a workflow; read the run after pushing |

The full set, in the order a clean checkout needs:

```sh
pnpm typecheck
pnpm lint
pnpm copy-lint
pnpm test
pnpm e2e
```

## Two things that are not evidence

- **A check you ran before your last edit.** Re-run after the final change, including after resolving review feedback.
- **A green suite with a pending scheduled function.** `tests/globalsetup.ts` fails the run for a network call that fires after teardown, but a job that never fires is silent.
