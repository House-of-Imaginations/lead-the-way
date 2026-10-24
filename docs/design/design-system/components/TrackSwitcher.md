# TrackSwitcher

The "Your tracks" block at the top of the SideNav, shown only when the account has two learner tracks. One row per track.

**Provide:** `tracks`, `selected`.

- Each row: a 32px square (ink with the workspace initials for a team track; white with a 1px ink outline and a `locked` icon for a private career track), the track name in 600 and a caption (workspace and week, or "Private").
- Selected row: `layer-01` with a 1px ink outline. Rows are links and switching tracks navigates: the shell follows the route.
- In the rail only the squares remain; the selected one gets a 2px `interactive` outline.
