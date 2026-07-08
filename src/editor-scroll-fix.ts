import { editorCommandAdapter } from "./editor-command-adapter";

type ScrollSnapshot = {
  windowX: number;
  windowY: number;
  editors: Array<{ element: HTMLElement; scrollTop: number; scrollLeft: number }>;
};

let lastSnapshot: ScrollSnapshot | null = null;
let formattingFromToolbar = false;

function isFormattingToolbarButton(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const button = target.closest(".editor-toolbar-sticky button");
  if (!(button instanceof HTMLElement)) return false;
  return !button.classList.contains("text-button");
}

function isRichEditor(element: unknown): element is HTMLElement {
  return element instanceof HTMLElement && element.classList.contains("rich-editor");
}

function captureScroll(): ScrollSnapshot {
  return {
    windowX: window.scrollX,
    windowY: window.scrollY,
    editors: Array.from(document.querySelectorAll<HTMLElement>(".rich-editor")).map((element) => ({
      element,
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
    })),
  };
}

function restoreScroll(snapshot: ScrollSnapshot | null): void {
  if (!snapshot) return;
  window.scrollTo(snapshot.windowX, snapshot.windowY);
  for (const editor of snapshot.editors) {
    editor.element.scrollTop = editor.scrollTop;
    editor.element.scrollLeft = editor.scrollLeft;
  }
}

function restoreAfterFormatting(snapshot = lastSnapshot): void {
  requestAnimationFrame(() => {
    restoreScroll(snapshot);
    requestAnimationFrame(() => {
      restoreScroll(snapshot);
      setTimeout(() => restoreScroll(snapshot), 0);
    });
  });
}

function runPreservingScroll(callback: () => void): void {
  const snapshot = lastSnapshot ?? captureScroll();
  formattingFromToolbar = true;
  try {
    callback();
  } finally {
    restoreAfterFormatting(snapshot);
    setTimeout(() => {
      formattingFromToolbar = false;
    }, 80);
  }
}

if (typeof document !== "undefined") {
  const originalFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function patchedFocus(options?: FocusOptions) {
    if (formattingFromToolbar && isRichEditor(this)) {
      return originalFocus.call(this, { ...(options ?? {}), preventScroll: true });
    }
    return originalFocus.call(this, options);
  };

  const originalExecCommand = document.execCommand.bind(document);
  document.execCommand = ((commandId: string, showUI?: boolean, value?: string) => {
    if (!formattingFromToolbar) {
      return originalExecCommand(commandId, showUI, value);
    }

    let result = false;
    runPreservingScroll(() => {
      result = originalExecCommand(commandId, showUI, value);
    });
    return result;
  }) as typeof document.execCommand;

  document.addEventListener(
    "mousedown",
    (event) => {
      if (!isFormattingToolbarButton(event.target)) return;
      lastSnapshot = captureScroll();
      formattingFromToolbar = true;
      event.preventDefault();
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!isFormattingToolbarButton(event.target)) return;
      restoreAfterFormatting();
      setTimeout(() => {
        formattingFromToolbar = false;
      }, 80);
    },
    true,
  );
}
