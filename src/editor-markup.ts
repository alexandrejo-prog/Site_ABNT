export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function emEtAl(value: string): string {
  return value.replace(/(et\s+al\.)/giu, "<em>$1</em>");
}

export function inlineMarkupToHtml(value: string): string {
  const parts: string[] = [];
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[x:[^\]]*\])/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(value)) !== null) {
    if (match.index > cursor) parts.push(emEtAl(escapeHtml(value.slice(cursor, match.index))));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(`<strong>${escapeHtml(token.slice(2, -2))}</strong>`);
    } else if (token.startsWith("*")) {
      parts.push(`<em>${escapeHtml(token.slice(1, -1))}</em>`);
    } else {
      // referência cruzada [x:ANCHOR~texto] → link interno no preview
      const xref = /^\[x:([^\]~]+)(?:~([^\]]*))?\]$/.exec(token);
      if (xref) {
        const anchor = xref[1].trim();
        const visible = (xref[2] ?? "").trim();
        parts.push(`<a href="#${escapeHtml(anchor)}" class="preview-xref">${escapeHtml(visible)}</a>`);
      } else {
        parts.push(escapeHtml(token));
      }
    }
    cursor = match.index + token.length;
  }
  if (cursor < value.length) parts.push(emEtAl(escapeHtml(value.slice(cursor))));
  return parts.join("") || "<br />";
}

export function editorMarkupToHtml(value: string): string {
  if (!value.trim()) return "<p><br /></p>";
  return value.split(/\n/).map((rawLine) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) return "<p><br /></p>";
    if (/^###\s+/.test(line)) return `<h3>${inlineMarkupToHtml(line.replace(/^###\s+/, ""))}</h3>`;
    if (/^##\s+/.test(line)) return `<h2>${inlineMarkupToHtml(line.replace(/^##\s+/, ""))}</h2>`;
    if (/^#\s+/.test(line)) return `<h1>${inlineMarkupToHtml(line.replace(/^#\s+/, ""))}</h1>`;
    if (/^>\s+/.test(line)) return `<blockquote>${inlineMarkupToHtml(line.replace(/^>\s+/, ""))}</blockquote>`;
    if (/^\[REF\]\s+/i.test(line)) return `<p data-reference="true">${inlineMarkupToHtml(line.replace(/^\[REF\]\s+/i, ""))}</p>`;
    return `<p>${inlineMarkupToHtml(line)}</p>`;
  }).join("");
}

export function inlineNodeToMarkup(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = node as HTMLElement;
  if (element.tagName === "BR") return "\n";
  const text = Array.from(element.childNodes).map(inlineNodeToMarkup).join("");
  if (element.tagName === "STRONG" || element.tagName === "B") return `**${text}**`;
  if (element.tagName === "EM" || element.tagName === "I") return `*${text}*`;
  return text;
}

export function blockNodeToMarkup(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").trim();
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = node as HTMLElement;
  const text = Array.from(element.childNodes).map(inlineNodeToMarkup).join("").replace(/\n+$/g, "").trimEnd();
  if (!text.trim()) return "";
  if (element.tagName === "H1") return `# ${text}`;
  if (element.tagName === "H2") return `## ${text}`;
  if (element.tagName === "H3") return `### ${text}`;
  if (element.tagName === "BLOCKQUOTE") return `> ${text}`;
  if (element.dataset.reference === "true") return `[REF] ${text}`;
  return text;
}

export function editorHtmlToMarkup(element: HTMLElement): string {
  return Array.from(element.childNodes).map(blockNodeToMarkup).filter((line) => line.trim().length > 0).join("\n");
}
