(() => {
  "use strict";

  // ============================================================
  //  LinkVault Firebase Configuration
  // ============================================================
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAeDKgEgHy3npWMDh664ytsEFJsKRzIeCU",
    authDomain: "linkvault-349cf.firebaseapp.com",
    projectId: "linkvault-349cf",
    storageBucket: "linkvault-349cf.firebasestorage.app",
    messagingSenderId: "874508341706",
    appId: "1:874508341706:web:33d2a59287f4ec7f94bf33"
  };

  const STORAGE_KEY = "linkvault.data.v1";

  let isFirebaseReady = false;
  function initFirebaseApp() {
    if (typeof firebase === "undefined") {
      console.warn("Firebase SDK not loaded yet.");
      return false;
    }
    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
        try {
          firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(() => {});
        } catch (e) {}
      }
      isFirebaseReady = true;
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
        // Handle migration from legacy 'notebooks' format to 'files'
        if (parsed.notebooks && !parsed.files) {
          return {
            files: parsed.notebooks.map((nb) => ({
              id: nb.id,
              name: nb.name,
              links: nb.links || [],
              createdAt: nb.createdAt || Date.now(),
              updatedAt: nb.updatedAt || Date.now(),
            })),
          };
        }
        if (parsed.files) {
          return parsed;
        }
      }
    } catch (e) { /* fall through to default */ }
    return { files: [] };
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    if (state.currentUser && typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
      try {
        const userDoc = firebase.firestore().collection("users").doc(state.currentUser.uid);
        userDoc.set({ ...state.data, lastSyncedAt: Date.now() }, { merge: true }).catch((err) => {
          console.warn("Firestore save error:", err);
        });
      } catch (e) {
        console.warn("Firestore write error:", e);
      }
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- State ----------
  const state = {
    data: loadLocalData(),
    view: "files",      // "files" | "links"
    currentFileId: null,
    searchQuery: "",
    editingFileId: null,   // set when file sheet is in edit mode
    editingLinkId: null,   // set when link sheet is in edit mode
    pendingDelete: null,   // { type: 'file'|'link', id }
    currentUser: null,     // Firebase User object
    unsubscribeCloud: null,
    authMode: "signin",    // "signin" | "signup"
    activeMenuItem: null   // { type: 'file'|'link', id }
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

  const emailAuthForm = $("emailAuthForm");
  const authEmailInput = $("authEmailInput");
  const authPasswordInput = $("authPasswordInput");
  const emailAuthSubmitBtn = $("emailAuthSubmitBtn");
  const authToggleBtn = $("authToggleBtn");
  const authToggleText = $("authToggleText");

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

  const itemMenuOverlay = $("itemMenuOverlay");
  const itemMenuTitle = $("itemMenuTitle");
  const itemMenuSubtitle = $("itemMenuSubtitle");
  const itemMenuRenameBtn = $("itemMenuRenameBtn");
  const itemMenuDeleteBtn = $("itemMenuDeleteBtn");
  const itemMenuCancelBtn = $("itemMenuCancelBtn");

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
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeUrl(url) {
    const trimmed = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      return "https://" + trimmed;
    }
    return trimmed;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function getFile(id) {
    return (state.data.files || []).find((f) => f.id === id);
  }

  // ---------- Rendering ----------
  function render() {
    if (state.view === "files") {
      renderFileList();
    } else {
      renderLinkList();
    }
  }

  function renderFileList() {
    pageTitle.textContent = "LinkVault";
    backBtn.style.display = "none";
    fabBtn.setAttribute("aria-label", "New file");
    fabBtn.title = "Create new file";

    let files = state.data.files || [];
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      files = files.filter((f) => f.name.toLowerCase().includes(q));
    }
    files = [...files].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    if (files.length === 0) {
      mainView.innerHTML = `
        <div class="empty-state">
          <span class="glyph">&#128193;</span>
          <p>${(state.data.files || []).length === 0
              ? "No Files Yet"
              : "No files match your search."}</p>
        </div>`;
      return;
    }

    mainView.innerHTML = `<div class="file-grid">${files.map(fileCardHtml).join("")}</div>`;

    files.forEach((f) => {
      const card = document.getElementById("file-" + f.id);
      if (!card) return;

      let clickTimer = null;
      let pressTimer = null;
      let longPressed = false;

      // Click to open file (debounced slightly to allow double click)
      card.addEventListener("click", () => {
        if (longPressed) {
          longPressed = false;
          return;
        }
        clickTimer = setTimeout(() => {
          openFile(f.id);
        }, 220);
      });

      // Double-click -> Open options menu
      card.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (clickTimer) clearTimeout(clickTimer);
        openItemMenu("file", f.id);
      });

      // Right-click -> Open options menu
      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (clickTimer) clearTimeout(clickTimer);
        openItemMenu("file", f.id);
      });

      // Long press (touch devices) -> Open options menu
      card.addEventListener("touchstart", () => {
        longPressed = false;
        pressTimer = setTimeout(() => {
          longPressed = true;
          if (clickTimer) clearTimeout(clickTimer);
          openItemMenu("file", f.id);
        }, 500);
      }, { passive: true });

      card.addEventListener("touchend", () => {
        if (pressTimer) clearTimeout(pressTimer);
      });
      card.addEventListener("touchmove", () => {
        if (pressTimer) clearTimeout(pressTimer);
      });
      card.addEventListener("touchcancel", () => {
        if (pressTimer) clearTimeout(pressTimer);
      });
    });
  }

  function fileCardHtml(f) {
    const count = (f.links || []).length;
    return `
      <div class="file-card" id="file-${f.id}">
        <div class="file-header">
          <span class="file-icon">&#128196;</span>
          <span class="file-tag">${count} link${count === 1 ? "" : "s"}</span>
        </div>
        <div class="file-name">${escapeHtml(f.name)}</div>
        <div class="file-meta">Updated ${formatDate(f.updatedAt || Date.now())}</div>
      </div>`;
  }

  // Options Menu for Notebooks/Files and Links
  function openItemMenu(type, id) {
    state.activeMenuItem = { type, id };
    if (type === "file") {
      const f = getFile(id);
      if (!f) return;
      if (itemMenuTitle) itemMenuTitle.textContent = "Notebook / File";
      if (itemMenuSubtitle) itemMenuSubtitle.textContent = `"${f.name}" (${(f.links || []).length} link${(f.links || []).length === 1 ? "" : "s"})`;
    } else {
      const f = getFile(state.currentFileId);
      const l = f ? (f.links || []).find((x) => x.id === id) : null;
      if (!l) return;
      if (itemMenuTitle) itemMenuTitle.textContent = "Link Options";
      if (itemMenuSubtitle) itemMenuSubtitle.textContent = `"${l.name}"`;
    }
    if (itemMenuOverlay) itemMenuOverlay.classList.remove("hidden");
  }

  function closeItemMenu() {
    if (itemMenuOverlay) itemMenuOverlay.classList.add("hidden");
    state.activeMenuItem = null;
  }

  if (itemMenuCancelBtn) itemMenuCancelBtn.addEventListener("click", closeItemMenu);
  if (itemMenuOverlay) {
    itemMenuOverlay.addEventListener("click", (e) => {
      if (e.target === itemMenuOverlay) closeItemMenu();
    });
  }

  if (itemMenuRenameBtn) {
    itemMenuRenameBtn.addEventListener("click", () => {
      const item = state.activeMenuItem;
      closeItemMenu();
      if (!item) return;
      if (item.type === "file") {
        openFileSheet(item.id);
      } else {
        openLinkSheet(item.id);
      }
    });
  }

  if (itemMenuDeleteBtn) {
    itemMenuDeleteBtn.addEventListener("click", () => {
      const item = state.activeMenuItem;
      closeItemMenu();
      if (!item) return;
      if (item.type === "file") {
        askDeleteFile(item.id);
      } else {
        askDeleteLink(item.id);
      }
    });
  }

  function renderLinkList() {
    const f = getFile(state.currentFileId);
    if (!f) { state.view = "files"; render(); return; }

    pageTitle.textContent = f.name;
    backBtn.style.display = "inline-block";
    fabBtn.setAttribute("aria-label", "New link");
    fabBtn.title = "Save new link";

    let links = f.links || [];
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      links = links.filter((l) => l.name.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
    }
    links = [...links].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (links.length === 0) {
      mainView.innerHTML = `
        <div class="empty-state">
          <span class="glyph">&#128279;</span>
          <p>${(f.links || []).length === 0
              ? "No Links Yet"
              : "No links match your search."}</p>
        </div>`;
      return;
    }

    mainView.innerHTML = links.map(linkRowHtml).join("");

    links.forEach((l) => {
      const row = document.getElementById("link-row-" + l.id);
      const openEl = document.getElementById("open-" + l.id);
      const editEl = document.getElementById("edit-" + l.id);
      const delEl = document.getElementById("del-" + l.id);

      if (editEl) {
        editEl.addEventListener("click", (e) => {
          e.stopPropagation();
          openLinkSheet(l.id);
        });
      }
      if (delEl) {
        delEl.addEventListener("click", (e) => {
          e.stopPropagation();
          askDeleteLink(l.id);
        });
      }

      if (!openEl) return;

      let clickTimer = null;
      let pressTimer = null;
      let longPressed = false;

      // Click to open URL (debounced slightly to allow double click)
      openEl.addEventListener("click", () => {
        if (longPressed) {
          longPressed = false;
          return;
        }
        clickTimer = setTimeout(() => {
          window.open(l.url, "_blank", "noopener,noreferrer");
        }, 220);
      });

      // Double-click -> Open options menu
      openEl.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (clickTimer) clearTimeout(clickTimer);
        openItemMenu("link", l.id);
      });

      // Right-click -> Open options menu
      openEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (clickTimer) clearTimeout(clickTimer);
        openItemMenu("link", l.id);
      });

      // Long press -> Open options menu
      openEl.addEventListener("touchstart", () => {
        longPressed = false;
        pressTimer = setTimeout(() => {
          longPressed = true;
          if (clickTimer) clearTimeout(clickTimer);
          openItemMenu("link", l.id);
        }, 500);
      }, { passive: true });

      openEl.addEventListener("touchend", () => {
        if (pressTimer) clearTimeout(pressTimer);
      });
      openEl.addEventListener("touchmove", () => {
        if (pressTimer) clearTimeout(pressTimer);
      });
      openEl.addEventListener("touchcancel", () => {
        if (pressTimer) clearTimeout(pressTimer);
      });
    });
  }

  function linkRowHtml(l) {
    return `
      <div class="link-row" id="link-row-${l.id}">
        <div class="link-main" id="open-${l.id}">
          <div class="link-name">${escapeHtml(l.name)}</div>
          <div class="link-url">${escapeHtml(l.url)}</div>
        </div>
        <div class="row-actions">
          <button id="edit-${l.id}" aria-label="Edit" title="Edit link">&#9998;</button>
          <button id="del-${l.id}" aria-label="Delete" title="Delete link">&#128465;</button>
        </div>
      </div>`;
  }

  // ---------- Navigation ----------
  function openFile(id) {
    state.currentFileId = id;
    state.view = "links";
    state.searchQuery = "";
    searchInput.value = "";
    searchWrap.style.display = "none";
    render();
  }

  backBtn.addEventListener("click", () => {
    state.view = "files";
    state.currentFileId = null;
    state.searchQuery = "";
    searchInput.value = "";
    searchWrap.style.display = "none";
    render();
  });

  searchToggle.addEventListener("click", () => {
    const showing = searchWrap.style.display !== "none";
    searchWrap.style.display = showing ? "none" : "block";
    if (!showing) searchInput.focus();
    else { searchInput.value = ""; state.searchQuery = ""; render(); }
  });

  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    render();
  });

  // ---------- FAB ----------
  fabBtn.addEventListener("click", () => {
    if (state.view === "files") openFileSheet(null);
    else openLinkSheet(null);
  });

  // ---------- File sheet ----------
  function openFileSheet(id) {
    state.editingFileId = id;
    if (id) {
      const f = getFile(id);
      fileSheetTitle.textContent = "Rename File";
      fileNameInput.value = f.name;
    } else {
      fileSheetTitle.textContent = "New File";
      fileNameInput.value = "";
    }
    fileOverlay.classList.remove("hidden");
    setTimeout(() => fileNameInput.focus(), 50);
  }

  function closeFileSheet() {
    fileOverlay.classList.add("hidden");
    state.editingFileId = null;
  }

  fileCancelBtn.addEventListener("click", closeFileSheet);
  fileOverlay.addEventListener("click", (e) => { if (e.target === fileOverlay) closeFileSheet(); });

  fileSaveBtn.addEventListener("click", () => {
    const name = fileNameInput.value.trim();
    if (!name) { toast("Give the file a name"); return; }
    const now = Date.now();
    if (state.editingFileId) {
      const f = getFile(state.editingFileId);
      if (f) {
        f.name = name;
        f.updatedAt = now;
        toast("File renamed");
      }
    } else {
      if (!state.data.files) state.data.files = [];
      state.data.files.push({
        id: uid(),
        name,
        links: [],
        createdAt: now,
        updatedAt: now,
      });
      toast("File created");
    }
    saveData();
    closeFileSheet();
    render();
  });

  fileNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fileSaveBtn.click();
    }
  });

  function askDeleteFile(id) {
    const f = getFile(id);
    if (!f) return;
    state.pendingDelete = { type: "file", id };
    confirmTitle.textContent = `Delete "${f.name}"?`;
    confirmBody.textContent = `This removes the file and all ${(f.links || []).length} link(s) stored in it. This cannot be undone.`;
    confirmOverlay.classList.remove("hidden");
  }

  // ---------- Link sheet ----------
  function openLinkSheet(id) {
    state.editingLinkId = id;
    const f = getFile(state.currentFileId);
    if (id && f) {
      const l = (f.links || []).find((x) => x.id === id);
      linkSheetTitle.textContent = "Edit Link";
      linkNameInput.value = l ? l.name : "";
      linkUrlInput.value = l ? l.url : "";
    } else {
      linkSheetTitle.textContent = "New Link";
      linkNameInput.value = "";
      linkUrlInput.value = "";
    }
    linkOverlay.classList.remove("hidden");
    setTimeout(() => linkNameInput.focus(), 50);
  }

  function closeLinkSheet() {
    linkOverlay.classList.add("hidden");
    state.editingLinkId = null;
  }

  linkCancelBtn.addEventListener("click", closeLinkSheet);
  linkOverlay.addEventListener("click", (e) => { if (e.target === linkOverlay) closeLinkSheet(); });

  linkSaveBtn.addEventListener("click", () => {
    const name = linkNameInput.value.trim();
    const rawUrl = linkUrlInput.value.trim();
    if (!name) { toast("Give this link a name"); return; }
    if (!rawUrl) { toast("Paste the link"); return; }
    const url = normalizeUrl(rawUrl);
    const f = getFile(state.currentFileId);
    if (!f) return;
    const now = Date.now();
    if (state.editingLinkId) {
      const l = (f.links || []).find((x) => x.id === state.editingLinkId);
      if (l) {
        l.name = name;
        l.url = url;
        toast("Link updated");
      }
    } else {
      if (!f.links) f.links = [];
      f.links.push({ id: uid(), name, url, createdAt: now });
      toast("Link saved");
    }
    f.updatedAt = now;
    saveData();
    closeLinkSheet();
    render();
  });

  linkNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (linkUrlInput.value.trim()) {
        linkSaveBtn.click();
      } else {
        linkUrlInput.focus();
      }
    }
  });

  linkUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      linkSaveBtn.click();
    }
  });

  function askDeleteLink(id) {
    const f = getFile(state.currentFileId);
    if (!f) return;
    const l = (f.links || []).find((x) => x.id === id);
    if (!l) return;
    state.pendingDelete = { type: "link", id };
    confirmTitle.textContent = `Delete "${l.name}"?`;
    confirmBody.textContent = "This cannot be undone.";
    confirmOverlay.classList.remove("hidden");
  }

  // ---------- Confirm sheet ----------
  confirmCancelBtn.addEventListener("click", () => {
    state.pendingDelete = null;
    confirmOverlay.classList.add("hidden");
  });
  confirmOverlay.addEventListener("click", (e) => {
    if (e.target === confirmOverlay) { state.pendingDelete = null; confirmOverlay.classList.add("hidden"); }
  });

  confirmOkBtn.addEventListener("click", () => {
    const pd = state.pendingDelete;
    if (!pd) return;
    if (pd.type === "file") {
      state.data.files = (state.data.files || []).filter((f) => f.id !== pd.id);
      toast("File deleted");
    } else if (pd.type === "link") {
      const f = getFile(state.currentFileId);
      if (f) {
        f.links = (f.links || []).filter((l) => l.id !== pd.id);
        f.updatedAt = Date.now();
        toast("Link deleted");
      }
    }
    saveData();
    state.pendingDelete = null;
    confirmOverlay.classList.add("hidden");
    render();
  });

  // ---------- Google Account & Cloud Sync ----------
  function updateAuthUI(user) {
    state.currentUser = user;
    if (user) {
      if (user.photoURL) {
        if (authBtnIcon) authBtnIcon.style.display = "none";
        if (authBtnAvatar) {
          authBtnAvatar.src = user.photoURL;
          authBtnAvatar.style.display = "inline-block";
        }
        if (userAvatar) {
          userAvatar.src = user.photoURL;
          userAvatar.style.display = "block";
        }
      } else {
        if (authBtnIcon) {
          authBtnIcon.textContent = "✅";
          authBtnIcon.style.display = "inline-block";
        }
        if (authBtnAvatar) authBtnAvatar.style.display = "none";
        if (userAvatar) userAvatar.style.display = "none";
      }
      const fallbackName = user.email ? user.email.split("@")[0] : "User";
      if (userName) userName.textContent = user.displayName || fallbackName;
      if (userEmail) userEmail.textContent = user.email || "";
      if (accountLoggedOutView) accountLoggedOutView.style.display = "none";
      if (accountLoggedInView) accountLoggedInView.style.display = "block";
    } else {
      if (authBtnIcon) {
        authBtnIcon.textContent = "\u{1F464}";
        authBtnIcon.style.display = "inline-block";
      }
      if (authBtnAvatar) authBtnAvatar.style.display = "none";
      if (accountLoggedOutView) accountLoggedOutView.style.display = "block";
      if (accountLoggedInView) accountLoggedInView.style.display = "none";
    }
  }

  // Toggle between Sign In and Create Account
  function setAuthMode(mode) {
    state.authMode = mode;
    if (mode === "signup") {
      if (emailAuthSubmitBtn) emailAuthSubmitBtn.textContent = "Create Account";
      if (authToggleText) authToggleText.textContent = "Already have an account?";
      if (authToggleBtn) authToggleBtn.textContent = "Sign In";
    } else {
      if (emailAuthSubmitBtn) emailAuthSubmitBtn.textContent = "Sign In";
      if (authToggleText) authToggleText.textContent = "Don't have an account?";
      if (authToggleBtn) authToggleBtn.textContent = "Create Account";
    }
  }

  if (authToggleBtn) {
    authToggleBtn.addEventListener("click", () => {
      setAuthMode(state.authMode === "signin" ? "signup" : "signin");
    });
  }

  if (authBtn) {
    authBtn.addEventListener("click", () => {
      accountOverlay.classList.remove("hidden");
    });
  }

  if (accountCloseBtn) {
    accountCloseBtn.addEventListener("click", () => {
      accountOverlay.classList.add("hidden");
    });
  }

  if (accountOverlay) {
    accountOverlay.addEventListener("click", (e) => {
      if (e.target === accountOverlay) accountOverlay.classList.add("hidden");
    });
  }

  // Google Sign-In
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener("click", async () => {
      if (!initFirebaseApp()) {
        toast("Connecting to service...");
        return;
      }

      toast("Opening Google Sign-In...");
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      try {
        const result = await firebase.auth().signInWithPopup(provider);
        if (result && result.user) {
          toast(`Welcome, ${result.user.displayName || "User"}!`);
          accountOverlay.classList.add("hidden");
        }
      } catch (err) {
        console.error("Sign-in error:", err);
        if (err.code === "auth/unauthorized-domain") {
          alert(`Unauthorized Domain Error:\n\nPlease add "${window.location.hostname}" to Authorized Domains in Firebase Console:\nAuthentication -> Settings -> Authorized Domains.`);
        } else if (err.code === "auth/popup-blocked") {
          firebase.auth().signInWithRedirect(provider);
        } else if (err.code !== "auth/popup-closed-by-user") {
          alert("Sign In Error: " + err.message);
        }
      }
    });
  }

  // Email / Password Authentication
  if (emailAuthForm) {
    emailAuthForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!initFirebaseApp()) {
        toast("Connecting to service...");
        return;
      }

      const email = authEmailInput ? authEmailInput.value.trim() : "";
      const pass = authPasswordInput ? authPasswordInput.value : "";
      if (!email || !pass) {
        toast("Enter your email and password");
        return;
      }
      if (pass.length < 6) {
        toast("Password must be at least 6 characters");
        return;
      }

      if (emailAuthSubmitBtn) {
        emailAuthSubmitBtn.disabled = true;
        emailAuthSubmitBtn.textContent = "Please wait...";
      }

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
          if (authEmailInput) authEmailInput.value = "";
          if (authPasswordInput) authPasswordInput.value = "";
        }
      } catch (err) {
        console.error("Email auth error:", err);
        let msg = err.message || "Authentication failed";
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
          msg = "No account found with this email. Tap 'Create Account' to sign up.";
        } else if (err.code === "auth/wrong-password") {
          msg = "Incorrect password. Please try again.";
        } else if (err.code === "auth/email-already-in-use") {
          msg = "This email is already registered. Tap 'Sign In' instead.";
        } else if (err.code === "auth/weak-password") {
          msg = "Password should be at least 6 characters.";
        } else if (err.code === "auth/invalid-email") {
          msg = "Please enter a valid email address.";
        } else if (err.code === "auth/too-many-requests") {
          msg = "Too many attempts. Please wait a minute and try again.";
        }
        alert(msg);
      } finally {
        if (emailAuthSubmitBtn) emailAuthSubmitBtn.disabled = false;
        setAuthMode(state.authMode);
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try {
        if (state.unsubscribeCloud) {
          state.unsubscribeCloud();
          state.unsubscribeCloud = null;
        }
        if (typeof firebase !== "undefined" && firebase.auth) {
          await firebase.auth().signOut();
        }
        updateAuthUI(null);
        state.data = loadLocalData();
        render();
        accountOverlay.classList.add("hidden");
        toast("Signed out successfully");
      } catch (err) {
        console.error("Sign out error:", err);
      }
    });
  }

  if (syncLocalToCloudBtn) {
    syncLocalToCloudBtn.addEventListener("click", async () => {
      if (!state.currentUser || typeof firebase === "undefined") return;
      try {
        const userDoc = firebase.firestore().collection("users").doc(state.currentUser.uid);
        await userDoc.set({ ...state.data, lastSyncedAt: Date.now() }, { merge: true });
        toast("Local files synced to Google Cloud!");
      } catch (err) {
        alert("Sync failed: " + err.message);
      }
    });
  }

  // ---------- Setup Auth State Listener ----------
  function setupAuthStateListener() {
    if (typeof firebase === "undefined") return;
    if (!firebase.apps || !firebase.apps.length) {
      if (!initFirebaseApp()) return;
    }

    try {
      firebase.auth().onAuthStateChanged((user) => {
        updateAuthUI(user);
        if (user) {
          if (state.unsubscribeCloud) state.unsubscribeCloud();
          const userDoc = firebase.firestore().collection("users").doc(user.uid);
          state.unsubscribeCloud = userDoc.onSnapshot(
            (docSnap) => {
              if (docSnap.exists) {
                const data = docSnap.data();
                if (data && Array.isArray(data.files)) {
                  state.data = data;
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                  render();
                }
              } else {
                if (state.data.files && state.data.files.length > 0) {
                  userDoc.set({ ...state.data, lastSyncedAt: Date.now() }, { merge: true }).catch(() => {});
                }
              }
            },
            (err) => {
              console.warn("Firestore sync notification:", err);
            }
          );
        }
      });
    } catch (e) {
      console.warn("Auth listener setup notice:", e);
    }
  }

  // Initialize Firebase if config exists
  if (initFirebaseApp()) {
    setupAuthStateListener();
  }

  // ---------- Standalone PWA Installation ----------
  let deferredInstallPrompt = null;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    if (!isStandalone) {
      if (installTopBtn) installTopBtn.style.display = "inline-block";
      showInstallBanner();
    }
  });

  async function triggerInstallPrompt() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") {
      hideInstallUI();
    }
    deferredInstallPrompt = null;
  }

  if (installTopBtn) {
    installTopBtn.addEventListener("click", () => {
      triggerInstallPrompt();
    });
  }

  function showInstallBanner() {
    if (document.getElementById("installBanner") || isStandalone) return;
    const banner = document.createElement("div");
    banner.className = "install-banner";
    banner.id = "installBanner";
    banner.innerHTML = `
      <div class="install-info">
        <span class="install-title">&#128229; Install LinkVault App</span>
        <span class="install-desc">Install as a standalone application for fast, offline access.</span>
      </div>
      <div class="install-actions">
        <button id="installNowBtn">Install</button>
        <button class="dismiss" id="installDismissBtn" aria-label="Dismiss">&times;</button>
      </div>`;
    mainView.parentElement.insertBefore(banner, mainView);

    document.getElementById("installNowBtn").addEventListener("click", async () => {
      await triggerInstallPrompt();
    });
    document.getElementById("installDismissBtn").addEventListener("click", () => banner.remove());
  }

  function hideInstallUI() {
    const banner = document.getElementById("installBanner");
    if (banner) banner.remove();
    if (installTopBtn) installTopBtn.style.display = "none";
  }

  window.addEventListener("appinstalled", () => {
    hideInstallUI();
    deferredInstallPrompt = null;
    toast("LinkVault installed successfully!");
  });

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    const registerSW = () => {
      navigator.serviceWorker
        .register("service-worker.js")
        .then((reg) => {
          console.log("Service Worker registered successfully:", reg.scope);
        })
        .catch((err) => {
          console.warn("Service Worker registration notice:", err);
        });
    };

    if (document.readyState === "complete") {
      registerSW();
    } else {
      window.addEventListener("load", registerSW);
    }
  }

  // ---------- Init ----------
  render();
})();
