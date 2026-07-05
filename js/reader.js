// Reader view: renders stored markdown with GitHub styling, KaTeX math and
// highlight.js code highlighting. The top bar holds the font-size controls;
// a middle-third tap toggles the top bar, and left/right-third taps page.

const FONT_KEY = "mdreader.fontSize";
const FONT_MIN = 12;
const FONT_MAX = 30;
const FONT_DEFAULT = 16;

function getFontSize() {
  const v = parseInt(localStorage.getItem(FONT_KEY), 10);
  return Number.isFinite(v) ? Math.min(FONT_MAX, Math.max(FONT_MIN, v)) : FONT_DEFAULT;
}
function setFontSize(px) {
  const clamped = Math.min(FONT_MAX, Math.max(FONT_MIN, px));
  localStorage.setItem(FONT_KEY, String(clamped));
  return clamped;
}

// KaTeX delimiters matching what claude.ai accepts.
const MATH_DELIMITERS = [
  { left: "$$", right: "$$", display: true },
  { left: "\\[", right: "\\]", display: true },
  { left: "\\(", right: "\\)", display: false },
  { left: "$", right: "$", display: false },
];

function renderMarkdown(container, markdown) {
  // marked -> HTML (GitHub-flavored; break on single newlines like GitHub).
  container.innerHTML = window.marked.parse(markdown, {
    gfm: true,
    breaks: false,
  });

  // Syntax highlighting first so KaTeX doesn't touch code blocks.
  if (window.hljs) {
    container.querySelectorAll("pre code").forEach((block) => {
      window.hljs.highlightElement(block);
    });
  }

  // Math rendering. ignoredTags keeps KaTeX out of code/pre.
  if (window.renderMathInElement) {
    window.renderMathInElement(container, {
      delimiters: MATH_DELIMITERS,
      throwOnError: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    });
  }
}

// Font-size controls, embedded in the reader top bar (right-aligned).
function buildFontControls(applySize) {
  const bar = document.createElement("div");
  bar.className = "reader-fontctrls";
  bar.innerHTML = `
    <button type="button" data-act="dec" aria-label="Decrease font size">A&minus;</button>
    <span class="size-label"></span>
    <button type="button" class="a-big" data-act="inc" aria-label="Increase font size">A+</button>
    <button type="button" class="link-btn" data-act="reset">Reset</button>
  `;
  const label = bar.querySelector(".size-label");
  const refresh = () => (label.textContent = `${getFontSize()}px`);
  refresh();

  bar.addEventListener("click", (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (!act) return;
    e.stopPropagation();
    let size = getFontSize();
    if (act === "inc") size = setFontSize(size + 1);
    else if (act === "dec") size = setFontSize(size - 1);
    else if (act === "reset") size = setFontSize(FONT_DEFAULT);
    applySize(size);
    refresh();
  });

  return bar;
}

export function renderReaderView(file, onBack) {
  const view = document.createElement("div");
  view.className = "reader";

  const topbar = document.createElement("div");
  topbar.className = "reader-topbar";
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = "← Back";
  back.addEventListener("click", onBack);
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = file.name;

  const scroll = document.createElement("div");
  scroll.className = "reader-scroll";
  const body = document.createElement("article");
  body.className = "markdown-body";
  scroll.appendChild(body);

  const applySize = (px) => body.style.setProperty("--md-font-size", `${px}px`);
  applySize(getFontSize());

  const fontControls = buildFontControls(applySize);
  topbar.append(back, title, fontControls);

  // Tap navigation over the full-height reader, split into horizontal thirds:
  //   left third  -> page up (previous)
  //   right third -> page down (next)
  //   middle third -> toggle the top bar
  scroll.addEventListener("click", (e) => {
    // Ignore interactions with links / buttons / selected text.
    if (e.target.closest("a, button, input, textarea, select, label")) return;
    if (window.getSelection && String(window.getSelection())) return;

    const rect = scroll.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const PAGE_OVERLAP = 60; // keep a little context between pages
    const page = Math.max(1, scroll.clientHeight - PAGE_OVERLAP);

    if (x < 1 / 3) {
      scroll.scrollBy({ top: -page, behavior: "smooth" });
    } else if (x > 2 / 3) {
      scroll.scrollBy({ top: page, behavior: "smooth" });
    } else {
      topbar.hidden = !topbar.hidden;
    }
  });

  renderMarkdown(body, file.content);

  view.append(topbar, scroll);
  return view;
}
