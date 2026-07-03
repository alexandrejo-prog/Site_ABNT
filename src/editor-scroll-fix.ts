type ScrollSnapshot = {
  windowX: number;
  windowY: number;
  editors: Array<{ element: HTMLElement; scrollTop: number; scrollLeft: number }>;
};

let lastSnapshot: ScrollSnapshot | null = null;

function isEditorToolbarButton(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(".editor-toolbar-sticky button"));
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

function restoreAfterFormatting(): void {
  const snapshot = lastSnapshot;
  requestAnimationFrame(() => {
    restoreScroll(snapshot);
    requestAnimationFrame(() => restoreScroll(snapshot));
  });
}

if (typeof document !== "undefined") {
  document.addEventListener(
    "mousedown",
    (event) => {
      if (!isEditorToolbarButton(event.target)) return;
      lastSnapshot = captureScroll();
      event.preventDefault();
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!isEditorToolbarButton(event.target)) return;
      restoreAfterFormatting();
    },
    true,
  );
}
