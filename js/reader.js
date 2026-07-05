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

// Math is tokenized during marked parsing (see mathExtensions) rather than by a
// post-hoc DOM scan. Rendering math after marked let marked mangle the LaTeX first
// — e.g. subscript underscores in `$\mathbb{Q}_{\ge 0}$` were paired into <em>,
// splitting the formula across element boundaries so KaTeX could no longer match it.
// As a marked token the math content is opaque to marked, and code blocks/spans are
// skipped naturally (their content never reaches the inline lexer).

// Render one math token to an HTML string; never throw out of the renderer.
function renderMath(tex, displayMode) {
  try {
    return window.katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch {
    const span = document.createElement("span");
    span.textContent = tex; // fall back to escaped source rather than blow up
    return span.outerHTML;
  }
}

// Factory for an inline-level marked math extension. Delimiters match what
// claude.ai accepts: $$…$$ and \[…\] (display), \(…\) and $…$ (inline).
function mathExtension(name, trigger, re, displayMode) {
  return {
    name,
    level: "inline",
    start(src) {
      const i = src.indexOf(trigger);
      return i < 0 ? undefined : i;
    },
    tokenizer(src) {
      const m = re.exec(src);
      if (!m) return undefined;
      return { type: name, raw: m[0], text: m[1], displayMode };
    },
    renderer(token) {
      return renderMath(token.text, token.displayMode);
    },
  };
}

// Order matters: $$ must be registered before single-$.
const mathExtensions = [
  mathExtension("mathBlockDollar",  "$$",  /^\$\$([\s\S]+?)\$\$/,   true),
  mathExtension("mathBlockBracket", "\\[", /^\\\[([\s\S]+?)\\\]/,   true),
  mathExtension("mathInlineParen",  "\\(", /^\\\(([\s\S]+?)\\\)/,   false),
  // inline $…$. Pandoc-style currency guard: the closing $ must not be
  // immediately followed by a digit (so "$5 and $10" / "$20,000" stay literal).
  // Digits ARE allowed right after the opening $, so "$0$" / "$1 + 1 = 2$" render.
  mathExtension("mathInlineDollar", "$",   /^\$(?!\s)((?:\\\$|[^$])+?)(?<!\s)\$(?!\d)/, false),
];

let markedConfigured = false;
function configureMarked() {
  if (markedConfigured || !window.marked) return;
  window.marked.use({ extensions: mathExtensions });
  markedConfigured = true;
}

function renderMarkdown(container, markdown) {
  // Install the math extensions lazily (once) so we don't race the deferred
  // marked CDN script at module-import time.
  configureMarked();

  // marked -> HTML (GitHub-flavored; break on single newlines like GitHub).
  // Math is emitted as final KaTeX HTML during this parse.
  container.innerHTML = window.marked.parse(markdown, {
    gfm: true,
    breaks: false,
  });

  // Syntax highlighting for fenced code blocks.
  if (window.hljs) {
    container.querySelectorAll("pre code").forEach((block) => {
      window.hljs.highlightElement(block);
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
