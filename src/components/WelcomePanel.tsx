import { Download, FilePlus2, FolderOpen, PenLine, Sparkles } from "lucide-react";

export type WelcomeAction = "import" | "new" | "drafts" | "write" | "example";

interface WelcomePanelProps {
  onAction: (action: WelcomeAction) => void;
}

export function WelcomePanel({ onAction }: WelcomePanelProps) {
  return (
    <div className="welcome-panel">
      <section className="welcome-panel-inner" aria-label="Começar um documento acadêmico">
        <p className="welcome-panel-eyebrow">Novo documento</p>
        <h2 className="welcome-panel-title">Comece seu documento acadêmico</h2>
        <p className="welcome-panel-copy">
          Importe um arquivo DOCX, TXT ou MD, ou comece a escrever diretamente no editor.
        </p>
        <div className="welcome-panel-actions">
          <button className="primary-action" type="button" onClick={() => onAction("import")}>
            <Download size={18} aria-hidden="true" />
            Importar documento
          </button>
          <button className="primary-action strong" type="button" onClick={() => onAction("new")}>
            <FilePlus2 size={18} aria-hidden="true" />
            Novo documento
          </button>
          <button className="secondary-action" type="button" onClick={() => onAction("drafts")}>
            <FolderOpen size={18} aria-hidden="true" />
            Abrir rascunho
          </button>
        </div>
        <p className="welcome-panel-note">
          Seus documentos permanecem no navegador deste computador.
        </p>
        <div className="welcome-panel-write">
          <button className="welcome-write-button" type="button" onClick={() => onAction("write")}>
            <PenLine size={14} aria-hidden="true" />
            Escrever sem importar
          </button>
          <button className="welcome-example-button" type="button" onClick={() => onAction("example")}>
            <Sparkles size={14} aria-hidden="true" />
            Carregar exemplo demonstrativo
          </button>
        </div>
      </section>
    </div>
  );
}