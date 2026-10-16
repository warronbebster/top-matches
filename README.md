# Top Matches 2026

A small static site for picking and ranking your top 10 tennis matches of 2026.

- Browse a seeded list of notable ATP and WTA matches, filter by tour, and search by player or event.
- Add up to 10 matches, then reorder them by dragging or with the arrow buttons.
- Add any match that isn't in the list.
- Picks are saved in your browser (localStorage).
- "Submit" sends your name and ranked list to a Google Sheet. Resubmitting from the same browser updates your row instead of adding a new one.
- "Copy share link" puts your list in the URL so anyone can open it and save it as their own.

The look follows served.bracket.tennis: the Served colors, Magical Night display font, obviously-narrow body font (IBM Plex Sans Condensed where the Adobe Fonts kit doesn't load), and the court illustration.

## Run it

No build step. Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server
```

To host it, turn on GitHub Pages for the default branch (Settings → Pages → Deploy from a branch → `main` / root).

## Turning on submissions (Google Sheets)

Submissions go through a small Google Apps Script web app attached to the sheet. It runs as you, so there are no API keys in the site.

1. Create a Google Sheet, then open **Extensions → Apps Script**.
2. Replace the editor's contents with [`apps-script/Code.gs`](apps-script/Code.gs) and save.
3. **Deploy → New deployment**, type **Web app**, "Execute as: **Me**", "Who has access: **Anyone**". Approve the permissions prompt.
4. Copy the web app URL (ends in `/exec`) into `submitUrl` in [`config.js`](config.js).

Rows land on a `Submissions` tab: time, name, a per-browser ID, how many times they've submitted, picks #1–#10 as readable text, and the match IDs. Apps Script's consumer quotas (about 30 simultaneous requests) are plenty for this; if traffic ever outgrows it, the same POST body can go to a Cloudflare Worker with D1 instead.

## Editing the match list

Seed matches live in `matches.js`. Scores are written from the winner's side, and a tiebreak shows the loser's points in parentheses, e.g. `7–6(5)`.
