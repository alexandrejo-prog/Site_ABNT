/**
 * Conversor OMML → LaTeX (subset do ECMA-376 parte 1, §22.1.2).
 *
 * Equações importadas de DOCX chegam ao rascunho com o OMML cru embutido
 * (token `\uF001OMML:...` — ver `ommlContentToken` em docx-render-core). O
 * preview renderiza LaTeX com KaTeX; para exibir essas equações com a MESMA
 * fidelidade visual do Word (frações, raízes, sub/sobrescritos, ∫/∑/∏/lim),
 * o OMML é convertido aqui para LaTeX.
 *
 * Não depende de DOM/DOMParser — usa um tokenizador XML mínimo de pilha, então
 * roda no navegador e no Node (vitest). Onde um elemento não é reconhecido, o
 * conteúdo é passado adiante (degradação graciosa; o KaTeX tem fallback em
 * preview-html).
 */

interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: Array<XmlNode | string>;
}

/** Decodifica as entidades XML básicas (o OMML cru é texto UTF-8 com XML). */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Tokenizador XML mínimo (pilha). Lida com atributos entre aspas, tags de
 * fechamento, auto-fechamento e texto entre tags. Não suporta CDATA/comentários
 * (OMML não os usa).
 */
function parseXmlFragment(xml: string): XmlNode[] {
  const roots: XmlNode[] = [];
  const stack: XmlNode[] = [];
  let i = 0;
  const n = xml.length;

  const pushText = (text: string) => {
    const trimmed = text;
    if (!trimmed) return;
    const target = stack[stack.length - 1];
    if (target) target.children.push(trimmed);
  };

  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt === -1) {
      pushText(decodeEntities(xml.slice(i)));
      break;
    }
    if (lt > i) pushText(decodeEntities(xml.slice(i, lt)));
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      const data = end === -1 ? xml.slice(lt + 9) : xml.slice(lt + 9, end);
      pushText(data);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml.startsWith("<?", lt) || xml.startsWith("<!", lt)) {
      const end = xml.indexOf(">", lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (xml.startsWith("</", lt)) {
      const gt = xml.indexOf(">", lt);
      const tag = xml.slice(lt + 2, gt).trim();
      const top = stack[stack.length - 1];
      if (top && top.tag === tag) stack.pop();
      i = gt + 1;
      continue;
    }
    // tag de abertura (possivelmente auto-fechada)
    let gt = lt + 1;
    let inQuote: string | null = null;
    for (; gt < n; gt++) {
      const ch = xml[gt];
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ">") {
        break;
      }
    }
    if (gt >= n) break;
    const raw = xml.slice(lt + 1, gt);
    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1).trim() : raw.trim();
    const spaceIdx = body.search(/\s/);
    const tag = (spaceIdx === -1 ? body : body.slice(0, spaceIdx)).trim();
    const attrs: Record<string, string> = {};
    if (spaceIdx !== -1) {
      const attrRe = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let am: RegExpExecArray | null;
      while ((am = attrRe.exec(body.slice(spaceIdx)))) {
        attrs[am[1]] = am[3] ?? am[4] ?? "";
      }
    }
    const node: XmlNode = { tag, attrs, children: [] };
    if (stack.length > 0) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    if (!selfClosing) stack.push(node);
    i = gt + 1;
  }
  return roots;
}

/** Escapa caracteres especiais do LaTeX no texto (mantém unicode matemático). */
function escapeLatexText(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([#$%&_{}~^])/g, "\\$1");
}

/** Mapeia caracteres de delimitador OMML (m:d) para LaTeX \left/\right. */
function delimiterLatex(chr: string | undefined): string | null {
  switch (chr) {
    case "(":
    case ")":
    case "[":
    case "]":
    case "|":
      return chr;
    case "{":
      return "\\{";
    case "}":
      return "\\}";
    case "<":
      return "\\langle";
    case ">":
      return "\\rangle";
    case "‖":
      return "\\|";
    case "":
    case undefined:
      return null;
    default:
      return chr;
  }
}

/** Mapeia o caractere de m:naryPr/m:chr (∫/∑/∏...) para o comando LaTeX. */
function naryCommand(chr: string | undefined): string {
  switch (chr) {
    case "∫":
      return "\\int";
    case "∮":
      return "\\oint";
    case "∬":
      return "\\iint";
    case "∭":
      return "\\iiint";
    case "∏":
      return "\\prod";
    case "⋃":
      return "\\bigcup";
    case "⋂":
      return "\\bigcap";
    case "⨁":
    case "⊕":
      return "\\bigoplus";
    case "⨂":
    case "⊗":
      return "\\bigotimes";
    case "⨀":
    case "⊙":
      return "\\bigodot";
    case "∑":
    default:
      return "\\sum";
  }
}

/** Mapeia o caractere de m:accPr/m:chr (sotaque) para o comando LaTeX. */
function accentCommand(chr: string | undefined): string {
  switch (chr) {
    case "¯":
      return "\\bar";
    case "⃗":
    case "→":
      return "\\vec";
    case "~":
      return "\\tilde";
    case "˙":
      return "\\dot";
    case "¨":
      return "\\ddot";
    case "⌢":
      return "\\frown";
    case "ˆ":
    default:
      return "\\hat";
  }
}

/** Funções reconhecidas pelo KaTeX sem \operatorname (upright). */
const KNOWN_FUNCS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc",
  "sinh", "cosh", "tanh", "coth",
  "arcsin", "arccos", "arctan",
  "log", "ln", "lg", "exp",
  "lim", "limsup", "liminf",
  "max", "min", "sup", "inf",
  "det", "dim", "ker", "deg", "gcd", "Pr", "mod", "arg",
]);

function convertChildren(children: Array<XmlNode | string>): string {
  let out = "";
  for (const child of children) {
    if (typeof child === "string") {
      // Colapsa quebras de linha, mas PRESERVA os espaços de m:t (o Word
      // renderiza " + " literalmente — o trim mudaria a equação).
      out += escapeLatexText(child.replace(/\s+/g, " "));
    } else {
      out += convertNode(child);
    }
  }
  return out;
}

function childOf(node: XmlNode, tag: string): XmlNode | undefined {
  return node.children.find(
    (c): c is XmlNode => typeof c !== "string" && c.tag === tag,
  );
}

function childrenOf(node: XmlNode, tag: string): XmlNode[] {
  return node.children.filter(
    (c): c is XmlNode => typeof c !== "string" && c.tag === tag,
  );
}

function attrValue(node: XmlNode | undefined, local: string): string | undefined {
  if (!node) return undefined;
  const direct = Object.entries(node.attrs).find(
    ([k]) => k.endsWith(`:${local}`) || k === local,
  );
  return direct ? direct[1] : undefined;
}

function nodeText(node: XmlNode): string {
  return convertChildren(node.children).trim();
}

function convertNode(node: XmlNode): string {
  switch (node.tag) {
    case "m:oMath":
    case "m:oMathPara":
    case "m:span":
    case "m:box":
    case "m:borderBox":
    case "m:groupChr":
      return convertChildren(node.children);

    case "m:r": {
      const t = childOf(node, "m:t") ?? childOf(node, "w:t");
      if (t) return convertChildren(t.children);
      return convertChildren(node.children);
    }
    case "m:t":
    case "w:t":
      return convertChildren(node.children);

    case "m:f": {
      const num = childOf(node, "m:num");
      const den = childOf(node, "m:den");
      const n = num ? convertChildren(num.children).trim() : "";
      const d = den ? convertChildren(den.children).trim() : "";
      return `\\frac{${n || " "}}{${d || " "}}`;
    }

    case "m:rad": {
      const e = childOf(node, "m:e");
      const deg = childOf(node, "m:deg");
      const body = e ? convertChildren(e.children).trim() : "";
      const d = deg ? convertChildren(deg.children).trim() : "";
      return d ? `\\sqrt[${d}]{${body || " "}}` : `\\sqrt{${body || " "}}`;
    }

    case "m:sSup": {
      const e = childOf(node, "m:e");
      const sup = childOf(node, "m:sup");
      const base = e ? convertChildren(e.children).trim() : "";
      const up = sup ? convertChildren(sup.children).trim() : "";
      return `{${base || " "}}^{${up || " "}}`;
    }
    case "m:sSub": {
      const e = childOf(node, "m:e");
      const sub = childOf(node, "m:sub");
      const base = e ? convertChildren(e.children).trim() : "";
      const sb = sub ? convertChildren(sub.children).trim() : "";
      return `{${base || " "}}_{${sb || " "}}`;
    }
    case "m:sSubSup": {
      const e = childOf(node, "m:e");
      const sub = childOf(node, "m:sub");
      const sup = childOf(node, "m:sup");
      const base = e ? convertChildren(e.children).trim() : "";
      const sb = sub ? convertChildren(sub.children).trim() : "";
      const up = sup ? convertChildren(sup.children).trim() : "";
      return `{${base || " "}}_{${sb || " "}}^{${up || " "}}`;
    }
    case "m:sPre": {
      const e = childOf(node, "m:e");
      const sub = childOf(node, "m:sub");
      const sup = childOf(node, "m:sup");
      const base = e ? convertChildren(e.children).trim() : "";
      const sb = sub ? convertChildren(sub.children).trim() : "";
      const up = sup ? convertChildren(sup.children).trim() : "";
      return `{${sb || " "}}^{${up || " "}}{${base || " "}}`;
    }

    case "m:nary": {
      const pr = childOf(node, "m:naryPr");
      const chrNode = pr ? childOf(pr, "m:chr") : undefined;
      const chr = attrValue(chrNode, "val") ?? (chrNode ? nodeText(chrNode) : undefined);
      const cmd = naryCommand(chr);
      const sub = childOf(node, "m:sub");
      const sup = childOf(node, "m:sup");
      const e = childOf(node, "m:e");
      const sb = sub ? convertChildren(sub.children).trim() : "";
      const up = sup ? convertChildren(sup.children).trim() : "";
      const body = e ? convertChildren(e.children).trim() : "";
      const limits = `${sb ? `_{${sb}}` : ""}${up ? `^{${up}}` : ""}`;
      return `${cmd}${limits}${body ? ` ${body}` : ""}`;
    }

    case "m:limLow": {
      const e = childOf(node, "m:e");
      const lim = childOf(node, "m:lim");
      const name = lim ? convertChildren(lim.children).trim() : "lim";
      const under = e ? convertChildren(e.children).trim() : "";
      const cmd = name === "lim" ? "\\lim" : `\\operatorname{${name}}`;
      return `${cmd}${under ? `_{${under}}` : ""}`;
    }
    case "m:limUpp": {
      const e = childOf(node, "m:e");
      const lim = childOf(node, "m:lim");
      const name = lim ? convertChildren(lim.children).trim() : "lim";
      const over = e ? convertChildren(e.children).trim() : "";
      const cmd = name === "lim" ? "\\lim" : `\\operatorname{${name}}`;
      return `${cmd}${over ? `^{${over}}` : ""}`;
    }

    case "m:d": {
      const pr = childOf(node, "m:dPr");
      const beg = pr ? childOf(pr, "m:begChr") : undefined;
      const end = pr ? childOf(pr, "m:endChr") : undefined;
      const begVal = attrValue(beg, "val") ?? (beg ? nodeText(beg) : undefined) ?? "(";
      const endVal = attrValue(end, "val") ?? (end ? nodeText(end) : undefined) ?? ")";
      const body = convertChildren(node.children).trim();
      const b = delimiterLatex(begVal);
      const en = delimiterLatex(endVal);
      if (b === null && en === null) return body;
      if (b === null) return `\\left.${body || " "}\\right${en}`;
      if (en === null) return `\\left${b}${body || " "}\\right.`;
      return `\\left${b}${body || " "}\\right${en}`;
    }

    case "m:func": {
      const fName = childOf(node, "m:fName");
      const e = childOf(node, "m:e");
      const name = fName ? convertChildren(fName.children).trim() : "";
      const arg = e ? convertChildren(e.children).trim() : "";
      if (!name) return arg;
      const cmd = KNOWN_FUNCS.has(name) ? `\\${name}` : `\\operatorname{${name}}`;
      return `${cmd}\\left(${arg || " "}\\right)`;
    }

    case "m:acc": {
      const pr = childOf(node, "m:accPr");
      const chrNode = pr ? childOf(pr, "m:chr") : undefined;
      const chr = attrValue(chrNode, "val") ?? (chrNode ? nodeText(chrNode) : undefined);
      const e = childOf(node, "m:e");
      const body = e ? convertChildren(e.children).trim() : "";
      const cmd = accentCommand(chr);
      return `${cmd}{${body || " "}}`;
    }

    case "m:bar": {
      const pr = childOf(node, "m:barPr");
      const pos = pr ? childOf(pr, "m:pos") : undefined;
      const posVal = attrValue(pos, "val") ?? (pos ? nodeText(pos) : undefined);
      const e = childOf(node, "m:e");
      const body = e ? convertChildren(e.children).trim() : "";
      return posVal === "bot"
        ? `\\underline{${body || " "}}`
        : `\\overline{${body || " "}}`;
    }

    case "m:eqArr": {
      const cells = childrenOf(node, "m:e");
      return cells
        .map((c) => convertChildren(c.children).trim())
        .filter(Boolean)
        .join("\\quad ");
    }

    // Propriedades e nós estruturais sem conteúdo visível.
    case "m:rPr":
    case "m:ctrlPr":
    case "m:naryPr":
    case "m:dPr":
    case "m:accPr":
    case "m:barPr":
    case "m:eqArrPr":
    case "m:limLowPr":
    case "m:limUppPr":
    case "m:funcPr":
    case "m:fPr":
    case "m:radPr":
    case "m:sSubPr":
    case "m:sSupPr":
    case "m:sSubSupPr":
    case "m:argPr":
    case "m:sep":
    case "m:degHide":
    case "m:begChr":
    case "m:endChr":
    case "m:chr":
    case "m:pos":
      return "";

    default:
      // Elemento desconhecido: passa o conteúdo (degradação graciosa).
      return convertChildren(node.children);
  }
}

/**
 * Converte um fragmento OMML (`<m:oMath>…</m:oMath>`) em LaTeX renderizável
 * pelo KaTeX. Retorna "" quando não há conteúdo convertível.
 */
export function ommlToLatex(ommlXml: string): string {
  try {
    const roots = parseXmlFragment(ommlXml);
    const oMath = roots.find(
      (r): r is XmlNode => typeof r !== "string" && r.tag === "m:oMath",
    );
    const target = oMath ?? (roots.find((r): r is XmlNode => typeof r !== "string"));
    if (!target) return "";
    return convertChildren(target.children).trim();
  } catch {
    return "";
  }
}
