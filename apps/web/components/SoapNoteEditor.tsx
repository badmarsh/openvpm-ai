"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Trash2,
  Underline as UnderlineIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface SoapNoteEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function SoapNoteEditor({
  value,
  onChange,
  placeholder: placeholderProp,
  className,
}: SoapNoteEditorProps) {
  const { t } = useI18n();
  const [isEmpty, setIsEmpty] = useState(!value);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { HTMLAttributes: { class: "list-disc list-inside" } },
        orderedList: { HTMLAttributes: { class: "list-decimal list-inside" } },
        paragraph: { HTMLAttributes: { class: "mb-2" } },
        code: { HTMLAttributes: { class: "bg-muted px-1 rounded text-xs font-mono" } },
        codeBlock: { HTMLAttributes: { class: "bg-muted p-2 rounded text-xs font-mono overflow-x-auto mb-2" } },
      }),
      Highlight.configure({ multicolor: true }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      setIsEmpty(editor.isEmpty);
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none p-3 min-h-32",
          // The contenteditable surface is the real input: give it the same
          // visible keyboard focus ring as <Input>, inset so it stays inside
          // the rounded, overflow-hidden frame.
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          "text-foreground placeholder-muted-foreground",
          className
        ),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const nextValue = value || "";
    const currentValue = editor.isEmpty ? "" : editor.getHTML();
    if (currentValue === nextValue) return;
    editor.commands.setContent(nextValue, { emitUpdate: false });
    setIsEmpty(editor.isEmpty);
  }, [editor, value]);

  if (!editor) return null;

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  // Underline ships inside @tiptap/starter-kit v3; no separate extension needed.
  const toggleUnderline = () => editor.chain().focus().toggleUnderline().run();
  const clearFormatting = () => editor.chain().focus().clearNodes().run();

  const labels = {
    toolbar: t("soap.editor.toolbar", "Text formatting"),
    bold: t("soap.editor.bold", "Bold (Ctrl+B)"),
    italic: t("soap.editor.italic", "Italic (Ctrl+I)"),
    underline: t("soap.editor.underline", "Underline (Ctrl+U)"),
    bulletList: t("soap.editor.bulletList", "Bullet list"),
    orderedList: t("soap.editor.orderedList", "Numbered list"),
    clearFormatting: t("soap.editor.clearFormatting", "Clear formatting"),
  };
  const placeholder =
    placeholderProp ?? t("soap.editor.placeholder", "Enter text here…");

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label={labels.toolbar}
        className="flex items-center gap-1 p-2 border-b border-border bg-muted/50 flex-wrap"
      >
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("bold") ? "default" : "outline"}
            onClick={toggleBold}
            title={labels.bold}
            aria-label={labels.bold}
            aria-pressed={editor.isActive("bold")}
            className="h-8 w-8 p-0"
          >
            <Bold className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("italic") ? "default" : "outline"}
            onClick={toggleItalic}
            title={labels.italic}
            aria-label={labels.italic}
            aria-pressed={editor.isActive("italic")}
            className="h-8 w-8 p-0"
          >
            <Italic className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("underline") ? "default" : "outline"}
            onClick={toggleUnderline}
            title={labels.underline}
            aria-label={labels.underline}
            aria-pressed={editor.isActive("underline")}
            className="h-8 w-8 p-0"
          >
            <UnderlineIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("bulletList") ? "default" : "outline"}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title={labels.bulletList}
            aria-label={labels.bulletList}
            aria-pressed={editor.isActive("bulletList")}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("orderedList") ? "default" : "outline"}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title={labels.orderedList}
            aria-label={labels.orderedList}
            aria-pressed={editor.isActive("orderedList")}
            className="h-8 w-8 p-0"
          >
            <ListOrdered className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={clearFormatting}
          title={labels.clearFormatting}
          aria-label={labels.clearFormatting}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Editor */}
      <div className="relative">
        <EditorContent editor={editor} />
        {isEmpty && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground"
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
