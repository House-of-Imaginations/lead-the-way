---
name: ticket
description: Use when someone describes work in their own words and it needs to become a GitHub issue or a pull request description in this repo - turns a loose ask from either the Engineering or the Business team into a filled-in issue form or PR body, then files it with gh
---

# Ticket

Turn what a person just said into a ticket somebody else can pick up without asking them a question.

## Start here: ask which one

The skill does two jobs. Ask which, in one line, before anything else:

> Issue or pull request? An issue describes work somebody will pick up. A pull request describes work that is already written and needs review.

Use `AskUserQuestion` when it is available, with those two options.

Answer it yourself only when the situation leaves no room for doubt, and say which you chose:

- They described work that does not exist yet, or asked a question that blocks work. That is an **issue**.
- The branch has commits that `main` does not, the work is finished, and they said "open a PR" or "ship this". That is a **pull request**.

Anything else, ask. A finished branch is not proof: people file follow-up issues from a branch all the time. If they want both, file the issue first so the PR can close it.

Then follow one of the two sections below.

The person you are helping may be on the Business team. Never make them learn a label taxonomy, a form schema, or a `gh` flag. Ask in plain words, then do the mapping yourself.

## A task to an issue

### 1. Pick the form

| They said | Form | Label applied |
| --- | --- | --- |
| Something new that a user would notice | `feature` | `enhancement` |
| Something is broken, wrong, or not what they expected | `bug` | `bug` |
| Setup, content, admin, a chore, an account to create | `task` | `task` |
| A question that blocks work until somebody answers it | `decision` | `decision` |

When it is two things, file two issues and link them. One issue with two outcomes gets half-closed.

If it is a question rather than work, it is a `decision`, even when it sounds like a feature. "Should we charge per seat" is a decision; "add per-seat billing" is a feature that the decision blocks.

### 2. Ask only what you cannot infer

Every form needs a **Team** and a **Priority**. Infer both, state your guess, and let them correct it:

> Filing this as Engineering, p1. Say the word if it is really a demo blocker.

- **Team** is Engineering for code, infrastructure and tests; Business for scope, copy, content, go-to-market and the demo; Both only when neither team can finish it alone.
- **Priority** is p0 for a demo blocker, p1 for wanted in the demo, p2 for nice to have. Most things are p1. p0 means somebody drops what they are doing.

Then ask at most **two** questions, and only for what you genuinely cannot write yourself. The most valuable one is almost always the same:

> What is true when this is done?

For a bug, ask for the steps instead: what they did, what they saw, what they expected.

Do not interview. A ticket with a good title and a thin body beats a perfect one that took ten minutes to file.

### 3. Write it

- **Title**: the outcome, not the activity. "Sign-up lands on the home screen" beats "fix sign-up redirect bug". No label prefixes in the title, the labels already exist.
- **Body**: their words, tidied. Keep their examples and their numbers. Do not invent acceptance criteria they did not agree to, and do not propose a technical approach inside a Business ticket.
- **Done looks like**: something a second person can check without asking the author.
- Unknowns stay in the ticket as open questions. A guess written as a fact is worse than a blank.

### 4. File it

```sh
gh issue create \
  --repo House-of-Imaginations/forward-hackathon-we-maid-ai \
  --title "Sign-up lands on the home screen" \
  --label "bug,team: engineering,prio: p0,area: auth" \
  --body-file /tmp/issue.md
```

Labels to apply, on top of the one the type implies:

- `team: engineering` | `team: business` | `team: both`
- `prio: p0` | `prio: p1` | `prio: p2`
- `area: frontend` | `area: backend` | `area: auth` | `area: infra` | `area: content`, when you are sure. Skip it when you are not.

Then add it to the board and set its Team field:

```sh
gh project item-add 1 --owner House-of-Imaginations --url <issue url>
```

The board is `https://github.com/orgs/House-of-Imaginations/projects/1`. A new item lands in **Backlog**; move it to **To do** only when the scope is clear and nothing blocks it. The columns are Backlog, To do, In progress, In review, Blocked and Done, and there is a Team field with Engineering, Business and Both.

Setting either field needs the item id from `gh project item-list 1 --owner House-of-Imaginations --format json`; if that is more trouble than it is worth, say so and leave the labels to carry the ownership.

Report the issue URL and the labels you applied. Never file more than one issue without showing the titles first.

## A branch to a pull request

The template is `.github/pull_request_template.md`. Fill it from the diff, not from memory:

```sh
git log origin/main..HEAD --oneline
git diff origin/main...HEAD --stat
```

- **What this does** is one or two sentences a non-engineer can follow. Say what changed for the person using the product, not which functions moved.
- **Closes #** takes the issue number. Ask for it if there is no obvious one, and offer to file the issue first when the work has none.
- **How to check it** is a click path a reviewer can follow: the URL, what to press, what they should see. Not "run the tests".
- **Notes for the reviewer** is what you would say handing it over in person. A shortcut with a known ceiling, a decision worth challenging, the file to read first. Delete the section when there is nothing.
- Leave the checklist unticked unless you actually ran the checks. A ticked box that nobody ran is the reason nobody trusts the boxes.

```sh
gh pr create --fill-first --body-file /tmp/pr.md
```

Push the branch first. Open the PR as a draft when the checklist is not green yet.

## Do not

- Do not file an issue for something already open. Search first: `gh issue list --search "<keywords>" --state all`.
- Do not close an issue in a PR body unless the PR actually finishes it. Half-done work that says "Closes" leaves the rest untracked.
- Do not paste secrets, admin keys or `.env.local` contents into a ticket. A GitHub issue in a private repo is still readable by everyone on both teams.
