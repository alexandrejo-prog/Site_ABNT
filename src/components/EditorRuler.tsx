import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { editorCommandAdapter, getActiveRichEditor } from "../editor-command-adapter";
import { isTiptapExperimentalEditor } from "../editor-feature-flags";

const CM_STEP = 0.25;
const MAX_FIRST_LINE_CM = 3;
const MAX_SIDE_INDENT_CM = 4;
const RULER_RANGE_CM = 10;

type RulerIndentKind = "firstLine" | "left" | "right";
type RulerValues = Record<RulerIndentKind, number>;

const DEFAULT_VALUES: RulerValues = {
  firstLine: 1.25,
  left: 0,
  right: 0,
};

interface EditorRulerProps {
  onCommand?: () => void;
}

function boundedCm(kind: RulerIndentKind, value: number): number {
  const max = kind === "firstLine" ? MAX_FIRST_LINE_CM : MAX_SIDE_INDENT_CM;
  return Math.max(0, Math.min(max, Number(value.toFixed(2))));
}

function formatCm(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} cm`;
}

function parseCm(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(",", ".");
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)cm$/i) ?? normalized.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  return match ? Number(match[1]) : null;
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}

function elementFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null;
  if (node.nodeType === Node.ELEMENT_NODE && isHTMLElement(node)) return node;
  return node.parentElement;
}

function currentEditorBlock(): HTMLElement | null {
  const editor = getActiveRichEditor();
  if (!editor) return null;
  const selection = editor.ownerDocument.getSelection?.();
  const anchor = selection?.anchorNode ?? null;
  const element = editor.contains(anchor) ? elementFromNode(anchor) : null;
  const block = element?.closest("p, h1, h2, h3, blockquote, li, div") as HTMLElement | null;
  if (block && block !== editor && editor.contains(block)) return block;
  const fallback = editor.querySelector("p, h1, h2, h3, blockquote, li, div") as HTMLElement | null;
  return fallback && fallback !== editor ? fallback : editor;
}

function valueFromBlock(block: HTMLElement, kind: RulerIndentKind): number {
  const datasetName = kind === "firstLine" ? "firstLineIndent" : kind === "left" ? "leftIndent" : "rightIndent";
  const styleName = kind === "firstLine" ? "textIndent" : kind === "left" ? "marginLeft" : "marginRight";
  const datasetValue = parseCm(block.dataset[datasetName]);
  if (datasetValue !== null) return boundedCm(kind, datasetValue);
  const styleValue = parseCm(block.style[styleName]);
  if (styleValue !== null) return boundedCm(kind, styleValue);
  return DEFAULT_VALUES[kind];
}

function readCurrentValues(): RulerValues {
  const block = currentEditorBlock();
  if (!block) return DEFAULT_VALUES;
  return {
    firstLine: valueFromBlock(block, "firstLine"),
    left: valueFromBlock(block, "left"),
    right: valueFromBlock(block, "right"),
  };
}

function markerPosition(value: number): string {
  return `${Math.max(0, Math.min(100, (value / RULER_RANGE_CM) * 100))}%`;
}

export default function EditorRuler({ onCommand }: EditorRulerProps) {
  const [values, setValues] = useState<RulerValues>(() => readCurrentValues());
  const isTiptapEnabled = isTiptapExperimentalEditor();

  const refreshValues = useCallback(() => {
    setValues(readCurrentValues());
  }, []);

  useEffect(() => {
    const events = ["selectionchange", "keyup", "mouseup", "focusin", "input"];
    events.forEach((eventName) => document.addEventListener(eventName, refreshValues, true));
    return () => events.forEach((eventName) => document.removeEventListener(eventName, refreshValues, true));
  }, [refreshValues]);

  const handleAdjust = useCallback(
    (kind: RulerIndentKind, delta: number) => {
      if (isTiptapEnabled) return;
      const nextValue = boundedCm(kind, values[kind] + delta);
      const changed = editorCommandAdapter.setCurrentBlockIndent(kind, nextValue);
      if (changed) {
        setValues(readCurrentValues());
        onCommand?.();
      }
    },
    [onCommand, values, isTiptapEnabled],
  );

  const preventSelectionLoss = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  const control = (kind: RulerIndentKind, delta: number, label: string, glyph: string) => (
    <button type="button" onMouseDown={preventSelectionLoss} onClick={() => handleAdjust(kind, delta)} aria-label={label}>{glyph}</button>
  );

  const firstLinePosition = markerPosition(values.left + values.firstLine);
  const leftPosition = markerPosition(values.left);
  const rightPosition = `${100 - Number.parseFloat(markerPosition(values.right))}%`;

  return (
    <div className="editor-ruler" aria-label="Regua funcional de recuos do paragrafo selecionado">
      <div className="editor-ruler-header">
        <span>Passo: 0,25 cm por clique</span>
        <span>Recuos do parágrafo selecionado</span>
      </div>
      <div className="editor-ruler-scale">
        <span className="editor-ruler-margin-label">3 cm</span>
        <div className="editor-ruler-marks" aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className="editor-ruler-mark" style={{ left: String(i * 10) + "%" }}>
              {i > 0 ? i : ""}
            </span>
          ))}
          <span className="editor-ruler-indent-marker first-line" style={{ left: firstLinePosition }} title="Primeira linha" />
          <span className="editor-ruler-indent-marker left-indent" style={{ left: leftPosition }} title="Recuo esquerdo" />
          <span className="editor-ruler-indent-marker right-indent" style={{ left: rightPosition }} title="Recuo direito" />
        </div>
        <span className="editor-ruler-margin-label">2 cm</span>
      </div>
      <div className="editor-ruler-controls">
        <div className="editor-ruler-control-group">
          <span className="editor-ruler-control-label">Primeira linha: <strong>{formatCm(values.firstLine)}</strong></span>
          {control("firstLine", -CM_STEP, "Diminuir recuo da primeira linha em 0,25 cm", "-")}
          {control("firstLine", CM_STEP, "Aumentar recuo da primeira linha em 0,25 cm", "+")}
        </div>
        <div className="editor-ruler-control-group">
          <span className="editor-ruler-control-label">Recuo esquerdo: <strong>{formatCm(values.left)}</strong></span>
          {control("left", -CM_STEP, "Diminuir recuo esquerdo em 0,25 cm", "-")}
          {control("left", CM_STEP, "Aumentar recuo esquerdo em 0,25 cm", "+")}
        </div>
        <div className="editor-ruler-control-group">
          <span className="editor-ruler-control-label">Recuo direito: <strong>{formatCm(values.right)}</strong></span>
          {control("right", -CM_STEP, "Diminuir recuo direito em 0,25 cm", "-")}
          {control("right", CM_STEP, "Aumentar recuo direito em 0,25 cm", "+")}
        </div>
      </div>
    </div>
  );
}
