# Build Prompt: “Lead the Way” — High-Fidelity Interactive Prototype

## Role

Act as a senior product designer and front-end engineer.

Build a polished, high-fidelity, interactive prototype for a concept called **Lead the Way**, designed for **IBM SkillsBuild**.

The prototype should feel realistic enough for a manager and employee to click through and understand the full service journey, but it does **not** need a production backend, real authentication, real IBM/Credly APIs, or real course integrations.

The purpose is to test the product concept and the riskiest behavioural assumptions, not to build a complete platform.

---

# 1. Product Context

## Problem

Mid-career professionals in AI-exposed roles often have access to free online AI learning, but the learning sits outside normal work.

The main friction is not necessarily registration. It emerges after enrolment because:

- learning competes with normal work deadlines;
- long or theory-heavy content can delay practical value;
- learners often study privately;
- AI use can be socially uncertain or hidden at work;
- badges demonstrate course completion but do not always demonstrate applied capability;
- managers may want to support AI learning but lack guidance on what to encourage or how to establish safe workplace norms.

The design should therefore move learning from a private, optional activity into a supported part of the working week.

---

# 2. Design Challenge

Use the following How Might We question as the design anchor:

> **How might we make AI learning part of the working week for mid-career professionals in AI-exposed roles, so that what they learn is used, completed and openly valued at work?**

Every major screen and interaction should support at least one of these four outcomes:

1. **Part of the working week**
2. **Used in real work**
3. **Completed**
4. **Openly valued at work**

---

# 3. Chosen Concept

## Lead the Way

Lead the Way is a **manager-first team learning experience**.

Instead of asking an employee to independently discover, complete and promote a course, the experience begins with the manager.

The manager:

1. completes a short AI leadership pathway;
2. creates shared AI working norms with the team;
3. protects one hour of learning time per week for four weeks;
4. invites the team into a curated SkillsBuild learning sprint;
5. encourages employees to apply learning to a real work task;
6. hosts a short show-and-tell in Week 4;
7. sees only aggregate team progress, not individual surveillance data.

The concept should feel like a lightweight layer around existing IBM SkillsBuild content rather than a completely new LMS.

---

# 4. Primary Users

## Manager Persona

**Name:** Priya  
**Role:** Team manager  
**Team size:** 8 people  
**Context:** Office-based knowledge work / AI-exposed work  
**Need:** Wants the team to use AI productively and safely but does not want eight people using AI in eight inconsistent ways.  
**Pain points:**

- unsure which AI practices to support;
- limited time to design training;
- wants team consistency;
- does not want another unused learning subscription;
- needs something practical and low-effort.

## Employee Persona

**Name:** Dan  
**Career stage:** Mid-career professional  
**Context:** Already experiments with AI at work  
**Need:** Wants useful AI skills but has limited uninterrupted time for formal online learning.  
**Pain points:**

- work deadlines come first;
- self-paced courses are easy to postpone;
- theory before practical application causes drop-off;
- may hesitate to discuss AI use openly;
- a badge alone does not fully prove capability.

---

# 5. Prototype Goal

Build an interactive prototype that lets a reviewer experience this complete story:

> **I am a manager → I understand the programme → I commit protected time → I learn how to lead AI use → I create shared team norms → I invite my team → an employee learns and applies the content → the employee documents a real workplace application → the team shares outcomes → the manager sees aggregate results.**

The prototype should visually communicate that the innovation is primarily about changing the **workplace context**, not simply redesigning course content.

---

# 6. Technology (updated: Next.js + Convex)

> **Changed from the original brief.** The original asked for a client-only React/Next.js prototype with local mock state. This build uses **Next.js with Convex** as the backend, so journey state is real, shared between the manager and employee views, and the privacy rules are enforced on the server rather than only in the UI. The full stack decision lives in `../../MASTER_PROMPT.md` (section "Stack") and the data model in `data-model.md`. Where this file and the master prompt disagree, the master prompt wins.

Use:

- **Next.js** (latest stable, App Router, React Server Components) with **TypeScript** in strict mode
- **Convex** for the database, server functions (queries, mutations, actions), realtime updates, scheduled functions and file storage
- **Tailwind CSS v4** mapped to the Lead the Way design tokens (`design-system/tailwind-theme.css`)
- **Radix UI primitives** (dialog, tabs, switch, dropdown menu, checkbox) restyled to the design system, for accessibility
- **@carbon/icons-react** for icons (the design system uses official Carbon icons)
- **IBM Plex Sans** and **IBM Plex Mono** via `next/font/google`
- **GSAP + ScrollTrigger** for the marketing landing page only
- **Vitest + convex-test** for Convex functions, **Playwright** for end-to-end journeys and visual checks

Still do **not** spend effort on:

- real IBM SkillsBuild, Credly or LinkedIn APIs (simulate them with Convex data and confirmation toasts);
- real email delivery (invitations are Convex records with a join token; show a preview instead of sending);
- real calendar integration ("Add to calendar" can download nothing and confirm with a toast);
- real enterprise SSO (the button exists, the flow is simulated) or permissions beyond manager and employee;
- production-grade deployment architecture beyond a Vercel + Convex cloud deployment.

Authentication is **in scope** (updated): the prototype now has real **sign up** and **log in** screens (`wireframes/02a`, `02b`, based on the shadcn `login-02` layout). Recommended: Convex Auth with the Password provider; single sign-on is shown but simulated. Seeded demo accounts for Priya, Dan and the team keep persona switching possible for testing, all behind one `getViewer(ctx)` helper. Enterprise SSO and permissions beyond manager and employee stay out of scope.

---

# 7. Visual Direction

The interface should feel:

- professional;
- trustworthy;
- enterprise-ready;
- accessible;
- calm rather than flashy;
- consistent with a workplace learning product.

Use a restrained, modern enterprise visual language.

Suggested characteristics:

- clean white or very light backgrounds;
- dark navy / neutral text;
- one strong accent colour;
- generous whitespace;
- clear hierarchy;
- square, flat surfaces separated by hairlines (updated: the design system uses Carbon-style square corners; rounded cards are no longer used);
- shadows only on things that float (menus, toasts, modals);
- accessible contrast;
- responsive layout;
- polished progress indicators.

> **Updated:** the visual language is now fixed by the Lead the Way design system in `design-system/` (IBM Plex, Carbon-style tokens, one blue accent, square corners). Follow it exactly instead of the loose guidance in this section.

Do not copy IBM's proprietary UI exactly.

You may use IBM-inspired enterprise design cues without falsely representing this as an official IBM production interface.

Add a small label where appropriate:

> **Concept prototype — not an official IBM product**

---

# 8. Information Architecture

Create the following main areas:

1. Manager invitation / landing page
2. Manager onboarding
3. Protected learning-time commitment
4. Manager dashboard
5. Manager AI pathway
6. Team AI Agreement builder
7. Employee invitation
8. Employee dashboard
9. Workplace application / project reflection
10. Weekly sprint progress
11. Week 4 show-and-tell
12. Badge + applied reflection
13. Manager completion / outcome dashboard

Around **10–14 polished screens** is sufficient.

---

# 9. Core User Flow

Implement this clickable sequence:

**Partner invitation**  
→ **Manager landing page**  
→ **Manager onboarding**  
→ **Choose protected learning hour**  
→ **Manager pathway**  
→ **Create Team AI Agreement**  
→ **Invite team**  
→ **Employee accepts invite**  
→ **Employee learning dashboard**  
→ **Employee applies learning to work**  
→ **Employee creates project reflection**  
→ **Week 4 show-and-tell**  
→ **Badge + applied evidence**  
→ **Manager sees aggregate outcomes**

Provide clear Back / Continue / Save / Complete actions so the prototype feels coherent.

---

# 10. Screen Specifications

## Screen 1 — Manager Invitation / Landing Page

### Purpose

Test whether the programme proposition is understandable and attractive enough for managers to continue.

### Content

Header:

**Lead the Way: AI at work, together**

Subheading:

> Help your team build practical AI capability in four weeks — with protected learning time, shared AI norms and real workplace application.

Display four key benefits:

- **4 weeks**
- **1 protected hour per week**
- **Practical workplace application**
- **Free through SkillsBuild partner delivery**

Show a simple visual journey:

**Learn → Set norms → Launch → Apply → Share**

Primary CTA:

**Start the Manager Path**

Secondary CTA:

**See how it works**

Trust / reassurance section:

- No individual employee learning activity is shown to managers
- Responsible AI guidance included
- Designed around existing work
- Flexible for small teams

Optional partner logo placeholder.

---

# 11. Screen 2 — Manager Onboarding

Create a short multi-step onboarding experience.

## Step A — Tell us about your team

Fields:

### Team size

Dropdown or segmented control:

- 2–5
- 6–10
- 11–20
- 21+

### Industry

Dropdown.

Example options:

- Professional services
- Marketing
- Finance
- Technology
- Education
- Not-for-profit
- Other

### Main team function

Examples:

- Marketing
- Operations
- Client service
- HR
- Finance
- Product
- General administration

### Current AI confidence

Options:

- Not using AI
- Exploring occasionally
- Using AI regularly
- Advanced users with inconsistent practices

### Main challenge

Multi-select:

- Unsure what AI tools are safe
- Staff are using AI differently
- Lack of time to learn
- Difficult to turn learning into work
- Staff are reluctant to discuss AI use
- Hard to demonstrate capability
- Other

End with:

> We’ll tailor the four-week sprint around your team’s needs.

CTA:

**Continue**

---

# 12. Screen 3 — Protected Learning-Time Commitment

This is one of the most important screens because it tests the riskiest assumption.

Headline:

**Make learning part of the working week**

Supporting copy:

> The sprint works only if learning does not have to compete with leftover personal time.

Ask the manager to schedule:

### Weekly learning time

Example:

**Wednesday**

**2:00 PM – 3:00 PM**

Allow:

- day selector;
- time selector;
- duration fixed at 1 hour.

Add checkbox:

> ☑ I will protect this hour from normal meetings where reasonably possible.

Add note:

> Your team can change individual timing if operational needs require flexibility.

Primary CTA:

**Protect this learning hour**

Secondary CTA:

**I’m not ready to commit**

If they select the secondary CTA, display a lightweight modal:

> Protected time is the core assumption behind Lead the Way. You can continue exploring the prototype, but the team sprint should not be launched until learning time is agreed.

---

# 13. Screen 4 — Manager Dashboard

Headline:

**Welcome back, Priya**

Show:

## Your four-week AI sprint

Timeline:

### Setup
✓ Manager pathway  
✓ Team AI Agreement  
✓ Invite team

### Week 1
● Learn + Apply

### Week 2
○ Learn + Apply

### Week 3
○ Learn + Apply

### Week 4
○ Show & Tell

Create three primary cards.

## Card 1 — Your learning

**Leading AI at Work**

Progress bar: 65%

Button:

**Continue pathway**

## Card 2 — Team sprint

Example data:

- 8 invited
- 7 joined
- 5 projects in progress
- Week 2 of 4

Button:

**View sprint**

## Card 3 — Team AI Agreement

Status:

**Completed**

Last updated:

**7 September 2026**

Button:

**Review agreement**

Add a visible privacy statement:

> **Aggregate progress only. Individual course activity remains private.**

Do not expose named employee completion percentages.

---

# 14. Screen 5 — Manager Learning Pathway

Do not build a full learning management system.

Prototype only enough content to demonstrate the concept.

Title:

**Leading AI at Work**

Show three modules.

### Module 1
**Why your team needs shared AI norms**  
Estimated time: 5 min

### Module 2
**Supporting AI learning without micromanaging**  
Estimated time: 10 min

### Module 3
**Creating your Team AI Agreement**  
Estimated time: 10 min

Use simple cards with:

- completion state;
- estimated duration;
- one short learning objective.

When all are complete, show:

## Ready to launch?

> You’ve completed the manager pathway. The next step is agreeing how your team will use AI safely and openly.

CTA:

**Create Team AI Agreement**

---

# 15. Screen 6 — Team AI Agreement Builder

Make this screen highly interactive.

Headline:

**Create your Team AI Agreement**

Intro:

> Build a simple shared agreement before the sprint starts. This is not a legal policy. It is a practical team conversation about safe, consistent AI use.

Create four editable sections.

## Section 1 — Tools we use

Example selected items:

- Microsoft Copilot
- ChatGPT Enterprise

Button:

**+ Add tool**

Allow adding another text item.

## Section 2 — What never goes in

Default checklist:

- Client names
- Personal information
- Passwords
- Confidential commercial information
- Unapproved customer data

Allow custom items.

## Section 3 — How we check AI outputs

Checklist:

- Verify factual claims
- Check sources or citations
- Human review before client delivery
- Review tone and context
- Check calculations
- Check for bias or inappropriate assumptions

## Section 4 — When and who to ask

Default prompt:

> Escalate uncertainty when AI output may affect a client decision, sensitive data may be involved, or an approved-tool boundary is unclear.

Allow manager to select a contact:

**AI question contact: Priya**

Primary CTA:

**Save Team Agreement**

On save, show confirmation:

> **Your team now has a shared AI working agreement.**

Then CTA:

**Launch Team Sprint**

---

# 16. Screen 7 — Employee Invitation

Switch prototype perspective from manager to employee.

Display:

## Priya invited you to Lead the Way

Supporting message:

> For the next four weeks, one hour of your working week is protected for practical AI learning.

Show schedule:

**Wednesday**  
**2:00 PM – 3:00 PM**

Goal card:

### Your four-week goal

**Learn one thing → apply it to real work → show what changed.**

Privacy note:

> Your individual SkillsBuild activity is private. Your manager sees only aggregate team participation and the work you choose to share during the final show-and-tell.

Primary CTA:

**Join Team Sprint**

Secondary link:

**View Team AI Agreement**

---

# 17. Screen 8 — Employee Dashboard

Headline:

**Good afternoon, Dan**

Show:

## This week

### Learn

**AI Productivity Fundamentals**

Estimated session:

15 min

Progress:

60%

Button:

**Continue learning**

### Apply

Prompt:

> Use one idea from this week’s learning in a real work task.

Examples:

- improve a client report;
- create a reusable prompt template;
- improve a repetitive email workflow;
- analyse recurring information;
- structure meeting notes;
- create a first draft for human review.

Button:

**Start Work Project**

### Reflect

Status:

**Not started**

Button:

**Add reflection**

---

# 18. Screen 9 — Workplace Application Project

Headline:

**Apply it to your work**

Prompt:

> Choose one real task where this week’s learning could create a useful improvement.

Fields:

### Project title

Example:

**AI-assisted weekly client reporting**

### Before

Prompt:

> How did you complete this task before?

Example placeholder:

> Preparing the weekly client report usually took around two hours and required manually structuring the first draft.

### What I changed

Prompt:

> What did you apply from the learning?

Example placeholder:

> I created a reusable AI prompt to structure the first draft, then checked all client metrics manually.

### After

Prompt:

> What changed?

Example:

> The process now takes about 1 hour 20 minutes.

### Result

Fields:

- time saved;
- quality improvement;
- reduced repetitive work;
- other.

Example metric:

**40 minutes saved per week**

### Human review

Checkbox:

> ☑ I reviewed the output before using it in work.

### Data safety

Checkbox:

> ☑ I did not include restricted client or personal information.

Optional upload control:

**Upload supporting screenshot**

This can remain simulated.

CTA:

**Save Project**

---

# 19. Screen 10 — Weekly Sprint Progress

Create a visually strong four-week progress view.

Title:

**Your AI Sprint**

Example:

### Week 1
✓ Learn  
✓ Apply

### Week 2
✓ Learn  
● Apply

### Week 3
○ Learn  
○ Apply

### Week 4
○ Learn  
○ Show & Tell

Display:

## Next protected learning session

**Wednesday, 2:00 PM**

Button:

**Add to calendar**

No real calendar integration is necessary.

Show a small motivational message:

> You are not expected to learn after hours. This session is part of your working week.

---

# 20. Screen 11 — Week 4 Show-and-Tell

Headline:

**Team AI Show & Tell**

Intro:

> Share what changed, not just what you completed.

Display Dan’s project as a polished case-study card.

## Dan’s Project

### Before

Weekly client reporting took approximately 2 hours.

### What I changed

Used an AI-assisted reporting workflow based on the SkillsBuild learning module.

### After

The task now takes approximately 1 hour 20 minutes.

### Impact

**40 minutes saved per week**

### What I learned

> AI helped speed up the first draft, but I still needed to verify the client metrics manually.

Buttons:

**Present to team**

**Add reflection to badge**

Optional:

**Edit reflection**

The show-and-tell should feel celebratory but professional.

---

# 21. Screen 12 — Badge + Applied Reflection

Do not build a new credential system.

Create a conceptual extension around an existing badge.

Show:

## IBM SkillsBuild Badge

**AI Fundamentals**

Completed:

**24 September 2026**

Then add a new section:

## Applied at work

### Project

AI-assisted client reporting

### Application

> Reduced weekly reporting preparation by approximately 40 minutes while maintaining human review of client metrics.

### Skills demonstrated

Use chips:

- AI prompting
- Critical evaluation
- Responsible AI
- Workflow improvement

Buttons:

**Share on LinkedIn**

**Copy credential link**

These buttons can trigger simple confirmation toasts.

Visually reinforce:

> **Badge = I learned it.**  
> **Applied reflection = I used it.**

---

# 22. Screen 13 — Manager Completion Dashboard

Return to Priya’s manager view.

Headline:

**Sprint complete**

Add a subtle celebratory state.

## Team participation

Example metrics:

- 8 invited
- 7 completed
- 6 applied projects presented

## Team confidence

Show simple pre/post visualisation:

**Before: 2.8 / 5**  
**After: 4.0 / 5**

## Comfort discussing AI

**Before: 2.6 / 5**  
**After: 3.9 / 5**

## Applied projects

**6 projects completed**

Use aggregate data only.

Explicitly show:

> **Individual course activity remains private.**

Do **not** show:

- Dan — 65%
- Sarah — 90%
- named employee ranking;
- employee performance scores.

Primary CTA:

**Run another sprint**

Secondary CTA:

**Invite another team**

---

# 23. Testing Assumptions

The prototype must explicitly support testing of four assumptions.

Add small prototype annotations or a separate “Prototype assumptions” panel.

## A1 — Manager willingness

**Question:**  
Will managers commit one protected hour per employee per week?

Test on:

- protected-time commitment screen;
- manager onboarding;
- programme landing page.

Observable behaviour:

- whether manager commits;
- whether they select a recurring time;
- whether they hesitate or reject the commitment.

---

## A2 — Norm-setting usefulness

**Question:**  
Can managers confidently create simple shared AI norms?

Test on:

- manager pathway;
- Team AI Agreement builder.

Observable behaviour:

- completion of agreement;
- confusion around categories;
- confidence before vs after.

---

## A3 — Workplace application

**Question:**  
Will employees translate course content into a genuine work task?

Test on:

- Work Project screen;
- reflection;
- show-and-tell.

Observable behaviour:

- project creation;
- ability to describe before / change / after;
- measurable outcome.

---

## A4 — Open legitimacy

**Question:**  
Does manager participation and show-and-tell make AI use easier to discuss?

Test on:

- invitation;
- Team AI Agreement;
- show-and-tell;
- post-sprint survey.

Example survey item:

> “I feel comfortable telling my manager how I use AI at work.”

Use a 1–5 Likert scale.

---

# 24. Prototype Test Targets

These can appear in an evaluator mode or documentation page.

## Manager test

Recruit:

**8 managers**

Success signals:

- at least **5 of 8** say they would commit protected time;
- at least **2 managers** agree to launch a trial sprint;
- average manager confidence in setting AI norms improves by at least **1 point** on a 5-point scale.

## Employee / team pilot

Target:

approximately **15–20 learners**

Success signals:

- **≥70%** complete the selected learning pathway;
- **≥60%** present an applied workplace project;
- average comfort discussing AI with a manager improves by **≥1 point**.

These figures are prototype test criteria, not verified product outcomes.

---

# 25. Ethics and Privacy Requirements

The design must demonstrate ethical safeguards visibly rather than hiding them in legal text.

## Voluntary participation

Make clear that participation is intended to be opt-in.

Avoid language implying that completion affects performance review.

Where appropriate, include:

> Participation is for development and is not used as an employee performance score.

## Privacy

Managers may see:

- team invitation count;
- aggregate joins;
- aggregate completion;
- aggregate project count;
- aggregate confidence trends.

Managers must **not** see:

- named employee completion percentages;
- individual time spent;
- individual quiz scores;
- private learning activity;
- employee rankings.

## Workplace data safety

Include reminders that applied projects should use:

- approved tools;
- de-identified data;
- sample data where appropriate;
- human review.

Do not encourage employees to upload confidential work information.

## Accessibility

Use:

- WCAG-aware contrast;
- keyboard-friendly controls;
- visible focus states;
- semantic labels;
- captions/transcripts placeholders for learning media;
- responsive layouts;
- plain language.

---

# 26. Key Product Principles

Use these principles to guide all design decisions.

## Principle 1 — Work first

Learning should feel connected to real work, not separate from it.

## Principle 2 — Application before credential

The real value is what the learner applies, not merely the badge.

## Principle 3 — Managers enable, not surveil

The manager protects time and sets norms without tracking individuals.

## Principle 4 — Team legitimacy matters

AI learning should become openly discussable rather than private.

## Principle 5 — Reuse before rebuild

Use existing SkillsBuild content conceptually wherever possible.

Avoid unnecessary platform redesign.

## Principle 6 — Test behaviour, not preference alone

Important prototype moments should ask users to make commitments or complete actions rather than only saying whether they “like” the idea.

---

# 27. State and Mock Data

Use realistic mock data, **seeded into Convex** (`convex/seed.ts`) rather than held in local state. The full cast and values are in `data-model.md`; the snippet below is the original shape for reference.

Example:

```ts
const manager = {
  name: "Priya",
  teamSize: 8,
  learningDay: "Wednesday",
  learningTime: "2:00 PM",
  managerPathProgress: 65
};

const team = {
  invited: 8,
  joined: 7,
  completed: 6,
  projectsInProgress: 5,
  currentWeek: 2
};

const employee = {
  name: "Dan",
  course: "AI Productivity Fundamentals",
  courseProgress: 60,
  projectTitle: "AI-assisted weekly client reporting",
  timeSavedMinutes: 40
};
```

Screen states update through Convex mutations, so a change made as Priya is visible when switching to Dan (and the reverse).

Examples:

- save Team AI Agreement;
- join sprint;
- mark module complete;
- save workplace project;
- add badge reflection;
- complete show-and-tell.

---

# 28. Interaction Requirements

Implement meaningful prototype interactions.

At minimum:

- navigation between major screens;
- multi-step onboarding;
- form input;
- checkbox commitment;
- editable Team AI Agreement;
- progress state updates;
- project reflection form;
- modal or toast confirmations;
- manager / employee perspective switch;
- simple progress animations;
- completion state;
- responsive behaviour.

Avoid unnecessary novelty animations.

Transitions should reinforce clarity, not distract.

---

# 29. Suggested Navigation

## Manager

Top navigation:

- Dashboard
- My Learning
- Team Agreement
- Team Sprint
- Resources

Profile:

**Priya**

## Employee

Top navigation:

- My Sprint
- Learn
- Apply
- Reflection
- Team Agreement

Profile:

**Dan**

Add a prototype-only role switch in the top-right:

**View as: Manager / Employee**

This is purely for demonstration.

---

# 30. Demo Mode

Add a lightweight demo walkthrough.

A small panel can show:

### Demo steps

1. Manager accepts invitation
2. Manager protects one hour
3. Manager completes pathway
4. Team creates AI Agreement
5. Employee joins
6. Employee applies learning
7. Employee shares project
8. Manager views aggregate outcomes

This lets a marker or reviewer move through the prototype without becoming lost.

---

# 31. Optional Evaluator Panel

If useful, add a discreet “Prototype Notes” button visible only in demo mode.

When opened, show:

### Why this screen exists

Example:

> This screen tests whether managers are willing to convert general support for learning into a specific protected-time commitment.

### HMW connection

Example:

**Working week**

### Test assumption

Example:

**A1 — Manager willingness**

This makes the design rationale transparent without cluttering the normal user experience.

---

# 32. Responsive Behaviour

Design for:

## Desktop

Primary experience.

Recommended width:

1280–1440px.

## Tablet

Ensure forms and dashboard cards reflow cleanly.

## Mobile

Support core screens, but the experience does not need to be optimised as a mobile-first learning platform.

On mobile:

- stack cards vertically;
- preserve progress indicators;
- keep forms readable;
- keep CTA buttons large;
- avoid dense dashboards.

The concept assumes deeper learning and workplace project work will often happen on laptop/desktop.

---

# 33. Prototype Boundaries

Do not overbuild.

The following can be simulated:

- course completion;
- team invitation;
- calendar scheduling;
- badge issuance;
- LinkedIn sharing;
- file upload;
- analytics;
- partner integrations.

Use believable confirmation states.

Example:

> Invitation sent to 8 team members.

Example:

> Project reflection added to credential.

Example:

> Learning session added to calendar.

The goal is to demonstrate the service logic, not production infrastructure.

---

# 34. Success Criteria for the Build

The finished prototype should allow a reviewer to answer:

1. What problem is Lead the Way solving?
2. Why does the experience begin with the manager?
3. Where does the protected learning time appear?
4. How are safe AI norms established?
5. How does learning connect to a real work task?
6. How does the learner demonstrate application?
7. How does the badge become more meaningful?
8. How does the manager see progress without surveilling employees?
9. What happens over the four weeks?
10. Which assumptions are being tested?

If any of these answers are unclear from the interface, improve the design.

---

# 35. Final Deliverables

Produce:

1. a complete high-fidelity responsive web prototype;
2. reusable components;
3. realistic mock data;
4. manager and employee flows;
5. interactive local states;
6. a clear demo flow;
7. a concise README describing:
   - the problem;
   - the HMW;
   - the chosen concept;
   - main user flow;
   - assumptions being tested;
   - prototype limitations.

The prototype should prioritise **clarity, behavioural testing and credible workplace use** over excessive visual effects or technical complexity.

---

# 36. Final Design Narrative

The prototype should communicate this story without requiring a long explanation:

> Dan already has access to AI courses. Access is not enough. Learning loses when it sits outside the working week, has no immediate application and remains socially invisible. Lead the Way changes the environment around learning. Priya first learns how to support safe AI use, creates shared team norms and protects one hour per week. Dan then learns inside paid work time, applies the content to a real task and shares what changed. The result is not simply a completed course. It is learning that is used, completed and openly valued at work.

Build the prototype around that narrative.
