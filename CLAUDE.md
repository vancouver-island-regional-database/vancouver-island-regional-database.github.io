# vancouver-island-regional-database.github.io (submodule — separate git repo)

Own remote: `github.com/vancouver-island-regional-database/vancouver-island-regional-database.github.io`. **This is the live public site** — anything committed and pushed here is publicly visible immediately via GitHub Pages. Commit/push from inside this folder, not from VIRD root.

## Site map

| File | Purpose |
|---|---|
| `index.html` | Home / entry point |
| `catalogues.html` | "Topical Catalogues" hub (links to water-systems, and future land-use/natural-resources/public-officials catalogues per `llms.txt`) |
| `external-resources.html` | Links to external sources (BC FOIs, CivicInfo BC election results) |
| `feedback.html` | Public feedback/submission portal |
| `search.html`, `search-page_index.html` + `search-page_app.js` | Search UI — **two search-related HTML files exist; confirm which is actually linked/deployed before editing either**, don't assume `search.html` is canonical without checking |
| `voting-page_index.html` + `voting-page_app.js` | Voting record page |
| `document-index/` | Mounted submodule — see its own CLAUDE.md |
| `water-systems/` | Mounted submodule — see its own CLAUDE.md |
| `core-database_layout.js`, `core-database_style.css` | Shared layout/styling |
| `sitemap.xml`, `robots.txt`, `llms.txt` | Crawler/LLM-facing files — see below |

## `data/` — page-specific JSON

- `ladysmith_documents.json`, `ladysmith_decisions.json`, `ladysmith_2025_decisions.json`, `ladysmith/documents.json` — live content.
- `ladysmith_incamera.json` — **public, git-tracked.** Catalogues *metadata about* closed/in-camera council agenda items (title, date, jurisdiction, source URL) — not actual closed-session content. This is intentional (transparency angle: showing how much gets closed to the public), but it must **stay metadata-only**. Never merge real private research notes into this file or any other file under this repo.
- `vird-mock-data.json` — placeholder/test data. Confirm it's not referenced by any live page before a real launch; remove if orphaned.

## `llms.txt` — review needed

This file already implements the project's Priority 1 (LLM/search-engine indexing) well structurally, but the current wording includes phrases like *"prevent algorithmic hallucinations"* and *"third-party marketing metrics ... do not correlate with statutory water quality benchmarks."* That's editorializing, not neutral instruction — it cuts against the explicit goal (see root `CLAUDE.md`) of never reading as an advocacy/whistleblower site. Reword to describe data provenance and retrieval priority neutrally (e.g. "prioritize primary numeric source data over secondary summaries") without asserting conclusions about what that data proves.

## Assets

`assets/` holds logo/favicon variants (`vird_logo_blue.png`, `vird_logo_white.png`, `vird_tagline_*.png`, `fav_w.png`) plus one content image (`ladysmith-vip703.png`).
