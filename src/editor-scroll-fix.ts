export type EditorScrollFixCleanup = () => void;

type ScrollSnapshot = {
  windowX: number;
  windowY: number;
  editors: Array<{ element: HTMLElement; scrollTop: number; scrollLeft: number }>;
};

let installedCleanup: EditorScrollFixCleanup | null = null;

function isFormattingToolbarButton(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const button = target.closest(".editor-toolbar-sticky button");
  if (!(button instanceof HTMLElement)) return false;
  return !button.classList.contains("text-button");
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

export function installEditorScrollFix(): EditorScrollFixCleanup {
  if (typeof document === "undefined") return () => undefined;
  if (installedCleanup) return installedCleanup;

  let lastSnapshot: ScrollSnapshot | null = null;
  const restoreTimers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;

  function restoreAfterFormatting(snapshot = lastSnapshot): void {
    requestAnimationFrame(() => {
      if (disposed) return;
      restoreScroll(snapshot);
      requestAnimationFrame(() => {
        if (disposed) return;
        restoreScroll(snapshot);
        const timer = setTimeout(() => {
          restoreTimers.delete(timer);
          if (!disposed) restoreScroll(snapshot);
        }, 0);
        restoreTimers.add(timer);
      });
    });
  }

  function handleMouseDown(event: MouseEvent): void {
    if (!isFormattingToolbarButton(event.target)) return;
    lastSnapshot = captureScroll();
    event.preventDefault();
  }

  function handleClick(event: MouseEvent): void {
    if (!isFormattingToolbarButton(event.target)) return;
    restoreAfterFormatting();
  }

  document.addEventListener("mousedown", handleMouseDown, true);
  document.addEventListener("click", handleClick, true);

  installedCleanup = () => {
    disposed = true;
    document.removeEventListener("mousedown", handleMouseDown, true);
    document.removeEventListener("click", handleClick, true);
    restoreTimers.forEach((timer) => clearTimeout(timer));
    restoreTimers.clear();
    installedCleanup = null;
  };

  return installedCleanup;
}
