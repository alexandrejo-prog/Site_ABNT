export function useTiptapExperimentalEditor(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("editor") === "tiptap";
}
