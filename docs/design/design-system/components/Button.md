# Button

Square Carbon button with the label left and an optional icon pushed to the right edge.

**Provide:** `children` (label, sentence case, 1 to 3 words), `kind`, optional `icon` (a Carbon icon name such as `arrow--right`), `size`, `href` to render a link, `onClick`, `disabled`.

**Kinds**
- `primary` (`interactive`): the one action that moves the flow forward. One per view: Continue, Save agreement, Send invitations, Start the lesson.
- `secondary` (`button-secondary`): the partner of a primary in a pair: Back, Cancel, Add.
- `tertiary`: an outline action that sits beside content, such as Download summary.
- `ghost`: low emphasis inside tiles and toolbars: Edit, View all.
- `danger`: destructive and text-only until hovered: Remove member, Leave workspace.

**Sizes:** `lg` 48px default, `md` 40px next to inputs, `sm` 32px in table rows, `xl` 64px as full-width footer pairs in setup flows and modals (label sits top-left).

**Do** pair secondary left, primary right with no gap in a footer. **Don't** round the corners, use two primaries side by side, or disable a button without saying why nearby (Save project stays disabled until both safety checks are ticked, and the checklist says so).
