#!/usr/bin/env python3
"""Análise física do PDF renderizado do DOCX UFLA.

Uso:
  python scripts/ufla-compliance/analyze-pdf.py <pdf> <output.json> [--render-dir <dir>] [--dpi 100]

Relata: total de páginas, páginas em branco, página física da INTRODUÇÃO,
número impresso no cabeçalho de cada página, cabeçalhos/legendas, imagens por
página e possíveis overflows da caixa de texto.
"""
import argparse
import json
import os
import re
import sys

try:
    import fitz  # PyMuPDF
except ImportError as exc:  # pragma: no cover
    sys.stderr.write(f"ERRO: PyMuPDF indisponível: {exc}\n")
    sys.exit(2)


def normalize(text: str) -> str:
    import unicodedata
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).upper().strip()


def header_zone_blocks(words_width, page_height):
    # Cabeçalho fica entre 2cm (56,7pt) e 3cm (85pt) do topo.
    top = 40.0
    bottom = 92.0
    return (top, bottom, words_width)


def page_text_with_layout(page):
    return page.get_text("words")  # x0, y0, x1, y1, word, block_no, line_no, word_no


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", help="Caminho do PDF")
    parser.add_argument("output", help="Caminho do JSON de saída")
    parser.add_argument("--render-dir", default=None, help="Diretório para PNGs renderizados")
    parser.add_argument("--dpi", type=int, default=100)
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        sys.stderr.write(f"ERRO: PDF não encontrado: {args.pdf}\n")
        return 1

    doc = fitz.open(args.pdf)
    total_pages = doc.page_count
    width_pt = doc[0].rect.width
    height_pt = doc[0].rect.height
    right_margin_pt = width_pt - 2 * 28.35  # margem direita 2cm ~ 56,7pt

    pages_out = []
    blank_pages = []
    intro_pages = []
    ref_pages = []
    summary_pages = []
    abstract_pages = []
    cover_pages = []
    overflow_pages = []
    header_numbers_seen = []

    if args.render_dir:
        os.makedirs(args.render_dir, exist_ok=True)

    for idx in range(doc.page_count):
        page = doc[idx]
        words = page_text_with_layout(page)
        full_text = page.get_text("text")
        norm_text = normalize(full_text)
        images = len(page.get_images(full=True))

        header_words = [
            w for w in words
            if w[1] >= 38 and w[1] <= 92 and w[0] > width_pt * 0.55
        ]
        header_numbers = [
            w[4] for w in header_words if re.fullmatch(r"\d{1,3}", w[4].strip())
        ]
        header_number_text = header_numbers[0] if header_numbers else ""
        has_header_number = bool(header_number_text)
        if has_header_number:
            header_numbers_seen.append((idx + 1, header_number_text))

        # palavras separadas não são reflexo do texto contínuo; use get_text para blank
        char_count = sum(len(w[4]) for w in words)
        blank = char_count == 0 and images == 0

        first_lines = [ln.strip() for ln in full_text.splitlines() if ln.strip()]
        first_line = first_lines[0] if first_lines else ""
        norm_first = normalize(first_line)

        headings_hit = []
        if norm_text.startswith("INTRODUCAO") or "INTRODUCAO" in norm_first:
            headings_hit.append("introducao")
            intro_pages.append(idx + 1)
        if "REFERENCIAS" in norm_first:
            headings_hit.append("referencias")
            ref_pages.append(idx + 1)
        if "SUMARIO" in norm_first:
            headings_hit.append("sumario")
            summary_pages.append(idx + 1)
        if norm_first in ("RESUMO",) or norm_first == "RESUMO":
            headings_hit.append("resumo")
        if "ABSTRACT" in norm_first:
            headings_hit.append("abstract")
            abstract_pages.append(idx + 1)
        if "UNIVERSIDADE FEDERAL DE LAVRAS" in norm_text and idx == 0:
            headings_hit.append("capa")
            cover_pages.append(idx + 1)

        # overflow: palavras que cruzam a margem direita (caixa de texto)
        over = [w for w in words if w[2] > right_margin_pt + 5]
        if over:
            overflow_pages.append(idx + 1)

        if blank:
            blank_pages.append(idx + 1)

        pages_out.append({
            "index": idx + 1,
            "pageNumber": idx + 1,
            "charCount": char_count,
            "blank": blank,
            "images": images,
            "hasHeaderNumber": has_header_number,
            "headerNumberText": header_number_text,
            "firstLine": first_line,
            "headingsHit": headings_hit,
        })

        if args.render_dir:
            pix = page.get_pixmap(dpi=args.dpi)
            pix.save(os.path.join(args.render_dir, f"page-{idx + 1:03d}.png"))

    doc.close()

    intro_page = intro_pages[0] if intro_pages else None
    intro_number = ""
    header_numbers_seen = list(header_numbers_seen)
    if intro_page:
        for p, num in header_numbers_seen:
            if p == intro_page:
                intro_number = num
                break

    def first_of(pages_):
        return pages_[0] if pages_ else None

    issues = []
    for bp in blank_pages:
        issues.append({
            "code": "blank-page",
            "message": f"Página em branco inesperada (física #{bp}).",
            "severity": "error",
            "rule": "UFLA estrutural",
            "item": f"página {bp}",
        })
    for op in overflow_pages:
        issues.append({
            "code": "text-overflow",
            "message": f"Possível overflow de texto na margem direita (física #{op}).",
            "severity": "warning",
            "rule": "Manual UFLA 4.2",
            "item": f"página {op}",
        })

    result = {
        "totalPages": total_pages,
        "introPhysicalPage": intro_page,
        "introPrintedNumber": intro_number or None,
        "referencesPhysicalPage": first_of(ref_pages),
        "summaryPhysicalPage": first_of(summary_pages),
        "abstractPhysicalPage": first_of(abstract_pages),
        "coverPhysicalPage": first_of(cover_pages),
        "blankPages": blank_pages,
        "overflowPages": overflow_pages,
        "hasHeaderPageNumbers": bool(header_numbers_seen),
        "pageSizePt": {"width": round(width_pt, 2), "height": round(height_pt, 2)},
        "pages": pages_out,
        "issues": issues,
    }

    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())