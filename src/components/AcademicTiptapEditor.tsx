import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { editorMarkupToTiptapHtml, tiptapHtmlToEditorMarkup } from "../tiptap-markup";
import type { TiptapEditorCommand } from "../tiptap-command-bridge";
import "./AcademicTiptapEditor.css";

export type AcademicTiptapEditorProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  describedBy?: string;
  editable?: boolean;
  commandSignal?: {
    id: number;
    command: TiptapEditorCommand;
  } | null;
};

export default function AcademicTiptapEditor({
  value,
  onChange,
  ariaLabel,
  describedBy,
  editable = true,
  commandSignal = null,
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
    if (!editor || !commandSignal) return;

    const chain = editor.chain().focus();
    switch (commandSignal.command) {
      case "bold":
        chain.toggleBold().run();
        break;
      case "italic":
        chain.toggleItalic().run();
        break;
      case "underline":
        chain.toggleUnderline().run();
        break;
      case "paragraph":
        chain.setParagraph().run();
        break;
      case "heading1":
        chain.toggleHeading({ level: 1 }).run();
        break;
      case "heading2":
        chain.toggleHeading({ level: 2 }).run();
        break;
      case "heading3":
        chain.toggleHeading({ level: 3 }).run();
        break;
      case "blockquote":
        chain.toggleBlockquote().run();
        break;
      case "reference":
        chain.insertContent("[REF] ").run();
        break;
      case "bulletList":
        chain.toggleBulletList().run();
        break;
      case "orderedList":
        chain.toggleOrderedList().run();
        break;
      case "alignLeft":
        chain.setTextAlign("left").run();
        break;
      case "alignCenter":
        chain.setTextAlign("center").run();
        break;
      case "alignJustify":
        chain.setTextAlign("justify").run();
        break;
      case "undo":
        editor.commands.undo();
        break;
      case "redo":
        editor.commands.redo();
        break;
      case "clearFormatting":
        chain.unsetAllMarks().clearNodes().run();
        break;
    }
  }, [commandSignal, editor]);

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
