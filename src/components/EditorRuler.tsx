import { useCallback, type MouseEvent } from "react";
import { editorCommandAdapter } from "../editor-command-adapter";

const CM_STEP = 0.25;

type RulerIndentKind = "firstLine" | "left" | "right";

interface EditorRulerProps {
  onCommand?: () => void;
}

export default function EditorRuler({ onCommand }: EditorRulerProps) {
  const handleAdjust = useCallback(
    (kind: RulerIndentKind, delta: number) => {
      const changed = editorCommandAdapter.adjustCurrentBlockIndent(kind, delta);
      if (changed) onCommand?.();
    },
    [onCommand],
  );

  const preventSelectionLoss = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  const control = (kind: RulerIndentKind, delta: number, label: string, glyph: string) => (
    <button type="button" onMouseDown={preventSelectionLoss} onClick={() => handleAdjust(kind, delta)} aria-label={label}>{glyph}</button>
  );

  return (
    <div className="editor-ruler" aria-label="Regua de recuos">
      <div className="editor-ruler-scale">
        <span className="editor-ruler-margin-label">3 cm</span>
        <div className="editor-ruler-marks" aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className="editor-ruler-mark" style={{ left: String(i * 10) + "%" }}>
              {i > 0 ? i : ""}
            </span>
          ))}
        </div>
        <span className="editor-ruler-margin-label">2 cm</span>
      </div>
      <div className="editor-ruler-controls">
        <div className="editor-ruler-control-group">
          <span className="editor-ruler-control-label">Primeira linha</span>
          {control("firstLine", -CM_STEP, "Diminuir recuo da primeira linha", "-")}
          {control("firstLine", CM_STEP, "Aumentar recuo da primeira linha", "+")}
        </div>
        <div className="editor-ruler-control-group">
          <span className="editor-ruler-control-label">Recuo esquerdo</span>
          {control("left", -CM_STEP, "Diminuir recuo esquerdo", "-")}
          {control("left", CM_STEP, "Aumentar recuo esquerdo", "+")}
        </div>
        <div className="editor-ruler-control-group">
          <span className="editor-ruler-control-label">Recuo direito</span>
          {control("right", -CM_STEP, "Diminuir recuo direito", "-")}
          {control("right", CM_STEP, "Aumentar recuo direito", "+")}
        </div>
      </div>
    </div>
  );
}
