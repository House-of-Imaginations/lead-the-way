# TrackTile

A large selectable tile for choosing a track on Choose a track (phone stacked, laptop side by side, 2px gap).

**Provide:** `kind` (`team` or `career`), `title`, `body`, `tag`, `icon`, `selected`, `onSelect`.

- `layer-01`, 16px padding, icon top-left (20px, `interactive`) and the track tag top-right (`tag-purple-*` for Grow in my role, `tag-blue-*` for Change careers), then a 20px title and one sentence that states the privacy rule for that track.
- Selected: 1px ink outline plus an inset ink line (2px in total). The pair is one single choice: each tile is a label around a hidden native radio, inside a fieldset with a legend (visually hidden, "Choose a track").
- Choosing Grow in my role reveals two radio rows ("I lead a team", "My manager invited me"). The footer button label follows the choice: Set up team, Open my invitation, Start my map. Disabled until a choice is made, with the reason below.
