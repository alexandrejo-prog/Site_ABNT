import { useEffect } from "react";
import { installAcademicEditorEnhancer } from "../academic-editor-enhancer";
import { ADHERENCE_CATEGORIES } from "../validators";

interface AdherencePanelProps {
  expanded: boolean;
  onToggle: () => void;
}

export function AdherencePanel({ expanded, onToggle }: AdherencePanelProps) {
  useEffect(() => installAcademicEditorEnhancer(), []);

  return (
    <div className="adherence-panel">
      <button type="button" className="adherence-header" onClick={onToggle} aria-expanded={expanded} aria-controls="adherence-content">
        <span>Painel de aderência normativa</span>
        <span className={`adherence-chevron ${expanded ? "open" : ""}`}>▼</span>
      </button>
      {expanded && (
        <div className="adherence-body" id="adherence-content">
          <p className="adherence-disclaimer">Este painel reflete o que o sistema implementa atualmente. A conformidade final depende de revisão manual no DOCX gerado.</p>
          <div className="adherence-grid">
            {ADHERENCE_CATEGORIES.map((category) => (
              <div className="adherence-item" key={category.key}>
                <span className="adherence-label">{category.label}</span>
                <span className={`adherence-status adherence-${category.status}`}>{category.statusLabel}</span>
                {category.note && <span className="adherence-note">{category.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
