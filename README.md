# Top Matches 2026

A small static site for picking and ranking your top 10 tennis matches of 2026.

- Browse a seeded list of notable ATP and WTA matches, filter by tour, and search by player or event.
- Add up to 10 matches, then reorder them by dragging or with the arrow buttons.
- Add any match that isn't in the list.
- Picks are saved in your browser (localStorage).
- "Copy share link" puts your list in the URL so anyone can open it and save it as their own.

## Run it

No build step. Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server
```

To host it, turn on GitHub Pages for the default branch (Settings → Pages → Deploy from a branch → `main` / root).

## Editing the match list

Seed matches live in `matches.js`. Scores are written from the winner's side, and a tiebreak shows the loser's points in parentheses, e.g. `7–6(5)`.
