(() => {
  "use strict";

  const STORAGE_KEY = "linkvault.data.v1";
  const COLORS = ["#d4af37", "#1e293b", "#b3452c", "#4a7c59", "#3b6ea5", "#7b4b94"];

  // ---------- Storage ----------
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to default */ }
    return { notebooks: [] };
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
    view: "notebooks",      // "notebooks" | "links"
    currentNotebookId: null,
    searchQuery: "",
    editingNotebookId: null,   // set when notebook sheet is in edit mode
    editingLinkId: null,       // set when link sheet is in edit mode
    pendingDelete: null,       // { type: 'notebook'|'link', id }
    selectedColor: COLORS[0],
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

  const notebookOverlay = $("notebookOverlay");
  const notebookSheetTitle = $("notebookSheetTitle");
  const notebookNameInput = $("notebookNameInput");
  const colorRow = $("colorRow");
  const notebookSaveBtn = $("notebookSaveBtn");
  const notebookCancelBtn = $("notebookCancelBtn");

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

  function getNotebook(id) {
    return state.data.notebooks.find((n) => n.id === id);
  }

  // ---------- Rendering ----------
  function render() {
    if (state.view === "notebooks") {
      renderNotebookList();
    } else {
      renderLinkList();
    }
  }

  function renderNotebookList() {
    pageTitle.textContent = "LinkVault";
    backBtn.style.display = "none";
    fabBtn.setAttribute("aria-label", "New notebook");

    let notebooks = state.data.notebooks;
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      notebooks = notebooks.filter((n) => n.name.toLowerCase().includes(q));
    }
    notebooks = [...notebooks].sort((a, b) => b.updatedAt - a.updatedAt);

    if (notebooks.length === 0) {
      mainView.innerHTML = `
        <div class="empty-state">
          <span class="glyph">&#128218;</span>
          <p>${state.data.notebooks.length === 0
              ? "No notebooks yet. Tap + to create one — like \u201cReact Tutorials\u201d or \u201cInterview Prep\u201d — and start saving links inside it."
              : "No notebooks match your search."}</p>
        </div>`;
      return;
    }

    mainView.innerHTML = `<div class="notebook-grid">${notebooks.map(nbCardHtml).join("")}</div>`;

    notebooks.forEach((nb) => {
      const card = document.getElementById("nb-" + nb.id);
      card.addEventListener("click", () => openNotebook(nb.id));
      let pressTimer;
      card.addEventListener("touchstart", () => { pressTimer = setTimeout(() => openNotebookMenu(nb.id), 500); });
      card.addEventListener("touchend", () => clearTimeout(pressTimer));
      card.addEventListener("contextmenu", (e) => { e.preventDefault(); openNotebookMenu(nb.id); });
    });
  }

  function nbCardHtml(nb) {
    const count = nb.links.length;
    return `
      <div class="notebook-card" id="nb-${nb.id}">
        <div class="stripe" style="background:${nb.color}"></div>
        <div>
          <div class="nb-name">${escapeHtml(nb.name)}</div>
        </div>
        <div class="nb-meta">${count} link${count === 1 ? "" : "s"} &middot; ${formatDate(nb.updatedAt)}</div>
      </div>`;
  }

  function openNotebookMenu(id) {
    const nb = getNotebook(id);
    if (!nb) return;
    const choice = confirm(`"${nb.name}"\n\nOK = Rename   /   Cancel = Delete`);
    if (choice) {
      openNotebookSheet(id);
    } else {
      askDeleteNotebook(id);
    }
  }

  function renderLinkList() {
    const nb = getNotebook(state.currentNotebookId);
    if (!nb) { state.view = "notebooks"; render(); return; }

    pageTitle.textContent = nb.name;
    backBtn.style.display = "inline-block";
    fabBtn.setAttribute("aria-label", "New link");

    let links = nb.links;
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      links = links.filter((l) => l.name.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
    }
    links = [...links].sort((a, b) => b.createdAt - a.createdAt);

    if (links.length === 0) {
      mainView.innerHTML = `
        <div class="empty-state">
          <span class="glyph">&#128279;</span>
          <p>${nb.links.length === 0
              ? "This notebook is empty. Tap + to save your first link. You'll pick the name it shows here."
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
          <button id="edit-${l.id}" aria-label="Edit">&#9998;</button>
          <button id="del-${l.id}" aria-label="Delete">&#128465;</button>
        </div>
      </div>`;
  }

  // ---------- Navigation ----------
  function openNotebook(id) {
    state.currentNotebookId = id;
    state.view = "links";
    state.searchQuery = "";
    searchInput.value = "";
    searchWrap.style.display = "none";
    render();
  }

  backBtn.addEventListener("click", () => {
    state.view = "notebooks";
    state.currentNotebookId = null;
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
    if (state.view === "notebooks") openNotebookSheet(null);
    else openLinkSheet(null);
  });

  // ---------- Notebook sheet ----------
  function buildColorRow() {
    colorRow.innerHTML = COLORS.map(
      (c) => `<div class="color-dot" data-color="${c}" style="background:${c}"></div>`
    ).join("");
    colorRow.querySelectorAll(".color-dot").forEach((dot) => {
      dot.addEventListener("click", () => {
        state.selectedColor = dot.dataset.color;
        highlightColor();
      });
    });
  }
  function highlightColor() {
    colorRow.querySelectorAll(".color-dot").forEach((dot) => {
      dot.classList.toggle("selected", dot.dataset.color === state.selectedColor);
    });
  }
  buildColorRow();

  function openNotebookSheet(id) {
    state.editingNotebookId = id;
    if (id) {
      const nb = getNotebook(id);
      notebookSheetTitle.textContent = "Rename Notebook";
      notebookNameInput.value = nb.name;
      state.selectedColor = nb.color;
    } else {
      notebookSheetTitle.textContent = "New Notebook";
      notebookNameInput.value = "";
      state.selectedColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    highlightColor();
    notebookOverlay.classList.remove("hidden");
    setTimeout(() => notebookNameInput.focus(), 50);
  }

  function closeNotebookSheet() {
    notebookOverlay.classList.add("hidden");
    state.editingNotebookId = null;
  }

  notebookCancelBtn.addEventListener("click", closeNotebookSheet);
  notebookOverlay.addEventListener("click", (e) => { if (e.target === notebookOverlay) closeNotebookSheet(); });

  notebookSaveBtn.addEventListener("click", () => {
    const name = notebookNameInput.value.trim();
    if (!name) { toast("Give the notebook a name"); return; }
    const now = Date.now();
    if (state.editingNotebookId) {
      const nb = getNotebook(state.editingNotebookId);
      nb.name = name;
      nb.color = state.selectedColor;
      nb.updatedAt = now;
      toast("Notebook renamed");
    } else {
      state.data.notebooks.push({
        id: uid(),
        name,
        color: state.selectedColor,
        links: [],
        createdAt: now,
        updatedAt: now,
      });
      toast("Notebook created");
    }
    saveData();
    closeNotebookSheet();
    render();
  });

  function askDeleteNotebook(id) {
    const nb = getNotebook(id);
    state.pendingDelete = { type: "notebook", id };
    confirmTitle.textContent = `Delete "${nb.name}"?`;
    confirmBody.textContent = `This removes the notebook and all ${nb.links.length} link(s) inside it. This can't be undone.`;
    confirmOverlay.classList.remove("hidden");
  }

  // ---------- Link sheet ----------
  function openLinkSheet(id) {
    state.editingLinkId = id;
    const nb = getNotebook(state.currentNotebookId);
    if (id) {
      const l = nb.links.find((x) => x.id === id);
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
    const nb = getNotebook(state.currentNotebookId);
    const now = Date.now();
    if (state.editingLinkId) {
      const l = nb.links.find((x) => x.id === state.editingLinkId);
      l.name = name;
      l.url = url;
      toast("Link updated");
    } else {
      nb.links.push({ id: uid(), name, url, createdAt: now });
      toast("Link saved");
    }
    nb.updatedAt = now;
    saveData();
    closeLinkSheet();
    render();
  });

  function askDeleteLink(id) {
    const nb = getNotebook(state.currentNotebookId);
    const l = nb.links.find((x) => x.id === id);
    state.pendingDelete = { type: "link", id };
    confirmTitle.textContent = `Delete "${l.name}"?`;
    confirmBody.textContent = "This can't be undone.";
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
    if (pd.type === "notebook") {
      state.data.notebooks = state.data.notebooks.filter((n) => n.id !== pd.id);
      toast("Notebook deleted");
    } else if (pd.type === "link") {
      const nb = getNotebook(state.currentNotebookId);
      nb.links = nb.links.filter((l) => l.id !== pd.id);
      nb.updatedAt = Date.now();
      toast("Link deleted");
    }
    saveData();
    state.pendingDelete = null;
    confirmOverlay.classList.add("hidden");
    render();
  });

  // ---------- Install prompt ----------
  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallBanner();
  });

  function showInstallBanner() {
    if (document.getElementById("installBanner")) return;
    const banner = document.createElement("div");
    banner.className = "install-banner";
    banner.id = "installBanner";
    banner.innerHTML = `
      <span>Install LinkVault on your home screen for offline access.</span>
      <button id="installNowBtn">Install</button>
      <button class="dismiss" id="installDismissBtn" aria-label="Dismiss">&times;</button>`;
    mainView.parentElement.insertBefore(banner, mainView);
    document.getElementById("installNowBtn").addEventListener("click", async () => {
      banner.remove();
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
      }
    });
    document.getElementById("installDismissBtn").addEventListener("click", () => banner.remove());
  }

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => { /* offline-first, ignore */ });
    });
  }

  // ---------- Init ----------
  render();
})();
