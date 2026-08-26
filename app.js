(() => {
  "use strict";

  const STORAGE_KEY = "linkvault.data.v1";

  // ---------- Storage ----------
  function loadData() {
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
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- State ----------
  const state = {
    data: loadData(),
    view: "files",      // "files" | "links"
    currentFileId: null,
    searchQuery: "",
    editingFileId: null,   // set when file sheet is in edit mode
    editingLinkId: null,   // set when link sheet is in edit mode
    pendingDelete: null,   // { type: 'file'|'link', id }
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
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 1800);
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
    return state.data.files.find((f) => f.id === id);
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

    let files = state.data.files;
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      files = files.filter((f) => f.name.toLowerCase().includes(q));
    }
    files = [...files].sort((a, b) => b.updatedAt - a.updatedAt);

    if (files.length === 0) {
      mainView.innerHTML = `
        <div class="empty-state">
          <span class="glyph">&#128193;</span>
          <p>${state.data.files.length === 0
              ? "No files yet. Tap + to create a file — like \u201cReact Tutorials\u201d or \u201cInterview Prep\u201d — and save related links inside it."
              : "No files match your search."}</p>
        </div>`;
      return;
    }

    mainView.innerHTML = `<div class="file-grid">${files.map(fileCardHtml).join("")}</div>`;

    files.forEach((f) => {
      const card = document.getElementById("file-" + f.id);
      card.addEventListener("click", () => openFile(f.id));
      let pressTimer;
      card.addEventListener("touchstart", () => { pressTimer = setTimeout(() => openFileMenu(f.id), 500); });
      card.addEventListener("touchend", () => clearTimeout(pressTimer));
      card.addEventListener("contextmenu", (e) => { e.preventDefault(); openFileMenu(f.id); });
    });
  }

  function fileCardHtml(f) {
    const count = f.links.length;
    return `
      <div class="file-card" id="file-${f.id}">
        <div class="file-header">
          <span class="file-icon">&#128196;</span>
          <span class="file-tag">${count} link${count === 1 ? "" : "s"}</span>
        </div>
        <div class="file-name">${escapeHtml(f.name)}</div>
        <div class="file-meta">Updated ${formatDate(f.updatedAt)}</div>
      </div>`;
  }

  function openFileMenu(id) {
    const f = getFile(id);
    if (!f) return;
    const choice = confirm(`"${f.name}"\n\nOK = Rename   /   Cancel = Delete`);
    if (choice) {
      openFileSheet(id);
    } else {
      askDeleteFile(id);
    }
  }

  function renderLinkList() {
    const f = getFile(state.currentFileId);
    if (!f) { state.view = "files"; render(); return; }

    pageTitle.textContent = f.name;
    backBtn.style.display = "inline-block";
    fabBtn.setAttribute("aria-label", "New link");
    fabBtn.title = "Save new link";

    let links = f.links;
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      links = links.filter((l) => l.name.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
    }
    links = [...links].sort((a, b) => b.createdAt - a.createdAt);

    if (links.length === 0) {
      mainView.innerHTML = `
        <div class="empty-state">
          <span class="glyph">&#128279;</span>
          <p>${f.links.length === 0
              ? "This file is empty. Tap + to save your first link inside this file."
              : "No links match your search."}</p>
        </div>`;
      return;
    }

    mainView.innerHTML = links.map(linkRowHtml).join("");

    links.forEach((l) => {
      document.getElementById("open-" + l.id).addEventListener("click", () => {
        window.open(l.url, "_blank", "noopener,noreferrer");
      });
      document.getElementById("edit-" + l.id).addEventListener("click", (e) => {
        e.stopPropagation();
        openLinkSheet(l.id);
      });
      document.getElementById("del-" + l.id).addEventListener("click", (e) => {
        e.stopPropagation();
        askDeleteLink(l.id);
      });
    });
  }

  function linkRowHtml(l) {
    return `
      <div class="link-row">
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

  // ---------- File sheet (No color selector) ----------
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
      f.name = name;
      f.updatedAt = now;
      toast("File renamed");
    } else {
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

  function askDeleteFile(id) {
    const f = getFile(id);
    state.pendingDelete = { type: "file", id };
    confirmTitle.textContent = `Delete "${f.name}"?`;
    confirmBody.textContent = `This removes the file and all ${f.links.length} link(s) stored in it. This cannot be undone.`;
    confirmOverlay.classList.remove("hidden");
  }

  // ---------- Link sheet ----------
  function openLinkSheet(id) {
    state.editingLinkId = id;
    const f = getFile(state.currentFileId);
    if (id) {
      const l = f.links.find((x) => x.id === id);
      linkSheetTitle.textContent = "Edit Link";
      linkNameInput.value = l.name;
      linkUrlInput.value = l.url;
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
    const now = Date.now();
    if (state.editingLinkId) {
      const l = f.links.find((x) => x.id === state.editingLinkId);
      l.name = name;
      l.url = url;
      toast("Link updated");
    } else {
      f.links.push({ id: uid(), name, url, createdAt: now });
      toast("Link saved");
    }
    f.updatedAt = now;
    saveData();
    closeLinkSheet();
    render();
  });

  function askDeleteLink(id) {
    const f = getFile(state.currentFileId);
    const l = f.links.find((x) => x.id === id);
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
      state.data.files = state.data.files.filter((f) => f.id !== pd.id);
      toast("File deleted");
    } else if (pd.type === "link") {
      const f = getFile(state.currentFileId);
      f.links = f.links.filter((l) => l.id !== pd.id);
      f.updatedAt = Date.now();
      toast("Link deleted");
    }
    saveData();
    state.pendingDelete = null;
    confirmOverlay.classList.add("hidden");
    render();
  });

  // ---------- Standalone PWA Installation ----------
  let deferredInstallPrompt = null;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent the default mini-infobar or browser default banner
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
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("service-worker.js")
        .catch(() => { /* offline-first fallback */ });
    });
  }

  // ---------- Init ----------
  render();
})();
