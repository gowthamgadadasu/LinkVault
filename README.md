# LinkVault

**Offline-first PWA for organizing saved links into files — installable as a standalone application, works with no internet, notepad-style UI.**

LinkVault is a personal alternative to browser bookmarks: a clean vault app where you group saved links (tutorials, videos, articles, tools) under files you name yourself, and each link is saved under whatever name you give it — not the raw URL.

---

## Features

- 🎨 **10 Semantic Themes (Theme Studio)** — switch dynamically between 10 design profiles (Midnight, Ocean, Forest, Sunset, Paper, Monochrome, Cyber, Professional, Aurora, Terracotta) with instant live previews
- 🌐 **Multi-Device Cloud Sync** — sign in with Google or Email/Password to sync your files and links automatically across phones, laptops, and tablets
- 📁 **Files & Notebooks for your links** — create folders to group related links together without clutter
- 🔗 **Name-your-own links & descriptions** — give every link a title, paste the URL, and add custom notes with a 1-tap `ⓘ` info viewer
- 📲 **Installable Standalone PWA** — install directly as a native desktop or mobile application with custom adaptive chain-link icons
- 📴 **Fully offline** — service worker caches all assets and Firestore provides offline persistence
- ⚡ **Gestures & Shortcuts** — double-click, right-click, or long-press to rename/delete; press Enter to save instantly
- 🔒 **Private & Secure** — includes automatic account deletion and database record purging

---

## Tech stack

Plain HTML, CSS, and JavaScript with modular Firebase Web SDKs (CDN) — zero build tools or dependencies needed.

| File | Purpose |
|---|---|
| `index.html` | App shell, Theme Studio modal, and overlays |
| `style.css` | 10 semantic design profiles, responsive rules & tokens |
| `app.js` | State management, CRUD, Theme Studio, Firebase Auth & sync |
| `manifest.json` | PWA metadata — app id, standalone display mode, icons |
| `service-worker.js` | Caches app assets for offline use (v20) |
| `_headers` | Netlify headers for manifest and service worker |
| `icon-192.png` | 192px app icon |
| `icon-512.png` | 512px app icon |
| `icon-maskable-512.png` | 512px maskable adaptive app icon |

---

## User Sign-In & Multi-Device Sync

Your Firebase project is pre-configured in `app.js`! Users can sign in using either:
- **1-Click Google Sign-In**
- **Email & Password** (Sign In or Create an Account)

To log in:
1. Tap the **Account (👤)** icon in the top right.
2. Either tap **Continue with Google**, or enter your email and password.
3. All your files and links will now sync in real time across any phone, laptop, or tablet you log into!

*Note for Netlify deployments:* Remember to add your Netlify domain (e.g. `your-site.netlify.app`) to **Authorized domains** in the [Firebase Console](https://console.firebase.google.com) (under **Authentication** -> **Settings** -> **Authorized domains**). Also ensure **Email/Password** is enabled under **Authentication** -> **Sign-in method**.

---

## Getting started

### Run it locally
Service workers require a proper origin (`localhost` or `https://`, not `file://`), so serve the folder:

```bash
# from inside the project folder
python -m http.server 8080
# then open http://localhost:8080
```

### Install as a Standalone Application
- **Desktop (Chrome / Edge / Brave)**: Open the app, click the **Install** button in the top bar or bottom banner (or click the Install icon in the browser address bar), and LinkVault will install in its own standalone application window.
- **Mobile (Android Chrome)**: Tap the **Install** banner or choose **Install app** from the Chrome menu.
- **iOS (Safari)**: Tap **Share** -> **Add to Home Screen**.

### Deploy it
Any static host with HTTPS works (HTTPS is required for PWA installation in production):

1. Go to [netlify.com/drop](https://app.netlify.com/drop) or [Vercel](https://vercel.com) / [GitHub Pages](https://pages.github.com)
2. Drag the project folder in or connect the repo
3. Open the live URL on your computer or phone and install the app

---

## Project structure

```
linkvault/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── service-worker.js
├── _headers
├── icon-192.png
├── icon-512.png
├── icon-maskable-512.png
└── README.md
```

---

## Notes for future development

- Bump `CACHE_NAME` in `service-worker.js` (e.g. `linkvault-cache-v5`) whenever you change `app.js`, `style.css`, or `index.html` — otherwise installed users may keep seeing a stale cached version.
- Data lives in `localStorage` under the key `linkvault.data.v1`. Automatic migration from older versions (e.g., legacy notebooks) is handled seamlessly on startup.

## License

Personal project — MIT or custom terms.
