# LinkVault

**Offline-first PWA for organizing saved links into files — installable as a standalone application, works with no internet, notepad-style UI.**

LinkVault is a personal alternative to browser bookmarks: a clean vault app where you group saved links (tutorials, videos, articles, tools) under files you name yourself, and each link is saved under whatever name you give it — not the raw URL.

---

## Features

- 🌐 **Google Account & Multi-Device Sync** — sign in with your Google email to access and sync your files and links automatically across all your phones, laptops, and tablets
- 📁 **Files for your links** — create files to group related links together (e.g. "React Tutorials", "Interview Prep", "Design Systems") without clutter
- 🔗 **Name-your-own links** — every saved link is stored under a name you choose; tapping that name opens the real URL in a new tab
- 📲 **Installable Standalone App** — modern PWA with `manifest.json` and service worker, installable directly as a native desktop or mobile application (not a simple Chrome shortcut)
- 📴 **Fully offline** — a service worker caches the whole app shell and Firestore provides offline persistence, so it works with no internet connection
- ✏️ **Full CRUD** — create, rename, or delete files and links, with a confirmation step before anything is removed
- 🔍 **Search** — filter files or the links inside a file by name
- ✍️ **Notepad-style UI** — ruled-paper background, serif typography, minimal and distraction-free
- 🔒 **Private by design** — guest data lives locally on your device (`localStorage`); signed-in data is stored in your private Firebase Firestore database

---

## Tech stack

Plain HTML, CSS, and JavaScript with modular Firebase Web SDKs (CDN) — no build tools or package manager needed.

| File | Purpose |
|---|---|
| `index.html` | App shell, modals & markup |
| `style.css` | Notepad theme, auth UI, layout, responsive rules |
| `app.js` | State management, rendering, CRUD, Google Auth, real-time sync & PWA installation |
| `manifest.json` | PWA metadata — app id, standalone display mode, display override, icons |
| `service-worker.js` | Caches app assets for offline use (v9) |
| `_headers` | Netlify headers for manifest and service worker |
| `icon-192.png` | 192px app icon |
| `icon-512.png` | 512px app icon |
| `icon-maskable-512.png` | 512px maskable adaptive app icon |

---

## Google Sign-In & Multi-Device Sync Setup

To enable Google Sign-In and access your links on any device:

1. Go to the [Firebase Console](https://console.firebase.google.com) and create a **Free** project (e.g. `LinkVault`).
2. In your Firebase project dashboard:
   - Go to **Build** -> **Authentication** -> **Get Started**.
   - Under the **Sign-in method** tab, enable **Google**. Set your support email and click **Save**.
   - Go to **Build** -> **Firestore Database** -> **Create database** -> Choose **Start in production mode** (or test mode).
3. Under **Project Settings (⚙️)** -> **General** -> scroll down to **Your apps** -> click the **Web (</>)** icon:
   - Register your app (e.g. "LinkVault Web").
   - Copy the `firebaseConfig` object (with `apiKey`, `projectId`, etc.).
4. In LinkVault:
   - Open LinkVault in your browser, tap the **Account (👤)** icon -> **Sign In with Google** (or **⚙️ Configure Firebase Project Keys**).
   - Paste the config object and click **Save & Connect**!
5. In Firebase Console (**Authentication** -> **Settings** -> **Authorized domains**):
   - Add your Netlify domain (e.g. `your-site.netlify.app`) and `localhost`.

Now you can sign in with your Google email on any device and all your links will stay synchronized in real time!

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
