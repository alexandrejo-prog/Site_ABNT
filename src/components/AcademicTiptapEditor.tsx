import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { editorMarkupToTiptapHtml, tiptapHtmlToEditorMarkup } from "../tiptap-markup";
import "./AcademicTiptapEditor.css";

export type AcademicTiptapEditorProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  describedBy?: string;
  editable?: boolean;
};

export default function AcademicTiptapEditor({
  value,
  onChange,
  ariaLabel,
  describedBy,
  editable = true,
}: AcademicTiptapEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: editorMarkupToTiptapHtml(value),
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "editor rich-editor tiptap-editor",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(tiptapHtmlToEditorMarkup(currentEditor.getHTML()));
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!editor) return;
    const nextHtml = editorMarkupToTiptapHtml(value);
    if (editor.getHTML() === nextHtml) return;
    editor.commands.setContent(nextHtml, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="tiptap-editor-shell">
      <EditorContent editor={editor} />
    </div>
  );
}
