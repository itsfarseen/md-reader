// App entry: hash router, home view (upload + file list), version display.

import { APP_VERSION } from "../version.js";
import { addFile, listFiles, getFile, deleteFile } from "./storage.js";
import { renderReaderView } from "./reader.js";
import { getTheme, toggleTheme } from "./theme.js";
import { initUpdates } from "./update.js";
import { initInstall, createInstallButton } from "./install.js";

const app = document.getElementById("app");

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function themeButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  const paint = () => (btn.textContent = getTheme() === "dark" ? "☀️ Light" : "🌙 Dark");
  paint();
  btn.addEventListener("click", () => {
    toggleTheme();
    paint();
  });
  return btn;
}

async function ingestFiles(fileList) {
  const files = [...fileList].filter((f) =>
    /\.(md|markdown|mdown|mkd|txt)$/i.test(f.name) || f.type === "text/markdown"
  );
  if (!files.length) {
    toast("No markdown files selected");
    return;
  }
  for (const f of files) {
    const content = await f.text();
    await addFile({ name: f.name, content });
  }
  location.hash = "#/";
  renderHome();
}

async function renderHome() {
  const files = await listFiles();

  const home = document.createElement("div");
  home.className = "home";

  // Header
  const header = document.createElement("div");
  header.className = "home-header";
  const h1 = document.createElement("h1");
  h1.textContent = "Markdown Reader";
  const actions = document.createElement("div");
  actions.className = "header-actions";
  actions.append(createInstallButton(), themeButton());
  header.append(h1, actions);

  // Uploader
  const uploader = document.createElement("div");
  uploader.className = "uploader";
  uploader.innerHTML = `
    <input type="file" id="file-input" accept=".md,.markdown,.mdown,.mkd,.txt,text/markdown" multiple>
    <p><label for="file-input">Choose markdown files</label> or drop them here.</p>
  `;
  const input = uploader.querySelector("#file-input");
  input.addEventListener("change", () => ingestFiles(input.files));

  // Drag & drop
  ["dragenter", "dragover"].forEach((evt) =>
    uploader.addEventListener(evt, (e) => {
      e.preventDefault();
      uploader.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    uploader.addEventListener(evt, (e) => {
      e.preventDefault();
      uploader.classList.remove("dragover");
    })
  );
  uploader.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) ingestFiles(e.dataTransfer.files);
  });

  // File list
  const listWrap = document.createElement("div");
  if (files.length === 0) {
    listWrap.innerHTML = `<div class="empty-state">No files yet. Upload a markdown file to get started.</div>`;
  } else {
    const ul = document.createElement("ul");
    ul.className = "file-list";
    for (const file of files) {
      const li = document.createElement("li");
      li.className = "file-item";

      const link = document.createElement("a");
      link.href = `#/read/${file.id}`;
      link.innerHTML = `
        <span class="file-name"></span>
        <span class="file-meta">${formatSize(file.size)} · ${formatDate(file.addedAt)}</span>
      `;
      link.querySelector(".file-name").textContent = file.name;

      const del = document.createElement("button");
      del.className = "file-delete";
      del.type = "button";
      del.textContent = "Delete";
      del.setAttribute("aria-label", `Delete ${file.name}`);
      del.addEventListener("click", async (e) => {
        e.preventDefault();
        await deleteFile(file.id);
        renderHome();
      });

      li.append(link, del);
      ul.appendChild(li);
    }
    listWrap.appendChild(ul);
  }

  const footer = document.createElement("div");
  footer.className = "app-footer";
  footer.textContent = `Markdown Reader v${APP_VERSION}`;

  home.append(header, uploader, listWrap, footer);
  app.replaceChildren(home);
}

async function renderReader(id) {
  const file = await getFile(id);
  if (!file) {
    toast("File not found");
    location.hash = "#/";
    return;
  }
  const view = renderReaderView(file, () => {
    location.hash = "#/";
  });
  app.replaceChildren(view);
}

function router() {
  const hash = location.hash || "#/";
  const readMatch = hash.match(/^#\/read\/(\d+)$/);
  if (readMatch) {
    renderReader(readMatch[1]);
  } else {
    renderHome();
  }
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
// DOMContentLoaded may have already fired before this module executes.
if (document.readyState !== "loading") router();

initUpdates();
initInstall();
