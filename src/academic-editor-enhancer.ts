const ENHANCER_ATTR = "data-academic-editor-enhanced";
const RULER_ATTR = "data-academic-ruler";
const STYLE_ATTR = "data-academic-editor-style";

let installed = false;
let observer: MutationObserver | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryInterval: ReturnType<typeof setInterval> | null = null;

type EditorCommand =
  | "underline"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyFull"
  | "insertOrderedList"
  | "insertUnorderedList"
  | "indent"
  | "outdent";

function dispatchEditorInput(editor: HTMLElement) {
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function execEditorCommand(editor: HTMLElement, command: EditorCommand) {
  editor.focus();
  document.execCommand(command, false);
  dispatchEditorInput(editor);
}

function insertText(editor: HTMLElement, text: string) {
  editor.focus();
  document.execCommand("insertText", false, text);
  dispatchEditorInput(editor);
}

function currentBlock(editor: HTMLElement): HTMLElement | null {
  const selection = document.getSelection();
  const node = selection?.anchorNode;
  if (!node) return editor.querySelector("p, h1, h2, h3, blockquote");
  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  return element?.closest("p, h1, h2, h3, blockquote, li") as HTMLElement | null;
}

function setLineSpacing(editor: HTMLElement, value: string) {
  editor.focus();
  const block = currentBlock(editor);
  if (!block) return;
  block.style.lineHeight = value;
  block.dataset.lineSpacing = value;
  dispatchEditorInput(editor);
}

function createButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button academic-extra-button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createSeparator(): HTMLSpanElement {
  const separator = document.createElement("span");
  separator.className = "toolbar-separator";
  separator.setAttribute("aria-hidden", "true");
  return separator;
}

function buildRuler(): HTMLDivElement {
  const ruler = document.createElement("div");
  ruler.className = "academic-ruler";
  ruler.setAttribute(RULER_ATTR, "true");
  ruler.setAttribute("aria-label", "Régua visual da página");
  ruler.setAttribute("role", "img");
  ruler.innerHTML = `
    <span class="ruler-margin ruler-margin-left">3 cm</span>
    <span class="ruler-tab ruler-tab-first">▾</span>
    <span class="ruler-tick">1</span>
    <span class="ruler-tick">2</span>
    <span class="ruler-tick">3</span>
    <span class="ruler-tick">4</span>
    <span class="ruler-tick">5</span>
    <span class="ruler-tick">6</span>
    <span class="ruler-tick">7</span>
    <span class="ruler-tick">8</span>
    <span class="ruler-tick">9</span>
    <span class="ruler-tick">10</span>
    <span class="ruler-margin ruler-margin-right">2 cm</span>
  `;
  return ruler;
}

function injectFallbackStyles() {
  if (document.querySelector(`style[${STYLE_ATTR}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(STYLE_ATTR, "true");
  style.textContent = `
    .academic-ruler{width:min(100%,920px);max-width:920px;height:34px;display:grid;grid-template-columns:64px repeat(10,1fr) 64px;align-items:end;margin:0 auto;padding:0 82px;color:#53616d;background:#f8fafc;border:1px solid #c3c9cf;border-bottom:0;border-radius:2px 2px 0 0;box-shadow:0 6px 12px rgba(15,23,42,.08);font-family:Arial,sans-serif;font-size:.68rem;user-select:none}.ruler-tick,.ruler-margin{position:relative;min-height:24px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px;border-left:1px solid #cbd5df}.ruler-tick:before{content:"";position:absolute;left:50%;bottom:0;height:9px;border-left:1px solid #7c8894}.ruler-margin{color:#7a4f01;background:#fff1bf;border-left:0;border-right:1px solid #d5bd76;font-weight:700}.ruler-margin-right{border-left:1px solid #d5bd76;border-right:0}.ruler-tab-first{position:absolute;transform:translate(104px,5px);color:#1f7b69;font-size:.8rem;z-index:1}.academic-toolbar{align-items:center}.academic-toolbar .toolbar-separator{width:1px;height:28px;margin:0 3px;background:#d7dfd8}.academic-extra-button{min-width:38px;padding:0 8px;font-size:.82rem;font-weight:800}.academic-extra-button[title*="Espaçamento"]{min-width:46px;font-size:.76rem}.rich-editor ul,.rich-editor ol{margin:0 0 12pt 1.5cm;padding-left:.5cm}.rich-editor li{margin:0 0 6pt;line-height:1.5;text-align:justify}.force-generate{border:2px solid #f0b429!important;background:#fff7d6!important;box-shadow:0 0 0 3px rgba(240,180,41,.18)!important}.force-generate span{font-size:.92rem}@media(max-width:780px){.academic-ruler{display:none}.academic-toolbar .toolbar-separator{display:none}}
  `;
  document.head.appendChild(style);
}

function findToolbar(): HTMLElement | null {
  const byLabel = document.querySelector('[aria-label="Ferramentas do editor"]') as HTMLElement | null;
  if (byLabel) return byLabel;
  const editor = document.querySelector(".rich-editor") as HTMLElement | null;
  const pane = editor?.closest(".editor-pane");
  return pane?.querySelector(".editor-toolbar-sticky .toolbar:nth-of-type(2)") as HTMLElement | null;
}

export function enhanceAcademicEditor(): boolean {
  if (typeof document === "undefined") return false;
  injectFallbackStyles();
  const toolbar = findToolbar();
  const editor = document.querySelector(".rich-editor") as HTMLElement | null;
  if (!toolbar || !editor) return false;

  if (toolbar.getAttribute(ENHANCER_ATTR) !== "true") {
    toolbar.setAttribute(ENHANCER_ATTR, "true");
    toolbar.classList.add("academic-toolbar");

    toolbar.appendChild(createSeparator());
    toolbar.appendChild(createButton("S", "Sublinhado", () => execEditorCommand(editor, "underline")));
    toolbar.appendChild(createButton("•", "Lista com marcadores", () => execEditorCommand(editor, "insertUnorderedList")));
    toolbar.appendChild(createButton("1.", "Lista numerada", () => execEditorCommand(editor, "insertOrderedList")));
    toolbar.appendChild(createButton("⇥", "Inserir tabulação", () => insertText(editor, "\t")));
    toolbar.appendChild(createButton("←", "Diminuir recuo", () => execEditorCommand(editor, "outdent")));
    toolbar.appendChild(createButton("→", "Aumentar recuo", () => execEditorCommand(editor, "indent")));

    toolbar.appendChild(createSeparator());
    toolbar.appendChild(createButton("E", "Alinhar à esquerda", () => execEditorCommand(editor, "justifyLeft")));
    toolbar.appendChild(createButton("C", "Centralizar", () => execEditorCommand(editor, "justifyCenter")));
    toolbar.appendChild(createButton("J", "Justificar", () => execEditorCommand(editor, "justifyFull")));

    toolbar.appendChild(createSeparator());
    toolbar.appendChild(createButton("1,0", "Espaçamento simples no parágrafo atual", () => setLineSpacing(editor, "1.2")));
    toolbar.appendChild(createButton("1,5", "Espaçamento 1,5 no parágrafo atual", () => setLineSpacing(editor, "1.5")));
    toolbar.appendChild(createButton("2,0", "Espaçamento duplo no parágrafo atual", () => setLineSpacing(editor, "2")));
  }

  if (!document.querySelector(`.academic-ruler[${RULER_ATTR}]`)) {
    editor.insertAdjacentElement("beforebegin", buildRuler());
  }

  return true;
}

export function installAcademicEditorEnhancer(): () => void {
  if (typeof document === "undefined") return () => undefined;
  if (installed) return () => undefined;
  installed = true;

  let attempts = 0;
  const tryEnhance = () => {
    attempts += 1;
    const enhanced = enhanceAcademicEditor();
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryTimer = setTimeout(enhanceAcademicEditor, 250);
    if (enhanced && retryInterval && attempts > 3) {
      clearInterval(retryInterval);
      retryInterval = null;
    }
  };

  tryEnhance();
  retryInterval = setInterval(tryEnhance, 400);
  observer = new MutationObserver(tryEnhance);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    installed = false;
    if (observer) observer.disconnect();
    observer = null;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    if (retryInterval) clearInterval(retryInterval);
    retryInterval = null;
  };
}
