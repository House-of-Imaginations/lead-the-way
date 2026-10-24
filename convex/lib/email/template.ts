/**
 * The one shape every email this product sends comes out in.
 *
 * WHY THE COLOURS ARE HEX LITERALS AND NOT TOKENS, which is the first thing a
 * reader of `tokens.css` will object to. An email has no stylesheet. It is
 * rendered by Gmail, Outlook, Apple Mail and a dozen webmail clients that strip
 * `<style>` blocks, do not resolve `var()`, and in Outlook's case use Word as
 * the layout engine. So the palette is copied here as literals, from the
 * light-mode tokens in `src/styles/tokens.css`. If those move, these move with
 * them -- they are a copy, and a copy has to be maintained as one.
 *
 * WHY IT IS A TABLE. Same reason. Flexbox and grid are unreliable in Outlook;
 * a single-column table with inline styles is the shape that renders the same
 * everywhere, and has for twenty years.
 *
 * THE LIGHT GROUND, the product's daylight mode. A dark email lands inside a
 * white client chrome and reads as an advertisement; more importantly, several
 * clients force their own background on the body and leave the text colour
 * alone. Dark text on a light ground survives that inversion.
 */

const PAPER = "#f4f4f4"; // --layer-01, the page
const CARD = "#ffffff"; // --background
const INK = "#161616"; // --text-primary, body text and headings
const BUTTON = "#0f62fe"; // --interactive, the button fill; white text on it
const DIM = "#525252"; // --text-secondary
const HAIRLINE = "#e0e0e0"; // --border-subtle

/**
 * Five characters, `&` first or the entities the other four produce would be
 * double-escaped.
 *
 * EVERY INTERPOLATION GOES THROUGH THIS. Names in this product are chosen by
 * whoever created the thing being named, and a workspace name is one signup
 * away from anybody. An email is HTML delivered to somebody else's inbox, so an
 * unescaped name is a one-tap injection, not a theoretical one.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A URL safe to put in an `href`.
 *
 * Every link this product mails is one it built itself from `SITE_URL`, so this
 * is a belt on top of braces -- but the cost is one comparison and the failure
 * it prevents is `javascript:` or `data:` in a mail client that honours it.
 * Anything that is not plainly http(s) becomes `#` rather than throwing: a mail
 * already queued is not the place to discover a bad link.
 *
 * It returns the URL RAW, not escaped, because the result is used in three
 * places that escape differently -- an `href`, visible HTML, and the plain-text
 * part. Escaping here would put `&amp;` in the text part, where it is just
 * wrong. The one rule is that every one of those three uses this, so a refused
 * URL is refused everywhere: telling somebody to paste a `javascript:` URL into
 * their address bar is the same attack as linking it.
 */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : "#";
}

export type EmailContent = {
  /** The `<h1>`, and the first line of the plain-text part. Escaped here. */
  heading: string;
  /** One paragraph per entry. Escaped here -- pass plain strings. */
  paragraphs: readonly string[];
  /** The one thing to do. A single call to action, or none. */
  action?: { label: string; url: string };
  /** The small print under the rule. Escaped here. */
  footer?: string;
};

/** Both parts of one email: what a rich client draws, and what the rest read. */
export type RenderedEmail = { html: string; text: string };

/**
 * Render one email.
 *
 * IT RETURNS A TEXT PART TOO, and that is not politeness. A message with no
 * `text/plain` alternative scores worse with every major spam filter, and the
 * link in it is unreachable to anybody reading mail in a terminal, on a watch,
 * or through a screen reader that prefers plain text. One template producing
 * both is the only way the two stay saying the same thing.
 */
export function renderEmail(content: EmailContent): RenderedEmail {
  const { heading, paragraphs, action, footer } = content;

  // Checked once, used by all three renderings below. See `safeUrl`.
  const url = action ? safeUrl(action.url) : null;

  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK};">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  // A bulletproof-ish button: a padded anchor rather than a nested table, which
  // is enough everywhere except older Outlook, where it degrades to a plain
  // blue link. The URL is repeated as text underneath for exactly that case,
  // and for anybody whose client strips the anchor entirely.
  const button =
    action && url
      ? `<p style="margin:0 0 16px;">
         <a href="${escapeHtml(url)}"
            style="display:inline-block;padding:12px 22px;border-radius:0;background:${BUTTON};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(action.label)}</a>
       </p>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${DIM};word-break:break-all;">
         Or paste this into your browser:<br />${escapeHtml(url)}
       </p>`
      : "";

  const small = footer
    ? `<hr style="border:none;border-top:1px solid ${HAIRLINE};margin:24px 0;" />
       <p style="margin:0;font-size:13px;line-height:1.6;color:${DIM};">${escapeHtml(footer)}</p>`
    : "";

  // The name is always live type (DESIGN.md "Logo"); there is no wordmark file.
  const logo = `<span style="font-size:18px;font-weight:600;color:${INK};">From hero to zero</span>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:'IBM Plex Sans','Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td style="padding-bottom:24px;">
              ${logo}
            </td>
          </tr>
          <tr>
            <td style="background:${CARD};border:1px solid ${HAIRLINE};border-radius:0;padding:32px 28px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${INK};font-weight:600;">${escapeHtml(heading)}</h1>
              ${body}
              ${button}
              ${small}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // The same words, in the same order, with the link spelled out. Never a
  // stripped-tag version of the HTML -- that drifts the moment the markup does.
  const text = [
    heading,
    "",
    ...paragraphs,
    ...(action && url ? ["", `${action.label}: ${url}`] : []),
    ...(footer ? ["", footer] : []),
  ].join("\n");

  return { html, text };
}
