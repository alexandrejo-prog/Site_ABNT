import { useEffect } from "react";
import { installAcademicEditorEnhancer } from "../academic-editor-enhancer";

export function EditorEnhancer() {
  useEffect(() => installAcademicEditorEnhancer(), []);
  return null;
}
