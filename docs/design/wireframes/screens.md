# Screens and flow

Every screen of the clickable prototype, in journey order. For each: the route to build, who is using it, the reference image and HTML source, why the screen exists (research note), where each link goes, and the on-screen copy verbatim.

- **PNG** (`png/`): the rendered screen at its design size (1440 wide desktop, 390 wide mobile). Match layout, spacing and hierarchy.
- **Source** (`source/`): the prototype HTML with the exact CSS values and copy. Read the `<style>` block for measurements. The `<script src="./support.js">` and `<x-dc>`, `<sc-if>`, `<sc-for>`, `{{ }}` markup are a canvas runtime: ignore them, they are not React.
- **Copy** below is extracted from the rendered screen (input values are not included; see the source). Use it as written, fixing only hyphenated time ranges like `2:00-3:00 PM` to `2:00 to 3:00 PM`. Sidebar text is omitted after the first shell screen; the shell is specified once in `05`.

## Route map

| # | Screen | Route | Persona |
|---|---|---|---|
| Main | Prototype guide | `/guide` | Evaluator |
| 01 | Partner invitation email | `/demo/partner-email` | Priya |
| 02 | Landing page (superseded by docs/design/landing/index.html) | `/` | Priya (visitor) |
| 02a | Sign up (shadcn login-02 layout) | `/signup` | Priya |
| 02b | Log in (shadcn login-02 layout) | `/login` | Priya or Dan |
| 03 | Setup 1: your team | `/setup/team` | Priya |
| 04 | Setup 2: protected hour (+ "not ready" dialog) | `/setup/protected-hour` | Priya |
| 05 | Manager pathway: Leading AI at Work | `/manager/learning` | Priya |
| 06 | Team AI Agreement builder | `/manager/agreement` | Priya |
| 07 | Launch sprint and invite team | `/manager/sprint/launch` | Priya |
| 08 | Manager overview | `/manager` | Priya |
| 09 | Employee invitation | `/join/[token]` | Dan |
| 10 | Read and sign the Team AI Agreement | `/me/agreement` | Dan |
| 11 | This week (employee home) | `/me` | Dan |
| 12 | Work project: apply it to your work | `/me/project` | Dan |
| 13 | My sprint (four-week progress) | `/me/sprint` | Dan |
| 14 | Week 4 show and tell | `/me/show-and-tell` | Dan |
| 15 | Credential: badge plus applied reflection | `/me/credential` | Dan |
| 16 | Sprint complete: team outcomes | `/manager/outcomes` | Priya |
| 17 | Personal settings (manager) | `/settings` | Priya |
| 18 | Workspace settings | `/workspace/settings` | Priya |
| 19 | Personal settings (employee, opens on Privacy and sharing) | `/me/settings` | Dan |
| M1 | Mobile: invitation | `/join/[token] at 390px` | Dan |
| M2 | Mobile: this week | `/me at 390px` | Dan |
| M3 | Mobile: work project | `/me/project at 390px` | Dan |
| M4 | Mobile: credential | `/me/credential at 390px` | Dan |

Main flow: `/` → `/signup` → `/setup/team` → `/setup/protected-hour` → `/manager/learning` → `/manager/agreement` → `/manager/sprint/launch` → `/manager` → (switch to Dan) `/join/[token]` → `/me/agreement` → `/me` → `/me/project` → `/me/sprint` → `/me/show-and-tell` → `/me/credential` → (switch to Priya) `/manager/outcomes`. Returning users enter through `/login`.

---

## Main Prototype guide

- Route: `/guide`  
- Persona: Evaluator  
- Design size: 1440 x 1540  
- PNG: `png/Main.png`  
- Source: `source/Main.dc.html`

**Links**

- Start the walkthrough → `/demo/partner-email`
- Start as Dan → `/join/[token]`
- Priya, screens 01 to 03 Accepts the invitation Partner email → `/demo/partner-email`
- Priya, screen 04 Protects one hour A recurring weekly slot a → `/setup/protected-hour`
- Priya, screen 05 Completes the pathway Leading AI at Work, a → `/manager/learning`
- Priya, screens 06 to 08 Sets norms and launches Team AI Agre → `/manager/agreement`
- Dan, screens 09 to 11 Joins the sprint Invitation, agreement → `/join/[token]`
- Dan, screens 12 and 13 Applies it to real work Work project, → `/me/project`
- Dan, screens 14 and 15 Shares what changed Show and tell, ba → `/me/show-and-tell`
- Priya, screen 16 Sees team outcomes Aggregate results only → `/manager/outcomes`

**Copy**

```text
Lead the WayPrototype guide
Concept prototype. Not an official IBM product.
Lead the Way
A manager-first SkillsBuild team path. Priya learns first, sets shared AI norms and protects one paid hour a week. Dan learns inside that hour, applies it to a real task and shows what changed.
Start the walkthrough
Start as Dan
How might we
make AI learning part of the working week for mid-career professionals in AI-exposed roles, so that what they learn is used, completed and openly valued at work?
Walkthrough
Press Play on any screen. The account menu in the header switches between Priya and Dan. Research notes sit above each screen on the canvas.
Priya, screens 01 to 03
Accepts the invitation
Partner email, landing page, team details
Priya, screen 04
Protects one hour
A recurring weekly slot and a commitment
Priya, screen 05
Completes the pathway
Leading AI at Work, about 25 minutes
Priya, screens 06 to 08
Sets norms and launches
Team AI Agreement, invites, overview
Dan, screens 09 to 11
Joins the sprint
Invitation, agreement, this week
Dan, screens 12 and 13
Applies it to real work
Work project, weekly progress
Dan, screens 14 and 15
Shares what changed
Show and tell, badge with reflection
Priya, screen 16
Sees team outcomes
Aggregate results only
Assumptions under test
Assumption
Question
Tested on
Observable behaviour
A1 Manager willingness
Will managers commit one protected hour per employee per week?
02 Landing, 03 Onboarding, 04 Protected hour, 07 Invite
Commits or not; picks a recurring time; hesitates or rejects
A2 Norm-setting
Can managers confidently create simple shared AI norms?
05 Pathway, 06 Agreement builder
Completes the agreement; confusion by category; confidence before and after
A3 Workplace application
Will employees translate course content into a genuine work task?
12 Work project, 14 Show and tell
Creates a project; describes before, change, after; states a measurable result
A4 Open legitimacy
Does manager participation and show and tell make AI use easier to discuss?
09 Invitation, 10 Agreement, 14 Show and tell, 16 Survey
“I feel comfortable telling my manager how I use AI at work.” Rated 1 to 5
Manager test
Recruit 8 managers
5 of 8
or more say they would commit protected time
2
or more agree to launch a trial sprint
+1 point
average confidence setting AI norms, 5-point scale
Team pilot
About 15 to 20 learners
70%
or more complete the selected learning pathway
60%
or more present an applied workplace project
+1 point
average comfort discussing AI with a manager
These are prototype test criteria, not verified product outcomes. All data is mocked. Course completion, invitations, calendar holds, badge issuance and sharing are simulated. Company, association and people are fictional.
```

---

## 01 Partner invitation email

- Route: `/demo/partner-email`  
- Persona: Priya  
- Design size: 1440 x 1180  
- PNG: `png/01-Partner-Email.png`  
- Source: `source/01-Partner-Email.dc.html`

**Research note**

> WHY: Tests whether an industry association or SME partner is a credible channel to reach managers of employed teams.
> HMW: Part of the working week
> TESTS: A1 Manager willingness (entry point)
> EVIDENCE, pin 1 VIABLE: extends IBM's best-performing wraparound partnership channel to employed teams (IBM Q&A 1 and 2).

**Links**

- Start the Manager Path → `/`
- Unsubscribe → `/`

**Copy**

```text
Inbox
Concept prototype. Not an official IBM product.
Lead your team into AI. Free, 4 weeks, with SkillsBuild.
From
Southbank Business Collective <programs@southbankcollective.org.au>
To
Priya Raman
Date
Tuesday 1 September 2026, 9:12 AM
SB
Southbank Business Collective
Member program
Lead your team into AI
Hi Priya,
As a member, your team can join Lead the Way: a free four-week AI sprint for managers and their teams, built on existing IBM SkillsBuild courses.
It starts with you. You get a short manager path, a ready-made Team AI Agreement, and a plan to protect one working hour a week, so your team learns during work instead of after it.
60 min
Leading AI in Your Team: safe use, checking outputs, supporting nervous learners
30 min
One team conversation that ends with four shared AI rules
4 x 1 hr
A protected weekly hour to learn, apply it to real work and show what changed
Start the Manager Path
Participation is voluntary and uses paid work time. Learning data is never used for performance review.
Sent by Southbank Business Collective on behalf of the SkillsBuild partner program. Unsubscribe
```

---

## 02 Landing page (superseded by docs/design/landing/index.html)

- Route: `/`  
- Persona: Priya (visitor)  
- Design size: 1440 x 2880  
- PNG: `png/02-Landing.png`  
- Source: `source/02-Landing.dc.html`

**Research note**

> WHY: Is the proposition clear and attractive enough for a manager to continue? Does '1 protected hour' read as a benefit or a cost?
> HMW: Working week, Openly valued
> TESTS: A1. Observe which CTA they choose and how they react to the privacy split.
> EVIDENCE, pins 1, 7, 8: partner channel; curates existing SkillsBuild content; aggregate-only, opt-in, not used for performance review.

**Links**

- How it works → `#`
- Starter kit → `#`
- Privacy → `#`
- Log in → `/login`
- Start the Manager Path → `/signup`
- See how it works → `#`
- Start path → `/setup/team`
- See the template → `/manager/agreement`
- Accessibility → `#`
- Terms of use → `#`
- Cookie preferences → `#`

**Copy**

```text
A Southbank Business Collective member program, delivered with IBM SkillsBuild
Concept prototype. Not an official IBM product.
Lead the Way
How it works
Starter kit
Privacy
Log in
Lead the Way: AI at work, together
Help your team build practical AI capability in four weeks, with protected learning time, shared norms and workplace application.
Start the Manager Path
See how it works
Protected learning hour
Client Services, 8 people
Mon
Tue
Wed
Thu
Fri
Week 1
Learn 2-3 PM
Week 2
Learn 2-3 PM
Week 3
Learn 2-3 PM
Week 4
Show and tell
Team AI Agreement
Signed by 8 people, including the manager
Manager view
Team totals only, never individuals
4 weeks
A short, finite sprint. Not another open-ended subscription.
1 hour
Protected each week, inside paid work time, for everyone on the team.
Real work
Each person applies what they learn to one task they already do.
Free
Delivered by your association on existing SkillsBuild courses.
It starts with you, then the whole team
You set up the conditions once. Your team learns together instead of alone.
Learn
You, 60 min
Safe use, checking outputs and supporting nervous learners.
Set norms
Your team, 30 min
One conversation, four rules, signed by everyone.
Launch
You, 5 min
Protect one hour per person each week and send the invites.
Apply
Everyone, weeks 1 to 3
A short module, then one real task that same week.
Share
Everyone, week 4
Show what changed and how you checked the AI output.
Manager Starter Kit
Curated from existing SkillsBuild content, plus a downloadable kit. Nothing to design or buy.
Leading AI in Your Team
A 60-minute manager path you finish before your team starts.
Start path
Team AI Agreement
A one-page template your team completes in 30 minutes.
See the template
Inclusive facilitation guide
For part-time, CALD and neurodivergent staff, plus a Responsible AI checklist.
15-minute mentor call
With an IBM volunteer, through IBM Month of Impact.
You see the team, not the individual
Participation is opt-in and never used for performance review.
What managers see
Invitations and joins
Team completion, as a total
Number of applied projects
Team confidence, before and after
Projects people choose to share
What managers never see
Named completion percentages
Time each person spent
Quiz scores
Private learning activity
Rankings of any kind
Start with one hour a week
Finish the manager path first. Your team is invited only once the hour is agreed.
Start the Manager Path
Lead the Way
Concept prototype, not an official IBM product. Captions and transcripts on all learning. WCAG 2.2 AA.
Program
How it works
Starter kit
Support
Privacy
Accessibility
Legal
Terms of use
Cookie preferences
```

---

## 02a Sign up (shadcn login-02 layout)

- Route: `/signup`  
- Persona: Priya  
- Design size: 1440 x 900  
- PNG: `png/02a-Sign-Up.png`  
- Source: `source/02a-Sign-Up.dc.html`

**Research note**

> WHY: Priya creates her account after choosing 'Start the Manager Path' on the landing page, then goes straight into setup (03). Layout follows the shadcn login-02 split: form left, brand panel right.
> HMW: Working week
> TESTS: A1 drop-off between landing and setup. Password or single sign-on.
> NOTE: the panel's tile grid is Mon to Fri by four sprint weeks, with Wednesday (the protected hour) in blue.

**Behaviour**

- Two columns at 50/50 like shadcn `login-02`: brand top-left, form centred in a 360px column, brand panel on the right. Below 1024px the panel hides and the form centres on white.
- The panel is `layer-01` with three stair blocks (`tag-blue-bg`, `text-primary`, `interactive`) and a 5 x 4 tile grid (Mon to Fri by four weeks) whose Wednesday column is `interactive`. It is decorative (`aria-hidden`).
- Password field has a show/hide toggle (`view` / `view--off` icons, `aria-pressed`). Helper text under email and password.
- 'Create account' is disabled until the terms box is ticked (the checkbox sits directly above it).
- 'Sign up with single sign-on' uses the Carbon `enterprise` icon, no third-party logos. On success both paths go to `/setup/team`.
- Prototype fields are prefilled with Priya's details; the real app starts empty.

**Links**

- Lead the Way → `/`
- terms of use → `#`
- privacy notice → `#`
- Create account → `/setup/team`
- Sign up with single sign-on → `/setup/team`
- Log in → `/login`

**Copy**

```text
Lead the Way
Create your account
Set up a four-week AI sprint for your team.
Full name
Work email
Use your work address so your team can find you.
Password
At least 12 characters. A short phrase works well.
I agree to the terms of use and privacy notice.
Create account
Or continue with
Sign up with single sign-on
Already have an account? Log in
Concept prototype. Not an official IBM product.
Start with one hour a week.
You learn first, agree the rules with your team, then protect the hour. Your team joins after that.
```

---

## 02b Log in (shadcn login-02 layout)

- Route: `/login`  
- Persona: Priya or Dan  
- Design size: 1440 x 900  
- PNG: `png/02b-Log-In.png`  
- Source: `source/02b-Log-In.dc.html`

**Research note**

> Returning users log in with a work email and password or single sign-on. 'Forgot your password?' shows an inline confirmation that never reveals whether the account exists. Below 1024px the brand panel hides and the form centres, as in login-02.

**Behaviour**

- Same split layout and panel as sign up.
- 'Forgot your password?' shows a success notification: "Check your email. If an account exists for that address, we sent a reset link." It never reveals whether the account exists.
- Password show/hide toggle. 'Log in' and 'Log in with single sign-on' route by role: managers to `/manager` (or the next unfinished setup step), employees to `/me`.
- Errors use the field error pattern (red outline, message below): "Check your email and password and try again." shown once under the password field, not per field, so it doesn't reveal which one was wrong.

**Links**

- Lead the Way → `/`
- Forgot your password? → `#`
- Log in → `/manager`
- Log in with single sign-on → `/manager`
- Sign up → `/signup`

**Copy**

```text
Lead the Way
Log in to your account
Enter your work email to continue your sprint.
Work email
Password
Forgot your password?
Log in
Or continue with
Log in with single sign-on
Don’t have an account? Sign up
Concept prototype. Not an official IBM product.
Learning that fits inside the working week.
One protected hour, a shared set of rules and a real task to try it on.
```

---

## 03 Setup 1: your team

- Route: `/setup/team`  
- Persona: Priya  
- Design size: 1440 x 900  
- PNG: `png/03-Onboarding.png`  
- Source: `source/03-Onboarding.dc.html`

**Research note**

> WHY: Light tailoring, plus a baseline for norm-setting confidence (the A2 before measure).
> HMW: Working week, Used
> TESTS: A1 drop-off before the commitment; A2 baseline on a 1 to 5 scale.
> EVIDENCE, pin 2 OPENLY VALUED: managers want guidance first. 'My problem is eight people using the tool in eight different ways' (Andrew).

**Links**

- Save and exit → `/`
- Back → `/`

**Copy**

```text
Lead the Way
Set up your team sprint
Concept prototype. Not an official IBM product.
Save and exit
Your team
2 minutes
Protected hour
1 minute
Manager pathway
25 minutes
Team agreement
30 minutes, with your team
Invite team
2 minutes
Tell us about your team
A few details so the sprint fits the work your team already does.
Page 1 of 2
Team size
2-5
6-10
11-20
21+
Industry
Professional services
Marketing
Finance
Technology
Education
Not-for-profit
Other
Main team function
Marketing
Operations
Client service
HR
Finance
Product
General administration
How does your team use AI today?
Not using AI
Little or no use yet
Exploring occasionally
A few people try it now and then
Using AI regularly
Part of some weekly tasks
Advanced users, inconsistent practices
Heavy use, but everyone does it differently
Back
Continue
```

---

## 04 Setup 2: protected hour (+ "not ready" dialog)

- Route: `/setup/protected-hour`  
- Persona: Priya  
- Design size: 1440 x 900  
- PNG: `png/04-Protected-Hour.png`  
- Source: `source/04-Protected-Hour.dc.html`

**Research note**

> WHY: The riskiest assumption. The screen asks for a commitment, not an opinion.
> HMW: Part of the working week
> TESTS: A1. Observe: commits or not, picks a recurring slot, hesitation, reasons given in the 'not ready' dialog. Target: 5 of 8 managers would commit.
> EVIDENCE, pin 4 WORKING WEEK: 'It's not the hours. It's which hour?' (Simon).

**Links**

- Save and exit → `/`
- Your team → `/setup/team`
- Back → `/setup/team`

**Copy**

```text
Lead the Way
Set up your team sprint
Concept prototype. Not an official IBM product.
Save and exit
Your team
6-10 people, client service
Protected hour
1 minute
Manager pathway
25 minutes
Team agreement
30 minutes, with your team
Invite team
2 minutes
Make learning part of the working week
The sprint works only if learning does not have to compete with leftover personal time.
Weekly learning day
Mon
7 Sep
Tue
8 Sep
Wed
9 Sep
Thu
10 Sep
Fri
11 Sep
Start time
9:00 AM
10:00 AM
11:00 AM
12:00 PM
1:00 PM
2:00 PM
3:00 PM
4:00 PM
Duration
I will protect this hour from normal meetings where reasonably possible.
Your team can change individual timing if operational needs require flexibility.
Wednesdays, 2:00 PM to 3:00 PM
Added to your team’s calendars when you launch
8 hrs
paid time a week, team total
Mon
Tue
Wed
Thu
Fri
Week 1
7 Sep
8 Sep
9 Sep
Learn 2 PM
10 Sep
11 Sep
Week 2
14 Sep
15 Sep
16 Sep
Learn 2 PM
17 Sep
18 Sep
Week 3
21 Sep
22 Sep
23 Sep
Learn 2 PM
24 Sep
25 Sep
Week 4
28 Sep
29 Sep
30 Sep
Learn 2 PM
1 Oct
2 Oct
I’m not ready to commit
Back
Protect this learning hour
```

---

## 05 Manager pathway: Leading AI at Work

- Route: `/manager/learning`  
- Persona: Priya  
- Design size: 1440 x 960  
- PNG: `png/05-Manager-Pathway.png`  
- Source: `source/05-Manager-Pathway.dc.html`

**Research note**

> WHY: The manager learns first, without building a new LMS. Three short curated modules.
> HMW: Openly valued, Completed
> TESTS: A2. Compare after-pathway confidence with the onboarding baseline. Target: +1 point.
> EVIDENCE, pins 2 and 7: guidance first; curates existing SkillsBuild content.

**Links**

- Lead the Way → `/manager`
- CL Calder Lane Client Services team → `/workspace/settings`
- Overview → `/manager`
- Sprint → `/manager/sprint/launch`
- Team agreement → `/manager/agreement`
- Outcomes → `/manager/outcomes`
- My learning → `/manager/learning`
- Resources → `/manager`

**Copy**

```text
Lead the Way
CL
Calder Lane
Client Services team
Team
Overview
Sprint
Team agreement
Outcomes
You
My learning
Resources
Sprint setup
Protected hour
Manager pathway
Team agreement
Invite team
Collapse
PR
Priya Raman
Team manager
Concept prototype. Not an official IBM product.
My learning
/
Leading AI at Work
Three short modules that prepare you to lead your team’s sprint. Built from existing SkillsBuild courses, about 25 minutes in total.
Progress
1 of 3 complete
Why your team needs shared AI norms
5 min
See why consistent, visible AI use reduces risk and hidden workarounds.
Completed
Supporting AI learning without micromanaging
10 min
Protect time and celebrate application while keeping individual learning private.
In progress
Creating your Team AI Agreement
10 min
Run a 30-minute conversation that ends with four shared rules.
Not started
0:00 / 9:36
Captions on
Module 2 of 3
Supporting AI learning without micromanaging
Your job is to protect the hour and use AI openly yourself, not to track who finished what. Lead the Way only ever shows you team totals.
Open transcript
Mark as complete
The full 60-minute Leading AI in Your Team path stays open during the sprint.
```

---

## 06 Team AI Agreement builder

- Route: `/manager/agreement`  
- Persona: Priya  
- Design size: 1440 x 1160  
- PNG: `png/06-Agreement-Builder.png`  
- Source: `source/06-Agreement-Builder.dc.html`

**Research note**

> WHY: Turns private, improvised AI habits into a visible team norm. The live preview shows the one-page output the team signs.
> HMW: Openly valued, Used
> TESTS: A2 completion and confusion by category; A4 'Using AI here is normal'.
> EVIDENCE, pins 3 and 9: targets mutual concealment (Simon, Andrew); formalises rules workers already improvise. 'I always take the brand name out' (Simon).

**Links**

- Lead the Way → `/manager`
- CL Calder Lane Client Services team → `/workspace/settings`
- Overview → `/manager`
- Sprint → `/manager/sprint/launch`
- Team agreement → `/manager/agreement`
- Outcomes → `/manager/outcomes`
- My learning → `/manager/learning`
- Resources → `/manager`

**Copy**

```text
Create your Team AI Agreement
Draft
Build a simple shared agreement before the sprint starts. This is not a legal policy. It is a practical team conversation about safe, consistent AI use.
Download PDF
Save Team Agreement
Tools we use
Approved tools only. Anything else, ask first.
Microsoft Copilot
ChatGPT Enterprise
Add a tool
Add
What never goes in
Practise with de-identified or sample data.
Select all that apply
Client names
Personal information
Passwords
Confidential commercial information
Unapproved customer data
Add your own
Add
How we check AI outputs
A person checks before it counts.
Select all that apply
Verify factual claims
Check sources or citations
Human review before client delivery
Review tone and context
Check calculations
Check for bias or inappropriate assumptions
When and who to ask
Asking should feel normal, not like a confession.
When to escalate
AI question contact
Priya Raman
#ai-questions channel
Privacy officer
Live preview
One page, A4
Our Team AI Agreement
Client Services, 7 September 2026
Tools we use
Microsoft Copilot, ChatGPT Enterprise
What never goes in
Client names, Personal information, Passwords, Confidential commercial information, Unapproved customer data
How we check outputs
Verify factual claims
Check sources or citations
Human review before client delivery
Review tone and context
When and who to ask
Escalate uncertainty when AI output may affect a client decision, sensitive data may be involved, or an approved-tool boundary is unclear.
Ask Priya Raman.
Using AI here is normal. Tell us what works, what fails and what you learn.
Signed by the team, including the manager
PR
Team members sign when they join. Review date 30 September 2026.
```

---

## 07 Launch sprint and invite team

- Route: `/manager/sprint/launch`  
- Persona: Priya  
- Design size: 1440 x 960  
- PNG: `png/07-Launch-Sprint.png`  
- Source: `source/07-Launch-Sprint.dc.html`

**Research note**

> WHY: The team is invited only once time, training and norms are in place. The manager's message models open AI use.
> HMW: Working week, Openly valued
> TESTS: A1 trial-sprint signal (target: 2 of 8 managers launch); A4 tone of the message.
> EVIDENCE, pin 7 FEASIBLE: downloadable kit plus a lightweight grant agreement with the partner (Q&A 2).

**Links**

- Lead the Way → `/manager`
- CL Calder Lane Client Services team → `/workspace/settings`
- Overview → `/manager`
- Sprint → `/manager/sprint/launch`
- Team agreement → `/manager/agreement`
- Outcomes → `/manager/outcomes`
- My learning → `/manager/learning`
- Resources → `/manager`
- Preview invitation → `/join/[token]`
- Team AI Agreement → `/manager/agreement`

**Copy**

```text
Launch your 4-week sprint
Protect 1 hour per person per week. Each person applies what they learn to one real task, then shares it at the week 4 show and tell.
Preview invitation
Invite your team
8 people
dan.okafor@calderlane.com.au
sarah.whitlock@calderlane.com.au
mei.tanaka@calderlane.com.au
tomas.reyes@calderlane.com.au
aisha.karimi@calderlane.com.au
luca.bianchi@calderlane.com.au
grace.oyelaran@calderlane.com.au
omar.haddad@calderlane.com.au
Add by email
Add
Message from you
Shown at the top of the invitation.
Joining is voluntary and never used as a performance score.
Send invitations
Sprint summary
Protected hour
Wednesdays, 2:00-3:00 PM
Runs
9 to 30 September 2026
Learning
AI Productivity Fundamentals
Existing SkillsBuild course, 4 sessions of 15 min
Weekly task
Apply one idea to real work
Week 4
Show and tell, 30 September
Agreement
Team AI Agreement
Saved 7 September
```

---

## 08 Manager overview

- Route: `/manager`  
- Persona: Priya  
- Design size: 1440 x 1000  
- PNG: `png/08-Manager-Dashboard.png`  
- Source: `source/08-Manager-Dashboard.dc.html`

**Research note**

> WHY: Enough for the manager to keep the sprint alive without surveillance. No names, no individual percentages.
> HMW: Working week, Completed
> TESTS: A1. Is aggregate data enough? Watch for requests for individual data and reactions to 'Why can't I see individual progress?'
> EVIDENCE, pin 8 PRIVACY: aggregate-only, opt-in, not used for performance review (APPs, section 4).

**Links**

- Lead the Way → `/manager`
- CL Calder Lane Client Services team → `/workspace/settings`
- Overview → `/manager`
- Sprint → `/manager/sprint/launch`
- Team agreement → `/manager/agreement`
- Outcomes → `/manager/outcomes`
- My learning → `/manager/learning`
- Resources → `#`
- Preview team view → `/join/[token]`
- Invite member → `/manager/sprint/launch`
- Continue pathway → `/manager/learning`
- View sprint → `#`
- Review agreement → `/manager/agreement`

**Copy**

```text
Good afternoon, Priya
Your team is in week 2. The next protected hour is Wednesday 16 September at 2:00 PM.
Preview team view
Invite member
Aggregate progress only. Individual course activity remains private.
Your four-week AI sprint
Setup, 1 to 8 Sep
Manager pathway
Team AI Agreement
Invite team
Week 1, 9 Sep
Learn and apply
Week 2, 16 Sep (current)
Learn and apply
Week 3, 23 Sep
Learn and apply
Week 4, 30 Sep
Show and tell
Your learning
Leading AI at Work
Sprint coaching modules
65%
Continue pathway
Team sprint
Week 2 of 4
Active
Invited
8
Joined
7
Projects
5
View sprint
Team AI Agreement
Signed by the team
Completed
Last updated 7 September 2026. You’ll review it together at the week 4 show and tell.
Review agreement
Team progress
Team totals, updated daily
Joined the sprint
7 of 8
Week 1 session done
6 of 7
Real tasks underway
5 of 7
Why can’t I see individual progress?
Resources
Inclusive facilitation guide
For part-time, CALD and neurodivergent staff
Open
Responsible AI checklist
Approved tools, de-identified data, human review
Open
Show and tell run sheet
A 30-minute format for week 4
Open
15-minute mentor call
With an IBM volunteer, through Month of Impact
Book
```

---

## 09 Employee invitation

- Route: `/join/[token]`  
- Persona: Dan  
- Design size: 1440 x 960  
- PNG: `png/09-Employee-Invite.png`  
- Source: `source/09-Employee-Invite.dc.html`

**Research note**

> WHY: Switches to Dan. The invitation carries protected time, a clear goal and a privacy promise, sent by his own manager.
> HMW: Working week, Openly valued
> TESTS: A4. Does a manager-sent invitation make AI learning feel legitimate?
> EVIDENCE, pins 4 and 8: protected working hour; aggregate-only visibility.

**Links**

- Join Team Sprint → `/me`
- View Team AI Agreement → `/me/agreement`

**Copy**

```text
Lead the Way
Calder Lane
Concept prototype. Not an official IBM product.
DO
Dan Okafor
PR
Priya Raman, Team manager
Priya invited you to Lead the Way
For the next four weeks, one hour of your working week is protected for practical AI learning.
“I’ve done the manager path and blocked Wednesdays 2-3 PM for the next four weeks. Using AI here is normal. Let’s work out together what helps.”
Priya Raman
Join Team Sprint
View Team AI Agreement
Your protected hour
Wednesday, 2:00-3:00 PM
9 to 30 September 2026. Paid work time, already in your calendar.
Your four-week goal
Learn one thing
15-minute sessions of AI Productivity Fundamentals
Apply it to real work
Use it on one task you already do each week
Show what changed
Share it at the team show and tell on 30 Sep
Your learning stays private
Your individual SkillsBuild activity is private. Your manager sees only aggregate team participation and the work you choose to share at the final show and tell. Participation is for development and is not used as a performance score.
```

---

## 10 Read and sign the Team AI Agreement

- Route: `/me/agreement`  
- Persona: Dan  
- Design size: 1440 x 1060  
- PNG: `png/10-Employee-Agreement.png`  
- Source: `source/10-Employee-Agreement.dc.html`

**Research note**

> WHY: Dan reads and signs the norms the team agreed. Signing makes the rules shared rather than personal.
> HMW: Openly valued
> TESTS: A4 open legitimacy.
> EVIDENCE, pins 3 and 9: mutual concealment becomes a team norm; safe-use rules workers already improvise.

**Links**

- Lead the Way → `/me`
- This week → `/me`
- My sprint → `/me/sprint`
- Work project → `/me/project`
- Show and tell → `/me/show-and-tell`
- Credential → `/me/credential`
- Team agreement → `/me/agreement`

**Copy**

```text
Client Services, agreed 7 September 2026
Our Team AI Agreement
Tools we use
Microsoft Copilot, ChatGPT Enterprise. Anything else, ask first.
What never goes in
Client names, personal information, passwords, confidential commercial information, unapproved customer data.
Practise with de-identified or sample data.
How we check outputs
Verify factual claims
Check sources or citations
Human review before client delivery
Review tone and context
When and who to ask
Escalate uncertainty when AI output may affect a client decision, sensitive data may be involved, or an approved-tool boundary is unclear.
Ask Priya Raman.
Using AI here is normal. Tell us what works, what fails and what you learn.
Signatures
7
of 9
PR
SW
MT
TR
AK
LB
GO
DO
Signing means you’ve read it and will follow it. You can raise changes at the week 4 review.
Sign the agreement
```

---

## 11 This week (employee home)

- Route: `/me`  
- Persona: Dan  
- Design size: 1440 x 1000  
- PNG: `png/11-Employee-Dashboard.png`  
- Source: `source/11-Employee-Dashboard.dc.html`

**Research note**

> WHY: Learning sits inside the working week, and every session pairs with a real task.
> HMW: Working week, Used
> TESTS: A3. Does Dan start a project from the Apply prompts?
> EVIDENCE, pin 5 USED, COMPLETED: 'I'd definitely finish it if it actually helped me with my work' (Simon, follow-up).

**Links**

- Lead the Way → `/me`
- This week → `/me`
- My sprint → `/me/sprint`
- Work project → `/me/project`
- Show and tell → `/me/show-and-tell`
- Credential → `/me/credential`
- Team agreement → `/me/agreement`
- Improve a client report → `/me/project`
- Create a reusable prompt template → `/me/project`
- Improve a repetitive email workflow → `/me/project`
- Analyse recurring information → `/me/project`
- Structure meeting notes → `/me/project`
- Draft for human review → `/me/project`
- Start work project → `/me/project`
- Add reflection → `/me/project`
- View sprint → `/me/sprint`
- Read in full → `/me/agreement`

**Copy**

```text
Good afternoon, Dan
Week 2 of 4. Your protected hour starts today at 2:00 PM.
Protected time, Wed 2:00-3:00 PM
This week
Learn
15 min session
AI Productivity Fundamentals
Session 2: writing reusable prompts for recurring work.
Course progress
60%
Continue learning
Apply
Use one idea in a real work task
Some ideas that fit this week’s session:
Improve a client report
Create a reusable prompt template
Improve a repetitive email workflow
Analyse recurring information
Structure meeting notes
Draft for human review
Start work project
Reflect
Not started
What changed, and how you checked it
A few sentences after you’ve tried it. You decide later whether to share it at the show and tell.
Add reflection
Your sprint
View sprint
Week 1
Done
Week 2
In progress
Week 3
23 Sep
Week 4
Show and tell
You are not expected to learn after hours. This session is part of your working week.
Team AI Agreement
Read in full
Tools we use
Microsoft Copilot, ChatGPT Enterprise
Never goes in
Client names, personal information, passwords
Unsure?
Ask Priya Raman
```

---

## 12 Work project: apply it to your work

- Route: `/me/project`  
- Persona: Dan  
- Design size: 1440 x 1480  
- PNG: `png/12-Work-Project.png`  
- Source: `source/12-Work-Project.dc.html`

**Research note**

> WHY: The core of A3. Before, change, after, a measurable result and two safety checks.
> HMW: Used in real work
> TESTS: A3. Do people create a project, describe before, change and after, and state a result?
> EVIDENCE, pins 5 and 9: a real task and an audience; safe-use rules.

**Links**

- Lead the Way → `/me`
- This week → `/me`
- My sprint → `/me/sprint`
- Work project → `/me/project`
- Show and tell → `/me/show-and-tell`
- Credential → `/me/credential`
- Team agreement → `/me/agreement`
- Cancel → `/me`

**Copy**

```text
Apply it to your work
Choose one real task where this week’s learning could create a useful improvement.
Use Dan’s example
The task
Something you already do most weeks.
Project title
Before, change, after
Plain words. Rough numbers are fine.
How did you complete this task before?
What did you apply from the learning?
What changed?
Result
Pick any that apply.
Type of improvement
Time saved
Quality improvement
Reduced repetitive work
Other
Headline result
Checks
Both are required to save.
I reviewed the output before using it in work.
I did not include restricted client or personal information.
Supporting screenshot
Optional. De-identified only.
Drag a file here or click to upload
PNG or JPG, up to 5 MB.
Cancel
Save project
Before you start
Use approved tools: Copilot, ChatGPT Enterprise
Use de-identified or sample data
A person reviews every output
Don’t upload confidential work files
From this week’s session
Reusable prompt templates
Write the structure once, then reuse it for work that repeats every week. Check every number it produces.
```

---

## 13 My sprint (four-week progress)

- Route: `/me/sprint`  
- Persona: Dan  
- Design size: 1440 x 960  
- PNG: `png/13-Sprint-Progress.png`  
- Source: `source/13-Sprint-Progress.dc.html`

**Research note**

> WHY: Four finite weeks, visible progress, and a clear reminder that this is work time.
> HMW: Working week, Completed
> TESTS: A3 and completion. Target: 70% complete the pathway.
> EVIDENCE, pin 4 WORKING WEEK: learning moves into paid time.

**Links**

- Lead the Way → `/me`
- This week → `/me`
- My sprint → `/me/sprint`
- Work project → `/me/project`
- Show and tell → `/me/show-and-tell`
- Credential → `/me/credential`
- Team agreement → `/me/agreement`
- Apply, in progress → `/me/project`

**Copy**

```text
Your AI Sprint
9 to 30 September 2026. Three of eight activities done.
Sprint progress
3 of 8
Week 1
Done
9 September
Learn
Apply
Week 2
Now
16 September
Learn
Apply, in progress
Week 3
23 September
Learn
Apply
Week 4
30 September
Learn
Show and tell
Next protected learning session
Wednesday, 2:00 PM
16 September, 1 hour, protected from meetings
Add to calendar
This is work time
You are not expected to learn after hours. This session is part of your working week. If a client deadline clashes, move it to another slot that week.
```

---

## 14 Week 4 show and tell

- Route: `/me/show-and-tell`  
- Persona: Dan  
- Design size: 1440 x 1060  
- PNG: `png/14-Show-and-Tell.png`  
- Source: `source/14-Show-and-Tell.dc.html`

**Research note**

> WHY: An audience gives a reason to finish, and sharing makes AI use discussable.
> HMW: Completed, Openly valued
> TESTS: A3 measurable outcome; A4 open discussion. Target: 60% present a project.
> EVIDENCE, pins 5 and 6: a real task and an audience; 'then I want to know the story behind it' (Andrew).

**Links**

- Lead the Way → `/me`
- This week → `/me`
- My sprint → `/me/sprint`
- Work project → `/me/project`
- Show and tell → `/me/show-and-tell`
- Credential → `/me/credential`
- Team agreement → `/me/agreement`
- Edit reflection → `/me/project`
- Add reflection to badge → `/me/credential`

**Copy**

```text
Team AI Show and Tell
Week 4
Share what changed, not just what you completed.
Dan’s project
AI-assisted weekly client reporting
40 min
saved per week
Before
Weekly client reporting took approximately 2 hours.
What I changed
Used an AI-assisted reporting workflow from the SkillsBuild module.
After
The task now takes approximately 1 hour 20 minutes.
What I learned
“AI helped speed up the first draft, but I still needed to verify the client metrics manually.”
Output reviewed
No restricted data
Edit reflection
Add reflection to badge
Present to team
In this session
AI-assisted weekly client reporting
Dan
Meeting notes to action list
Mei
Faster proposal first drafts
Sarah
Client email templates
Tomás
Onboarding FAQ from past tickets
Aisha
Monthly survey summary
Luca
Everyone chose to share. Nothing is shared automatically.
Discuss as a team
What worked?
What failed, and how did you notice?
What should we add to our Team AI Agreement?
```

---

## 15 Credential: badge plus applied reflection

- Route: `/me/credential`  
- Persona: Dan  
- Design size: 1440 x 1040  
- PNG: `png/15-Badge-Reflection.png`  
- Source: `source/15-Badge-Reflection.dc.html`

**Research note**

> WHY: Reuses the existing SkillsBuild badge and adds evidence of application. No new credential technology.
> HMW: Openly valued
> TESTS: A3 and A4.
> EVIDENCE, pin 6 VISIBLE VALUE: badge = completion; the project = capability.

**Links**

- Lead the Way → `/me`
- This week → `/me`
- My sprint → `/me/sprint`
- Work project → `/me/project`
- Show and tell → `/me/show-and-tell`
- Credential → `/me/credential`
- Team agreement → `/me/agreement`

**Copy**

```text
Your credential
Your existing SkillsBuild badge, with evidence of how you used it at work.
Copy credential link
Share on LinkedIn
IBM SkillsBuild badge
AI Fundamentals
Completed 24 September 2026
Badge = I learned it.
+
Applied at work
Shared at show and tell, 30 Sep
Project
AI-assisted client reporting
Application
Reduced weekly reporting preparation by approximately 40 minutes while maintaining human review of client metrics.
Skills shown
AI prompting
Critical evaluation
Responsible AI
Workflow improvement
Applied reflection = I used it.
You choose what goes on your credential. Your course activity and time spent are never shown.
```

---

## 16 Sprint complete: team outcomes

- Route: `/manager/outcomes`  
- Persona: Priya  
- Design size: 1440 x 1100  
- PNG: `png/16-Manager-Outcomes.png`  
- Source: `source/16-Manager-Outcomes.dc.html`

**Research note**

> WHY: The manager sees team outcomes only, including the A4 survey item.
> HMW: all four outcomes
> TESTS: A2 and A4 before and after. Target: +1 point on comfort discussing AI with a manager.
> EVIDENCE, pin 8 PRIVACY. All figures are mock data.

**Links**

- Lead the Way → `/manager`
- CL Calder Lane Client Services team → `/workspace/settings`
- Overview → `/manager`
- Sprint → `/manager/sprint/launch`
- Team agreement → `/manager/agreement`
- Outcomes → `/manager/outcomes`
- My learning → `/manager/learning`
- Resources → `/manager`
- Run another sprint → `/setup/protected-hour`
- Review the Team AI Agreement with your team → `/manager/agreement`

**Copy**

```text
Sprint complete
Finished 30 Sep
Your team made AI learning part of the working week. Here is what changed, as a team.
Invite another team
Run another sprint
Team participation
Invited
8
Completed the sprint
7
Applied projects presented
6
Before and after
Team average on a 1 to 5 scale, 7 responses
Before, 8 Sep
After, 30 Sep
Confidence using AI at work
1
2
3
4
5
Before
2.8
After
4.0
Comfort discussing AI with my manager
“I feel comfortable telling my manager how I use AI at work.”
1
2
3
4
5
Before
2.6
After
3.9
Applied projects
6 projects completed
Reporting and drafting
2
Email workflows
2
Meeting notes
1
Analysis
1
Individual course activity remains private.
These are team totals. No names, scores, rankings or time spent are shown.
Review the Team AI Agreement with your team
```

---

## 17 Personal settings (manager)

- Route: `/settings`  
- Persona: Priya  
- Design size: 1440 x 960  
- PNG: `png/17-Settings.png`  
- Source: `source/17-Settings.dc.html`

**Research note**

> Opened from the account menu at the bottom of the sidebar. Personal settings only: profile, reminders, and a note that Priya's own pathway progress is private too.

**Links**

- Lead the Way → `/manager`
- CL Calder Lane Client Services team → `/workspace/settings`
- Overview → `/manager`
- Sprint → `/manager/sprint/launch`
- Team agreement → `/manager/agreement`
- Outcomes → `/manager/outcomes`
- My learning → `/manager/learning`
- Resources → `/manager`
- Cancel → `/manager`

**Copy**

```text
Settings
Your personal account settings. Team and sprint settings live in Workspace settings.
Profile
Notifications
Privacy
Full name
Work email
Job title
Time zone
Australia/Melbourne (AEST)
Australia/Sydney (AEST)
Australia/Perth (AWST)
Accessibility
Turn captions on by default
Reduce motion
Cancel
Save changes
```

---

## 18 Workspace settings

- Route: `/workspace/settings`  
- Persona: Priya  
- Design size: 1440 x 1040  
- PNG: `png/18-Workspace-Settings.png`  
- Source: `source/18-Workspace-Settings.dc.html`

**Research note**

> Opened from the organisation switcher at the top of the sidebar or the account menu. Members has roles only, no participation status. Data and privacy adds a small-group threshold: team totals hide below 5 responses, supporting pin 8 PRIVACY.

**Links**

- Lead the Way → `/manager`
- CL Calder Lane Client Services team → `/workspace/settings`
- Overview → `/manager`
- Sprint → `/manager/sprint/launch`
- Team agreement → `/manager/agreement`
- Outcomes → `/manager/outcomes`
- My learning → `/manager/learning`
- Resources → `/manager`
- Cancel → `/manager`

**Copy**

```text
Workspace settings
Calder Lane, Client Services team. Changes apply to everyone in the workspace.
Owner: Priya Raman
General
Members
Sprint defaults
Data and privacy
Workspace name
Team name
Industry
Professional services
Marketing
Finance
Technology
Education
Not-for-profit
Main team function
Client service
Marketing
Operations
HR
Finance
Product
Partner program
Set by your partner. Contact them to change it.
Workspace ID
Cancel
Save changes
```

---

## 19 Personal settings (employee, opens on Privacy and sharing)

- Route: `/me/settings`  
- Persona: Dan  
- Design size: 1440 x 960  
- PNG: `png/19-Employee-Settings.png`  
- Source: `source/19-Employee-Settings.dc.html`

**Research note**

> Dan's settings open on Privacy and sharing: he controls what reaches the team, his credential and survey totals. Supports A4: open legitimacy needs a sense of control, not surveillance.

**Links**

- Lead the Way → `/me`
- This week → `/me`
- My sprint → `/me/sprint`
- Work project → `/me/project`
- Show and tell → `/me/show-and-tell`
- Credential → `/me/credential`
- Team agreement → `/me/agreement`
- Cancel → `/me`

**Copy**

```text
Settings
Your account, reminders and what you share. Workspace settings are managed by Priya Raman.
Profile
Notifications
Privacy and sharing
Ask me before anything is shared
Nothing reaches your team or manager without your say-so.
Add applied reflections to my credential
Shown only on credential links you share.
Include my survey answers in team averages
Always anonymous. Hidden when fewer than 5 people respond.
Priya never sees
Your course progress
Time you spent learning
Quiz scores
Anything you haven’t shared
Cancel
Save changes
```

---

## M1 Mobile: invitation

- Route: `/join/[token] at 390px`  
- Persona: Dan  
- Design size: 390 x 1000  
- PNG: `png/M1-Employee-Invite.png`  
- Source: `source/M1-Employee-Invite.dc.html`

**Research note**

> Mobile covers Dan's core loop: invitation, this week, work project, credential. Layouts stack to one column with 48px touch targets. Deeper project work is expected on desktop.

**Links**

- Join Team Sprint → `/me at 390px`
- View Team AI Agreement → `/me/agreement`

**Copy**

```text
Lead the Way
DO
PR
Priya Raman, Team manager
Priya invited you to Lead the Way
For the next four weeks, one hour of your working week is protected for practical AI learning.
Your protected hour
Wednesday, 2:00-3:00 PM
9 to 30 September. Paid work time.
Your four-week goal
Learn one thing
Apply it to real work
Show what changed
Your SkillsBuild activity is private. Priya sees only team totals and what you choose to share.
Join Team Sprint
View Team AI Agreement
```

---

## M2 Mobile: this week

- Route: `/me at 390px`  
- Persona: Dan  
- Design size: 390 x 1260  
- PNG: `png/M2-Employee-Dashboard.png`  
- Source: `source/M2-Employee-Dashboard.dc.html`

**Links**

- Improve a client report → `/me/project at 390px`
- Reusable prompt template → `/me/project at 390px`
- Email workflow → `/me/project at 390px`
- Meeting notes → `/me/project at 390px`
- Start work project → `/me/project at 390px`
- Add reflection → `/me/project at 390px`
- View → `/me/sprint`

**Copy**

```text
Lead the Way
DO
Good afternoon, Dan
Week 2 of 4. Your protected hour starts today at 2:00 PM.
Protected time, Wed 2:00-3:00 PM
Learn
15 min
AI Productivity Fundamentals
Session 2: writing reusable prompts for recurring work.
Course progress
60%
Continue learning
Apply
Use one idea in a real work task
Improve a client report
Reusable prompt template
Email workflow
Meeting notes
Start work project
Reflect
Not started
What changed, and how you checked it
Add reflection
Your sprint
View
Wk 1
Done
Wk 2
Now
Wk 3
23 Sep
Wk 4
30 Sep
You are not expected to learn after hours. This session is part of your working week.
```

---

## M3 Mobile: work project

- Route: `/me/project at 390px`  
- Persona: Dan  
- Design size: 390 x 1320  
- PNG: `png/M3-Work-Project.png`  
- Source: `source/M3-Work-Project.dc.html`

**Links**

- Back → `/me at 390px`

**Copy**

```text
Work project
Apply it to your work
Choose one real task where this week’s learning could create a useful improvement.
Use Dan’s example
Project title
How did you complete this task before?
What did you apply from the learning?
What changed?
Headline result
Checks (both required)
I reviewed the output before using it in work.
I did not include restricted client or personal information.
Use approved tools and de-identified data. Don’t upload confidential work files.
Save project
```

---

## M4 Mobile: credential

- Route: `/me/credential at 390px`  
- Persona: Dan  
- Design size: 390 x 1240  
- PNG: `png/M4-Badge.png`  
- Source: `source/M4-Badge.dc.html`

**Links**

- Back → `/me/project at 390px`

**Copy**

```text
Credential
Your credential
IBM SkillsBuild badge
AI Fundamentals
Completed 24 September 2026
Badge = I learned it.
Applied at work
Project
AI-assisted client reporting
Application
Reduced weekly reporting preparation by approximately 40 minutes while maintaining human review of client metrics.
Skills shown
AI prompting
Critical evaluation
Responsible AI
Workflow improvement
Applied reflection = I used it.
Share on LinkedIn
Copy credential link
You choose what goes on your credential. Course activity and time spent are never shown.
```
