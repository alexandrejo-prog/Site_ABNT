import { useMemo, useRef, useState } from "react";
import { isTiptapExperimentalEditor } from "../editor-feature-flags";
import type { TiptapEditorCommand } from "../tiptap-command-bridge";

export type EditorMode = "body" | "references";

export function useEditor() {
  const [editorText, setEditorText] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("body");
  const [tiptapCommandSignal, setTiptapCommandSignal] = useState<{ id: number; command: TiptapEditorCommand } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorContentVersionRef = useRef(0);
  const lastAppliedEditorTextRef = useRef("");

  const isTiptapEditorEnabled = useMemo(() => isTiptapExperimentalEditor(), []);

  function runTiptapCommand(command: TiptapEditorCommand) {
    setTiptapCommandSignal((current) => ({ id: (current?.id ?? 0) + 1, command }));
  }

  function resetEditor() {
    setEditorText("");
    setEditorMode("body");
    lastAppliedEditorTextRef.current = "";
    editorContentVersionRef.current += 1;
  }

  return {
    editorText, setEditorText,
    editorMode, setEditorMode,
    tiptapCommandSignal, runTiptapCommand,
    editorRef,
    editorContentVersionRef,
    lastAppliedEditorTextRef,
    isTiptapEditorEnabled,
    resetEditor,
  };
}
