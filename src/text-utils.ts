/**
 * Utilitários de texto puros (sem dependência da lib `docx`).
 *
 * Mantidos aqui para que módulos do caminho crítico (validators,
 * references-normalizer) não arrastem `docx-render-core` — que importa a lib
 * `docx` em runtime. `docx-render-core` re-exporta `cleanMojibakeText` deste
 * módulo por compatibilidade.
 */
export function cleanMojibakeText(value: string): string {
  return value
    // Decodifica mojibake ANTES de remover soft-hyphen/controle, senão pares
    // "Ã"+U+00AD (que codificam "í") seriam destruídos pela limpeza posterior.
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã©/g, "é")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã¼/g, "ü")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0080/g, "À")
    .replace(/Ã/g, "Á")
    .replace(/Ã\u0082/g, "Â")
    .replace(/Ã\u0083/g, "Ã")
    .replace(/Ã‰/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ã\u0094/g, "Ô")
    .replace(/Ã\u0095/g, "Õ")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã‡/g, "Ç")
    .replace(/([\p{L}\p{N}])[\u00ad\ufeff\ufffe\uffff\u2060]([\p{L}\p{N}])/gu, "$1-$2")
    .replace(/[\u00ad\ufeff\ufffe\uffff\u2060\u200b]/g, "")
    // eslint-disable-next-line no-control-regex -- remove deliberadamente caracteres de controle do texto importado
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}
