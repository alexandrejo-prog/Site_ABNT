import { useEffect } from "react";

const ENHANCER_ATTR = "data-academic-editor-enhanced";

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
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatSetBlockTextDirection" }));
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
  return element?.closest("p, h1, h2, h3, blockquote") as HTMLElement | null;
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

function enhanceEditor() {
  const toolbar = document.querySelector('[aria-label="Ferramentas do editor"]') as HTMLElement | null;
  const editor = document.querySelector(".rich-editor") as HTMLElement | null;
  if (!toolbar || !editor || toolbar.getAttribute(ENHANCER_ATTR) === "true") return;

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

  if (!document.querySelector(".academic-ruler")) {
    editor.insertAdjacentElement("beforebegin", buildRuler());
  }
}

export function EditorEnhancer() {
  useEffect(() => {
    enhanceEditor();
    const observer = new MutationObserver(enhanceEditor);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
