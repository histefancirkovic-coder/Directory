# Directory

Filterable directory of motion work for `stefancirkovic.com/directory`.

- `works.json` — the list of entries (edit this to add work)
- `directory.js` / `directory.css` — the widget, loaded on the Webflow page via jsDelivr
- `thumbs/` — custom thumbnails (for X, Instagram, LinkedIn, Pinterest, case studies)
- `demo/` — local preview (`python3 -m http.server`, then open `/demo/`)

## Adding an entry

```json
{
  "id": "ramp-glass",                       // unique, lowercase-with-dashes
  "title": "Introducing Glass",
  "client": "Ramp",
  "url": "https://www.youtube.com/watch?v=wxc_1JHVLlA",
  "year": 2026,
  "added": "2026-11-17",                    // used for "Newest" sorting within a year
  "duration": "1:48",                       // optional
  "description": "",                        // optional
  "type": ["Feature launch"],               // Feature launch, Promo, Demo, Explainer, Case study, Social
  "discipline": [],                         // Logo animation, Web motion, 3D, 2D, Editing, Storytelling
  "industry": ["Finance"],                  // Finance, Tech, AI, SaaS
  "tool": [],                               // After Effects, Lottie, Cavalry, Spline, Cinema 4D
  "thumbnail": "thumbs/ramp-glass.jpg"      // optional; full URL or path in this repo
}
```

- `source` is detected from the URL (YouTube, Vimeo, X, Pinterest, Instagram, LinkedIn, Framerate, Website).
- YouTube and Vimeo thumbnails are fetched automatically.
- New tag values not in the lists above appear in the filters automatically.
- The page reads `works.json` straight from GitHub, so changes show up within ~5 minutes.

## Webflow embed

```html
<div id="sc-directory"></div>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/histefancirkovic-coder/directory@v1/directory.css">
<script src="https://cdn.jsdelivr.net/gh/histefancirkovic-coder/directory@v1/directory.js" defer></script>
```

To ship a widget update: commit, then move the `v1` tag (or create `v1.x`) — jsDelivr serves tagged versions.
