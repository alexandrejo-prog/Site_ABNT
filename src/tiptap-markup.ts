import { editorMarkupToHtml } from "./editor-markup";

type HtmlNode = TextHtmlNode | ElementHtmlNode;

interface TextHtmlNode {
  type: "text";
  text: string;
}

interface ElementHtmlNode {
  type: "element";
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
}

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);

export function editorMarkupToTiptapHtml(value: string): string {
  return editorMarkupToHtml(value);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function attrsFromTag(rawTag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>/]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(rawTag)) !== null) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[3] ?? match[4] ?? match[5] ?? "");
  }
  return attrs;
}

function parseHtmlFragment(html: string): HtmlNode[] {
  const root: ElementHtmlNode = { type: "element", tag: "root", attrs: {}, children: [] };
  const stack: ElementHtmlNode[] = [root];
  const tokenPattern = /<[^>]+>|[^<]+/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(html)) !== null) {
    const token = match[0];
    const parent = stack[stack.length - 1];

    if (!token.startsWith("<")) {
      parent.children.push({ type: "text", text: decodeHtml(token) });
      continue;
    }

    if (/^<!--/.test(token) || /^<!doctype/i.test(token)) continue;

    const closeMatch = token.match(/^<\s*\/\s*([a-zA-Z0-9-]+)/);
    if (closeMatch) {
      const tag = closeMatch[1].toLowerCase();
      while (stack.length > 1) {
        const current = stack.pop();
        if (current?.tag === tag) break;
      }
      continue;
    }

    const openMatch = token.match(/^<\s*([a-zA-Z0-9-]+)/);
    if (!openMatch) continue;

    const tag = openMatch[1].toLowerCase();
    const element: ElementHtmlNode = { type: "element", tag, attrs: attrsFromTag(token), children: [] };
    parent.children.push(element);
    if (!VOID_TAGS.has(tag) && !/\/\s*>$/.test(token)) stack.push(element);
  }

  return root.children;
}

function normalizeInlineWhitespace(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function inlineToMarkup(node: HtmlNode): string {
  if (node.type === "text") return normalizeInlineWhitespace(node.text);
  if (node.tag === "br" || node.tag === "hardbreak") return "\n";

  const text = node.children.map(inlineToMarkup).join("");
  if (node.tag === "strong" || node.tag === "b") return text ? `**${text}**` : "";
  if (node.tag === "em" || node.tag === "i") return text ? `*${text}*` : "";
  if (node.tag === "u") return text;
  return text;
}

function textFromChildren(node: ElementHtmlNode): string {
  return node.children.map(inlineToMarkup).join("").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function blockToMarkup(node: HtmlNode): string[] {
  if (node.type === "text") {
    const text = normalizeInlineWhitespace(node.text).trim();
    return text ? [text] : [];
  }

  const text = textFromChildren(node).trim();
  if (node.tag === "h1") return text ? [`# ${text}`] : [];
  if (node.tag === "h2") return text ? [`## ${text}`] : [];
  if (node.tag === "h3") return text ? [`### ${text}`] : [];
  if (node.tag === "blockquote") return text ? text.split(/\n+/).filter(Boolean).map((line) => `> ${line.trim()}`) : [];
  if (node.tag === "p") {
    if (!text.trim()) return [];
    return node.attrs["data-reference"] === "true" ? [`[REF] ${text.trim()}`] : [text.trim()];
  }
  if (node.tag === "li") return text ? [`- ${text.trim()}`] : [];
  if (node.tag === "ul" || node.tag === "ol") return node.children.flatMap(blockToMarkup);
  if (node.tag === "br" || node.tag === "hardbreak") return [];

  return node.children.flatMap(blockToMarkup).filter((line) => line.trim().length > 0);
}

export function tiptapHtmlToEditorMarkup(html: string): string {
  return parseHtmlFragment(html)
    .flatMap(blockToMarkup)
    .map((line) => line.replace(/\n+/g, "\n").trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n");
}
