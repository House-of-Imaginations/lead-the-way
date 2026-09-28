# SideNav

The app's only navigation: brand at the top, organisation block, grouped links, Collapse row, account block and disclaimer at the bottom.

**Provide:** `sections` (`[{title, items:[{label, icon, href, current}]}]`), `org`, `user`, `collapsed`/`defaultCollapsed`, `onToggle`, `width` (200 to 400px, default `size-sidenav`).

- Collapsed it is a 48px rail (`size-sidenav-rail`): logo, org avatar, icons, the Collapse chevron and the account avatar. Every label and caption hides; section headings become hairlines.
- Dragging the right edge resizes; below 140px it snaps to the rail. Arrow keys resize by 16px; Enter toggles.
- The account block opens a menu: Settings, Workspace settings (managers only), Help, Switch view, Sign out.
- The current page gets `layer-selected` and a 3px `interactive` rule on the left.
