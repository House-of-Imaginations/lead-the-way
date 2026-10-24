import { expect, test } from "vitest";
import { inviteEmail, reminderEmail } from "../../convex/lib/email/messages";
import { escapeHtml, renderEmail } from "../../convex/lib/email/template";

/**
 * The email template, tested where being quietly wrong costs something.
 *
 * Not the markup -- nobody should be pinning a `<td>` in a test. What earns its
 * place is the escaping, because a workspace name is one signup away from
 * anybody and the output lands as HTML in somebody else's inbox; and the fact
 * that the plain-text part says the same thing as the rich one, because those
 * are written separately and drift silently.
 */

test("a name cannot carry markup into the message", () => {
  const { html } = renderEmail({
    heading: "Join <script>alert(1)</script>",
    paragraphs: ['A "quoted" & ampersanded name'],
    footer: "<b>bold</b>",
  });

  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&quot;quoted&quot;");
  expect(html).toContain("&amp; ampersanded");
  expect(html).not.toContain("<b>bold</b>");
});

test("ampersands are escaped once, not twice", () => {
  // `&` has to go first or every entity the other four produce is mangled into
  // `&amp;lt;` and the reader sees the markup rather than the character.
  expect(escapeHtml("<a & b>")).toBe("&lt;a &amp; b&gt;");
});

test("a link that is not http is not linked", () => {
  const { html } = renderEmail({
    heading: "Hello",
    paragraphs: [],
    action: { label: "Tap", url: "javascript:alert(1)" },
  });

  expect(html).not.toContain("javascript:alert");
  expect(html).toContain('href="#"');
});

test("the plain-text part carries the words and the link", () => {
  const { text } = renderEmail({
    heading: "Join Acme",
    paragraphs: ["You have been invited."],
    action: { label: "Accept", url: "https://example.test/join/abc" },
    footer: "Expires in seven days.",
  });

  expect(text).toContain("Join Acme");
  expect(text).toContain("You have been invited.");
  // The URL spelled out, because a text part with no reachable link is a text
  // part nobody can act on.
  expect(text).toContain("https://example.test/join/abc");
  expect(text).toContain("Expires in seven days.");
  // Entities belong to the HTML half only. A reader of the text part should
  // never see `&amp;`.
  expect(text).not.toContain("&lt;");
});

test("the text part is not escaped, and the html part is", () => {
  const { html, text } = renderEmail({
    heading: "Bob & Co",
    paragraphs: [],
  });
  expect(text).toContain("Bob & Co");
  expect(html).toContain("Bob &amp; Co");
});

test("the invitation email escapes the manager's message", () => {
  const invite = {
    to: "ana@example.com",
    orgName: "Aster Network",
    roleName: "Employee",
    inviterName: "Priya",
    link: "https://example.com/join/tok",
  };
  // No message, no quote paragraph.
  expect(inviteEmail(invite).content.paragraphs).toHaveLength(2);

  const message = '"><img src=x onerror=alert(1)> <b>hi</b>';
  const { html, text } = renderEmail(
    inviteEmail({ ...invite, message }).content,
  );
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<b>hi</b>");
  expect(html).toContain(
    "Priya wrote: &quot;&quot;&gt;&lt;img src=x onerror=alert(1)&gt; &lt;b&gt;hi&lt;/b&gt;&quot;",
  );
  // The plain-text part carries the words as typed.
  expect(text).toContain(`Priya wrote: "${message}"`);
});

test("the reminders say when, in plain words, and how to turn them off", () => {
  const weekly = reminderEmail({
    kind: "weekly",
    week: 2,
    weeks: 4,
    when: "Wednesday 16 September at 2:00 PM, Melbourne time",
    link: "https://example.com/home",
  });
  expect(weekly.subject).toBe("Your protected hour is tomorrow");
  expect(weekly.content).toEqual({
    heading: "Your protected hour is tomorrow",
    paragraphs: [
      "Week 2 of 4: Wednesday 16 September at 2:00 PM, Melbourne time.",
      "One hour of your working week is protected for practical AI learning.",
    ],
    action: { label: "Open your week", url: "https://example.com/home" },
    footer:
      "You get this because reminders are on in From hero to zero. Turn them off in Settings, Notifications.",
  });
  const show = reminderEmail({
    kind: "showAndTell",
    week: 4,
    weeks: 4,
    when: "Wednesday 30 September at 2:00 PM",
  });
  expect(show.subject).toBe("Show and tell is tomorrow");
  expect(show.content.paragraphs).toEqual([
    "Your team's show and tell is in the protected hour on Wednesday 30 September at 2:00 PM.",
    "Bring one way you used AI at work, if you want to share it. Nothing is shared unless you choose to.",
  ]);
  // No link without SITE_URL: no button.
  expect(show.content.action).toBeUndefined();
});
