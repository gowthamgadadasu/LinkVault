(() => {
  "use strict";

  // ============================================================
  //  🔑 FIREBASE CONFIG — FILL THIS ONCE, USERS NEVER SEE IT
  //  Get these values from: https://console.firebase.google.com
  //  Project Settings (⚙️) -> General -> Your Apps -> Web (</>)
  // ============================================================
  const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  const STORAGE_KEY = "linkvault.data.v1";

  // ---------- Firebase Init ----------
  let firebaseReady = false;

  function initFirebaseApp() {
    if (typeof firebase === "undefined") return false;
    if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
      console.warn("LinkVault: Firebase config not set. Cloud sync disabled.");
      return false;
    }
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
        firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(() => {});
      }
      firebaseReady = true;
      return true;
    } catch (err) {
      console.error("Firebase init error:", err);
      return false;
    }
  }

  // ---------- Local Storage ----------
  function loadLocalData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.notebooks && !parsed.files) {
          return {
            files: parsed.notebooks.map((nb) => ({
              id: nb.id, name: nb.name, links: nb.links || [],
              createdAt: nb.createdAt || Date.now(), updatedAt: nb.updatedAt || Date.now(),
            })),
          };
        }
        if (parsed.files) return parsed;
      }
    } catch (e) {}
    return { files: [] };
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    if (state.currentUser && firebaseReady) {
      try {
        firebase.firestore().collection("users").doc(state.currentUser.uid)
          .set({ ...state.data, lastSyncedAt: Date.now() }, { merge: true })
          .catch((err) => console.warn("Cloud save error:", err));
      } catch (e) {}
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- State ----------
  const state = {
    data: loadLocalData(),
    view: "files",
    currentFileId: null,
    searchQuery: "",
    editingFileId: null,
    editingLinkId: null,
    pendingDelete: null,
    currentUser: null,
    unsubscribeCloud: null,
    authMode: "signin"
  };

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const pageTitle = $("pageTitle");
  const backBtn = $("backBtn");
  const mainView = $("mainView");
  const fabBtn = $("fabBtn");
  const searchToggle = $("searchToggle");
  const searchWrap = $("searchWrap");
  const searchInput = $("searchInput");
  const installTopBtn = $("installTopBtn");

  // Auth UI
  const authBtn = $("authBtn");
  const authBtnIcon = $("authBtnIcon");
  const authBtnAvatar = $("authBtnAvatar");
  const accountOverlay = $("accountOverlay");
  const accountCloseBtn = $("accountCloseBtn");
  const accountLoggedOutView = $("accountLoggedOutView");
  const accountLoggedInView = $("accountLoggedInView");
  const googleSignInBtn = $("googleSignInBtn");
  const signOutBtn = $("signOutBtn");
  const syncLocalToCloudBtn = $("syncLocalToCloudBtn");
  const userAvatar = $("userAvatar");
  const userName = $("userName");
  const userEmail = $("userEmail");

  // Email auth
  const emailAuthForm = $("emailAuthForm");
  const authEmailInput = $("authEmailInput");
  const authPasswordInput = $("authPasswordInput");
  const emailAuthSubmitBtn = $("emailAuthSubmitBtn");
  const authToggleBtn = $("authToggleBtn");
  const authToggleText = $("authToggleText");

  // CRUD sheets
  const fileOverlay = $("fileOverlay");
  const fileSheetTitle = $("fileSheetTitle");
  const fileNameInput = $("fileNameInput");
  const fileSaveBtn = $("fileSaveBtn");
  const fileCancelBtn = $("fileCancelBtn");

  const linkOverlay = $("linkOverlay");
  const linkSheetTitle = $("linkSheetTitle");
  const linkNameInput = $("linkNameInput");
  const linkUrlInput = $("linkUrlInput");
  const linkSaveBtn = $("linkSaveBtn");
  const linkCancelBtn = $("linkCancelBtn");

  const confirmOverlay = $("confirmOverlay");
  const confirmTitle = $("confirmTitle");
  const confirmBody = $("confirmBody");
  const confirmOkBtn = $("confirmOkBtn");
  const confirmCancelBtn = $("confirmCancelBtn");
  const toastEl = $("toast");

  // ---------- Helpers ----------
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2500);
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function normalizeUrl(url) {
    const t = url.trim();
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(t) ? t : "https://" + t;
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function getFile(id) {
    return (state.data.files || []).find((f) => f.id === id);
  }

  // ---------- Rendering ----------
  function render() {
    state.view === "files" ? renderFileList() : renderLinkList();
  }

  function renderFileList() {
    pageTitle.textContent = "LinkVault";
    backBtn.style.display = "none";
    fabBtn.setAttribute("aria-label", "New file");

    let files = state.data.files || [];
    const q = state.searchQuery.trim().toLowerCase();
    if (q) files = files.filter((f) => f.name.toLowerCase().includes(q));
    files = [...files].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    if (!files.length) {
      mainView.innerHTML = `<div class="empty-state"><span class="glyph">&#128193;</span><p>${
        !(state.data.files || []).length
          ? "No files yet. Tap + to create a file \u2014 like \u201cReact Tutorials\u201d or \u201cInterview Prep\u201d \u2014 and save related links inside it."
          : "No files match your search."
      }</p></div>`;
      return;
    }

    mainView.innerHTML = `<div class="file-grid">${files.map(fileCardHtml).join("")}</div>`;
    files.forEach((f) => {
      const card = document.getElementById("file-" + f.id);
      if (!card) return;
      card.addEventListener("click", () => openFile(f.id));
      let pt; card.addEventListener("touchstart", () => { pt = setTimeout(() => openFileMenu(f.id), 500); });
      card.addEventListener("touchend", () => clearTimeout(pt));
      card.addEventListener("contextmenu", (e) => { e.preventDefault(); openFileMenu(f.id); });
    });
  }

  function fileCardHtml(f) {
    const c = (f.links || []).length;
    return `<div class="file-card" id="file-${f.id}">
      <div class="file-header"><span class="file-icon">&#128196;</span><span class="file-tag">${c} link${c === 1 ? "" : "s"}</span></div>
      <div class="file-name">${escapeHtml(f.name)}</div>
      <div class="file-meta">Updated ${formatDate(f.updatedAt || Date.now())}</div></div>`;
  }

  function openFileMenu(id) {
    const f = getFile(id);
    if (!f) return;
    if (confirm(`"${f.name}"\n\nOK = Rename   /   Cancel = Delete`)) openFileSheet(id);
    else askDeleteFile(id);
  }

  function renderLinkList() {
    const f = getFile(state.currentFileId);
    if (!f) { state.view = "files"; render(); return; }

    pageTitle.textContent = f.name;
    backBtn.style.display = "inline-block";
    fabBtn.setAttribute("aria-label", "New link");

    let links = f.links || [];
    const q = state.searchQuery.trim().toLowerCase();
    if (q) links = links.filter((l) => l.name.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
    links = [...links].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!links.length) {
      mainView.innerHTML = `<div class="empty-state"><span class="glyph">&#128279;</span><p>${
        !(f.links || []).length
          ? "This file is empty. Tap + to save your first link inside this file."
          : "No links match your search."
      }</p></div>`;
      return;
    }

    mainView.innerHTML = links.map(linkRowHtml).join("");
    links.forEach((l) => {
      const o = document.getElementById("open-" + l.id);
      if (o) o.addEventListener("click", () => window.open(l.url, "_blank", "noopener,noreferrer"));
      const e = document.getElementById("edit-" + l.id);
      if (e) e.addEventListener("click", (ev) => { ev.stopPropagation(); openLinkSheet(l.id); });
      const d = document.getElementById("del-" + l.id);
      if (d) d.addEventListener("click", (ev) => { ev.stopPropagation(); askDeleteLink(l.id); });
    });
  }

  function linkRowHtml(l) {
    return `<div class="link-row">
      <div class="link-main" id="open-${l.id}"><div class="link-name">${escapeHtml(l.name)}</div><div class="link-url">${escapeHtml(l.url)}</div></div>
      <div class="row-actions"><button id="edit-${l.id}" aria-label="Edit">&#9998;</button><button id="del-${l.id}" aria-label="Delete">&#128465;</button></div></div>`;
  }

  // ---------- Navigation ----------
  function openFile(id) {
    state.currentFileId = id; state.view = "links"; state.searchQuery = "";
    searchInput.value = ""; searchWrap.style.display = "none"; render();
  }

  backBtn.addEventListener("click", () => {
    state.view = "files"; state.currentFileId = null; state.searchQuery = "";
    searchInput.value = ""; searchWrap.style.display = "none"; render();
  });

  searchToggle.addEventListener("click", () => {
    const show = searchWrap.style.display === "none";
    searchWrap.style.display = show ? "block" : "none";
    if (show) searchInput.focus();
    else { searchInput.value = ""; state.searchQuery = ""; render(); }
  });
  searchInput.addEventListener("input", (e) => { state.searchQuery = e.target.value; render(); });

  fabBtn.addEventListener("click", () => {
    state.view === "files" ? openFileSheet(null) : openLinkSheet(null);
  });

  // ---------- File sheet ----------
  function openFileSheet(id) {
    state.editingFileId = id;
    if (id) { const f = getFile(id); fileSheetTitle.textContent = "Rename File"; fileNameInput.value = f.name; }
    else { fileSheetTitle.textContent = "New File"; fileNameInput.value = ""; }
    fileOverlay.classList.remove("hidden");
    setTimeout(() => fileNameInput.focus(), 50);
  }
  function closeFileSheet() { fileOverlay.classList.add("hidden"); state.editingFileId = null; }
  fileCancelBtn.addEventListener("click", closeFileSheet);
  fileOverlay.addEventListener("click", (e) => { if (e.target === fileOverlay) closeFileSheet(); });

  fileSaveBtn.addEventListener("click", () => {
    const name = fileNameInput.value.trim();
    if (!name) { toast("Give the file a name"); return; }
    const now = Date.now();
    if (state.editingFileId) {
      const f = getFile(state.editingFileId);
      if (f) { f.name = name; f.updatedAt = now; toast("File renamed"); }
    } else {
      if (!state.data.files) state.data.files = [];
      state.data.files.push({ id: uid(), name, links: [], createdAt: now, updatedAt: now });
      toast("File created");
    }
    saveData(); closeFileSheet(); render();
  });

  function askDeleteFile(id) {
    const f = getFile(id); if (!f) return;
    state.pendingDelete = { type: "file", id };
    confirmTitle.textContent = `Delete "${f.name}"?`;
    confirmBody.textContent = `This removes the file and all ${(f.links || []).length} link(s). This cannot be undone.`;
    confirmOverlay.classList.remove("hidden");
  }

  // ---------- Link sheet ----------
  function openLinkSheet(id) {
    state.editingLinkId = id;
    const f = getFile(state.currentFileId);
    if (id && f) {
      const l = (f.links || []).find((x) => x.id === id);
      linkSheetTitle.textContent = "Edit Link";
      linkNameInput.value = l ? l.name : ""; linkUrlInput.value = l ? l.url : "";
    } else { linkSheetTitle.textContent = "New Link"; linkNameInput.value = ""; linkUrlInput.value = ""; }
    linkOverlay.classList.remove("hidden");
    setTimeout(() => linkNameInput.focus(), 50);
  }
  function closeLinkSheet() { linkOverlay.classList.add("hidden"); state.editingLinkId = null; }
  linkCancelBtn.addEventListener("click", closeLinkSheet);
  linkOverlay.addEventListener("click", (e) => { if (e.target === linkOverlay) closeLinkSheet(); });

  linkSaveBtn.addEventListener("click", () => {
    const name = linkNameInput.value.trim(), rawUrl = linkUrlInput.value.trim();
    if (!name) { toast("Give this link a name"); return; }
    if (!rawUrl) { toast("Paste the link"); return; }
    const url = normalizeUrl(rawUrl);
    const f = getFile(state.currentFileId); if (!f) return;
    const now = Date.now();
    if (state.editingLinkId) {
      const l = (f.links || []).find((x) => x.id === state.editingLinkId);
      if (l) { l.name = name; l.url = url; toast("Link updated"); }
    } else {
      if (!f.links) f.links = [];
      f.links.push({ id: uid(), name, url, createdAt: now });
      toast("Link saved");
    }
    f.updatedAt = now; saveData(); closeLinkSheet(); render();
  });

  function askDeleteLink(id) {
    const f = getFile(state.currentFileId); if (!f) return;
    const l = (f.links || []).find((x) => x.id === id); if (!l) return;
    state.pendingDelete = { type: "link", id };
    confirmTitle.textContent = `Delete "${l.name}"?`;
    confirmBody.textContent = "This cannot be undone.";
    confirmOverlay.classList.remove("hidden");
  }

  // ---------- Confirm sheet ----------
  confirmCancelBtn.addEventListener("click", () => { state.pendingDelete = null; confirmOverlay.classList.add("hidden"); });
  confirmOverlay.addEventListener("click", (e) => { if (e.target === confirmOverlay) { state.pendingDelete = null; confirmOverlay.classList.add("hidden"); } });
  confirmOkBtn.addEventListener("click", () => {
    const pd = state.pendingDelete; if (!pd) return;
    if (pd.type === "file") {
      state.data.files = (state.data.files || []).filter((f) => f.id !== pd.id); toast("File deleted");
    } else {
      const f = getFile(state.currentFileId);
      if (f) { f.links = (f.links || []).filter((l) => l.id !== pd.id); f.updatedAt = Date.now(); toast("Link deleted"); }
    }
    saveData(); state.pendingDelete = null; confirmOverlay.classList.add("hidden"); render();
  });

  // ======================================================================
  //  AUTHENTICATION — Google + Email/Password
  //  Users just sign in. They NEVER configure Firebase themselves.
  // ======================================================================

  function updateAuthUI(user) {
    state.currentUser = user;
    if (user) {
      authBtnIcon.style.display = "none";
      if (user.photoURL) {
        authBtnAvatar.src = user.photoURL; authBtnAvatar.style.display = "inline-block";
        userAvatar.src = user.photoURL; userAvatar.style.display = "block";
      } else {
        authBtnIcon.textContent = "\u2705"; authBtnIcon.style.display = "inline-block";
        authBtnAvatar.style.display = "none"; userAvatar.style.display = "none";
      }
      userName.textContent = user.displayName || user.email.split("@")[0] || "User";
      userEmail.textContent = user.email || "";
      accountLoggedOutView.style.display = "none";
      accountLoggedInView.style.display = "block";
    } else {
      authBtnIcon.textContent = "\u{1F464}";
      authBtnIcon.style.display = "inline-block";
      authBtnAvatar.style.display = "none";
      accountLoggedOutView.style.display = "block";
      accountLoggedInView.style.display = "none";
    }
  }

  // Toggle between Sign In and Create Account mode
  function setAuthMode(mode) {
    state.authMode = mode;
    if (mode === "signup") {
      emailAuthSubmitBtn.textContent = "Create Account";
      authToggleText.textContent = "Already have an account?";
      authToggleBtn.textContent = "Sign In";
    } else {
      emailAuthSubmitBtn.textContent = "Sign In";
      authToggleText.textContent = "Don't have an account?";
      authToggleBtn.textContent = "Create Account";
    }
  }

  authToggleBtn.addEventListener("click", () => {
    setAuthMode(state.authMode === "signin" ? "signup" : "signin");
  });

  // Open / Close account modal
  authBtn.addEventListener("click", () => accountOverlay.classList.remove("hidden"));
  accountCloseBtn.addEventListener("click", () => accountOverlay.classList.add("hidden"));
  accountOverlay.addEventListener("click", (e) => { if (e.target === accountOverlay) accountOverlay.classList.add("hidden"); });

  // ----- Google Sign-In -----
  googleSignInBtn.addEventListener("click", async () => {
    if (!firebaseReady) {
      toast("Cloud sync is not configured yet.");
      return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await firebase.auth().signInWithPopup(provider);
      if (result && result.user) {
        toast("Welcome, " + (result.user.displayName || "User") + "!");
        accountOverlay.classList.add("hidden");
      }
    } catch (err) {
      console.error("Google sign-in error:", err);
      if (err.code === "auth/popup-blocked") {
        firebase.auth().signInWithRedirect(provider);
      } else if (err.code === "auth/unauthorized-domain") {
        alert("Domain not authorized!\n\nAdd \"" + location.hostname + "\" to Firebase Console:\nAuthentication \u2192 Settings \u2192 Authorized Domains.");
      } else if (err.code !== "auth/popup-closed-by-user") {
        toast("Google sign-in failed: " + err.message);
      }
    }
  });

  // ----- Email/Password Sign In or Sign Up -----
  emailAuthForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!firebaseReady) { toast("Cloud sync is not configured yet."); return; }
    const email = authEmailInput.value.trim();
    const pass = authPasswordInput.value;
    if (!email || !pass) { toast("Enter your email and password"); return; }
    if (pass.length < 6) { toast("Password must be at least 6 characters"); return; }

    emailAuthSubmitBtn.disabled = true;
    emailAuthSubmitBtn.textContent = "Please wait...";

    try {
      let result;
      if (state.authMode === "signup") {
        result = await firebase.auth().createUserWithEmailAndPassword(email, pass);
        toast("Account created! Welcome!");
      } else {
        result = await firebase.auth().signInWithEmailAndPassword(email, pass);
        toast("Welcome back!");
      }
      if (result && result.user) {
        accountOverlay.classList.add("hidden");
        authEmailInput.value = "";
        authPasswordInput.value = "";
      }
    } catch (err) {
      console.error("Email auth error:", err);
      let msg = err.message || "Authentication failed";
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        msg = "No account found with this email. Tap 'Create Account' to sign up.";
      } else if (err.code === "auth/wrong-password") {
        msg = "Incorrect password. Please try again.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "This email already has an account. Tap 'Sign In' instead.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password is too weak. Use at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Too many attempts. Please wait a minute and try again.";
      }
      toast(msg);
    } finally {
      emailAuthSubmitBtn.disabled = false;
      setAuthMode(state.authMode);
    }
  });

  // ----- Sign Out -----
  signOutBtn.addEventListener("click", async () => {
    try {
      if (state.unsubscribeCloud) { state.unsubscribeCloud(); state.unsubscribeCloud = null; }
      if (firebaseReady) await firebase.auth().signOut();
      updateAuthUI(null);
      state.data = loadLocalData();
      render();
      accountOverlay.classList.add("hidden");
      toast("Signed out");
    } catch (err) { console.error("Sign out error:", err); }
  });

  // ----- Upload local files to cloud -----
  syncLocalToCloudBtn.addEventListener("click", async () => {
    if (!state.currentUser || !firebaseReady) return;
    try {
      await firebase.firestore().collection("users").doc(state.currentUser.uid)
        .set({ ...state.data, lastSyncedAt: Date.now() }, { merge: true });
      toast("Local files uploaded to cloud!");
    } catch (err) { alert("Sync failed: " + err.message); }
  });

  // ---------- Auth State Listener & Cloud Sync ----------
  function setupAuthListener() {
    if (!firebaseReady) return;
    firebase.auth().onAuthStateChanged((user) => {
      updateAuthUI(user);
      if (user) {
        if (state.unsubscribeCloud) state.unsubscribeCloud();
        const docRef = firebase.firestore().collection("users").doc(user.uid);
        state.unsubscribeCloud = docRef.onSnapshot(
          (snap) => {
            if (snap.exists) {
              const d = snap.data();
              if (d && Array.isArray(d.files)) {
                state.data = d;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
                render();
              }
            } else {
              if (state.data.files && state.data.files.length > 0) {
                docRef.set({ ...state.data, lastSyncedAt: Date.now() }, { merge: true }).catch(() => {});
              }
            }
          },
          (err) => console.warn("Cloud sync error:", err)
        );
      }
    });
  }

  // ---------- Init Firebase ----------
  if (initFirebaseApp()) {
    setupAuthListener();
  }

  // ---------- PWA Installation ----------
  let deferredInstallPrompt = null;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!isStandalone && installTopBtn) {
      installTopBtn.style.display = "inline-block";
      showInstallBanner();
    }
  });

  async function triggerInstallPrompt() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") hideInstallUI();
    deferredInstallPrompt = null;
  }

  if (installTopBtn) installTopBtn.addEventListener("click", triggerInstallPrompt);

  function showInstallBanner() {
    if (document.getElementById("installBanner") || isStandalone) return;
    const b = document.createElement("div");
    b.className = "install-banner"; b.id = "installBanner";
    b.innerHTML = `<div class="install-info"><span class="install-title">&#128229; Install LinkVault App</span>
      <span class="install-desc">Install as a standalone application for fast, offline access.</span></div>
      <div class="install-actions"><button id="installNowBtn">Install</button>
      <button class="dismiss" id="installDismissBtn" aria-label="Dismiss">&times;</button></div>`;
    mainView.parentElement.insertBefore(b, mainView);
    document.getElementById("installNowBtn").addEventListener("click", triggerInstallPrompt);
    document.getElementById("installDismissBtn").addEventListener("click", () => b.remove());
  }

  function hideInstallUI() {
    const b = document.getElementById("installBanner"); if (b) b.remove();
    if (installTopBtn) installTopBtn.style.display = "none";
  }

  window.addEventListener("appinstalled", () => { hideInstallUI(); deferredInstallPrompt = null; toast("LinkVault installed!"); });

  // ---------- Service Worker ----------
  if ("serviceWorker" in navigator) {
    const reg = () => navigator.serviceWorker.register("service-worker.js")
      .then((r) => console.log("SW registered:", r.scope))
      .catch((e) => console.warn("SW registration:", e));
    document.readyState === "complete" ? reg() : window.addEventListener("load", reg);
  }

  // ---------- Boot ----------
  render();
})();
