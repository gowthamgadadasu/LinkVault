# LinkVault

**Offline-first PWA for organizing saved links into custom notebooks — installable, works with no internet, notepad-style UI.**

LinkVault is a personal alternative to browser bookmarks: a notebook-style app where you group saved links (tutorials, videos, articles, tools) under folders you name yourself, and each link is saved under whatever name you give it — not the raw URL.

---

## Features

- 📓 **Custom notebooks** — create as many folders as you want (e.g. "React Tutorials", "Interview Prep"), each with its own color
- 🔗 **Name-your-own links** — every saved link is stored under a name you choose; tapping that name opens the real URL in a new tab
- 📴 **Fully offline** — a service worker caches the whole app shell, so it works with no internet connection after the first load
- 📲 **Installable** — has a `manifest.json`, so it can be added to your phone's home screen and opens full-screen, with no browser bar
- ✏️ **Full CRUD** — rename or delete notebooks and links, with a confirmation step before anything is removed
- 🔍 **Search** — filter notebooks or the links inside a notebook by name
- ✍️ **Notepad-style UI** — ruled-paper background, Times New Roman font, inspired by the Samsung Notes app
- 🔒 **Private by design** — all data is stored locally on your device (`localStorage`); nothing is sent to a server

---

## Tech stack

Plain HTML, CSS, and JavaScript — no framework, no build step, no dependencies.

| File | Purpose |
|---|---|
| `index.html` | App shell / markup |
| `style.css` | Notepad-style theme, layout, responsive rules |
| `app.js` | State management, rendering, notebook/link CRUD, install prompt, service worker registration |
| `manifest.json` | PWA metadata — name, icons, theme colors, standalone display mode |
| `service-worker.js` | Caches app assets for offline use |
| `icons/` | App icons (192px, 512px, and a maskable 512px for Android adaptive icons) |

---

## Getting started

### Run it locally
Service workers require a proper origin (not `file://`), so serve the folder instead of opening `index.html` directly:

```bash
# from inside the project folder
python3 -m http.server 8080
# then open http://localhost:8080
```

### Deploy it
Any static host works. The quickest path with no account setup:

1. Go to [netlify.com/drop](https://app.netlify.com/drop)
2. Drag the project folder in
3. Sign up / log in to **claim** the site (recommended — unclaimed drops expire)
4. Open the live URL on your phone and tap **Install** / **Add to Home screen**

### Update the icon
Replace the three files in `icons/` — keeping the same filenames and sizes (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) — then redeploy. For the maskable icon, keep the artwork within the center ~72% of the canvas so Android's adaptive-icon mask doesn't crop it.

---

## Project structure

```
linkvault/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── service-worker.js
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```

---

## Notes for future development

- Bump `CACHE_NAME` in `service-worker.js` (e.g. `linkvault-cache-v3`) whenever you change `app.js`, `style.css`, or `index.html` — otherwise installed users may keep seeing a stale cached version.
- Data lives in `localStorage` under the key `linkvault.data.v1`; there's currently no export/import or sync between devices.

## License

Personal project — add a license here if you plan to make the repo public and want to define reuse terms (e.g. MIT).
