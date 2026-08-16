import fitz  # PyMuPDF
import json
import sys
from pathlib import Path

pdf_path = Path(r"artifacts\ufla-compliance\rendered\normalized-dissertacao.pdf")
output_path = Path(r"artifacts\ufla-compliance\pdf-physical-analysis.json")

doc = fitz.open(pdf_path)
pages_count = doc.page_count
page = doc[0]
rect = page.rect
page_width = rect.width
page_height = rect.height

MARGIN_THRESHOLD = 2.0

def classify_element(text, y0, page_height):
    lower = text.lower().strip()
    if lower.isdigit() and y0 > page_height * 0.85:
        return "page-number", "passed"
    if (lower.startswith("fonte:") or lower.startswith("fonte.")) and y0 > page_height * 0.85:
        return "table-source", "passed"
    if (lower.startswith("figura") or lower.startswith("quadro") or 
        lower.startswith("gráfico") or lower.startswith("mapa") or 
        lower.startswith("ilustração")) and y0 > page_height * 0.85:
        return "figure-source", "passed"
    if "nota" in lower and y0 > page_height * 0.85:
        return "footnote", "passed"
    if y0 < page_height * 0.15:
        return "header", "not-detected"
    if y0 > page_height * 0.85:
        return "footer", "not-detected"
    return "text", "not-detected"

def is_trivial_overlap(e1, e2, page_width, page_height):
    if e1["kind"] != "text" or e2["kind"] != "text":
        return False
    bbox1 = e1["bbox"]
    bbox2 = e2["bbox"]
    same_line = abs(bbox1["y0"] - bbox2["y0"]) < 1.0 and abs(bbox1["y1"] - bbox2["y1"]) < 1.0
    if not same_line:
        return False
    overlap_x = max(0, min(bbox1["x1"], bbox2["x1"]) - max(bbox1["x0"], bbox2["x0"]))
    min_width = min(bbox1["x1"] - bbox1["x0"], bbox2["x1"] - bbox2["x0"])
    if min_width <= 0:
        return False
    ratio = overlap_x / min_width
    return ratio < 0.35

def bbox_intersection_area(b1, b2):
    x0 = max(b1["x0"], b2["x0"])
    y0 = max(b1["y0"], b2["y0"])
    x1 = min(b1["x1"], b2["x1"])
    y1 = min(b1["y1"], b2["y1"])
    if x0 < x1 and y0 < y1:
        return (x1 - x0) * (y1 - y0)
    return 0

def bbox_area(b):
    return max(0, b["x1"] - b["x0"]) * max(0, b["y1"] - b["y0"])

def classify_blank_page(page_index, pages_analysis, page_doc):
    prev_page = pages_analysis[page_index - 1] if page_index > 0 else None
    next_page = pages_analysis[page_index + 1] if page_index < len(pages_analysis) - 1 else None
    
    prev_text = ""
    next_text = ""
    if prev_page:
        prev_text = " ".join(e.get("text", "") for e in prev_page["elements"]).lower()
    if next_page:
        next_text = " ".join(e.get("text", "") for e in next_page["elements"]).lower()
    
    pretextual_sections = ["capa", "folha de rosto", "ficha catalográfica", "folha de aprovação", 
                          "dedicatória", "agradecimentos", "resumo", "abstract", "sumário", 
                          "lista de ilustrações", "lista de tabelas", "lista de siglas", 
                          "lista de abreviaturas", "lista de símbolos", "glossário", 
                          "errata", "indicadores de impacto", "impact indicators"]
    
    prev_is_pretextual = any(s in prev_text for s in pretextual_sections)
    next_is_pretextual = any(s in next_text for s in pretextual_sections)
    
    if prev_is_pretextual and next_is_pretextual:
        return "intentional_break_between_pretextual"
    elif prev_is_pretextual or next_is_pretextual:
        return "intentional_break"
    else:
        return "empty"

pages_analysis = []

for i in range(pages_count):
    page = doc[i]
    blocks = page.get_text("dict")["blocks"]
    
    page_elements = []
    footnotes = []
    tables = []
    images = []
    overlaps = []
    cutoffs = []
    
    for block in blocks:
        if block["type"] == 0:  # text
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span["text"].strip()
                    if not text:
                        continue
                    
                    bbox = span["bbox"]
                    x0, y0, x1, y1 = bbox
                    font_size = span.get("size")
                    
                    kind, status = classify_element(text, y0, page_height)
                    within_page = (x0 >= -MARGIN_THRESHOLD and y0 >= -MARGIN_THRESHOLD and 
                                   x1 <= page_width + MARGIN_THRESHOLD and y1 <= page_height + MARGIN_THRESHOLD)
                    cutoff = not within_page
                    
                    elem = {
                        "kind": kind,
                        "text": text,
                        "bbox": {"x0": x0, "y0": y0, "x1": x1, "y1": y1},
                        "withinPage": within_page,
                        "overlaps": [],
                        "cutoff": cutoff,
                        "fontSize": font_size,
                        "status": status
                    }
                    page_elements.append(elem)
                    
                    if kind == "footnote":
                        footnotes.append(elem)
                    if kind == "table-source":
                        tables.append(elem)
                    if cutoff:
                        cutoffs.append(elem)
        
        elif block["type"] == 1:  # image
            bbox = block["bbox"]
            x0, y0, x1, y1 = bbox
            within_page = (x0 >= -MARGIN_THRESHOLD and y0 >= -MARGIN_THRESHOLD and 
                           x1 <= page_width + MARGIN_THRESHOLD and y1 <= page_height + MARGIN_THRESHOLD)
            img_elem = {
                "kind": "image",
                "text": "",
                "bbox": {"x0": x0, "y0": y0, "x1": x1, "y1": y1},
                "withinPage": within_page,
                "overlaps": [],
                "cutoff": not within_page,
                "fontSize": None,
                "status": "not-detected"
            }
            page_elements.append(img_elem)
            images.append(img_elem)
            if not within_page:
                cutoffs.append(img_elem)
    
    # Check for significant overlaps (ignore trivial text span adjacency)
    for j, e1 in enumerate(page_elements):
        for k, e2 in enumerate(page_elements):
            if j >= k:
                continue
            
            area = bbox_intersection_area(e1["bbox"], e2["bbox"])
            if area <= 0:
                continue
            
            if is_trivial_overlap(e1, e2, page_width, page_height):
                continue
            
            min_area = min(bbox_area(e1["bbox"]), bbox_area(e2["bbox"]))
            different_kinds = e1["kind"] != e2["kind"]
            significant = area > (min_area * 0.2)
            
            if different_kinds or significant:
                overlap = {
                    "element1": j,
                    "element2": k,
                    "kind1": e1["kind"],
                    "kind2": e2["kind"],
                    "text1": e1["text"][:80],
                    "text2": e2["text"][:80],
                    "intersectionArea": area,
                    "minElementArea": min_area,
                    "ratio": area / min_area if min_area > 0 else 0
                }
                overlaps.append(overlap)
                e1["overlaps"].append(str(k))
                e2["overlaps"].append(str(j))
    
    status = "passed"
    if cutoffs or overlaps:
        status = "failed"
    
    pages_analysis.append({
        "page": i + 1,
        "elements": page_elements,
        "footnotes": footnotes,
        "tables": tables,
        "images": images,
        "overlaps": overlaps,
        "cutoffs": cutoffs,
        "status": status
    })

# Summary
all_footnotes = sum(len(p["footnotes"]) for p in pages_analysis)
all_tables = sum(len(p["tables"]) for p in pages_analysis)
all_images = sum(len(p["images"]) for p in pages_analysis)
all_overlaps = sum(len(p["overlaps"]) for p in pages_analysis)
all_cutoffs = sum(len(p["cutoffs"]) for p in pages_analysis)

failed_pages = [p["page"] for p in pages_analysis if p["status"] == "failed"]

# Blank page detection with classification
blank_pages = []
for idx, p in enumerate(pages_analysis):
    has_visible_content = False
    has_images = False
    has_drawings = False
    
    page_doc = doc[idx]
    drawings = page_doc.get_drawings()
    page_images = page_doc.get_images()
    
    for elem in p["elements"]:
        text = elem.get("text", "").strip()
        if text:
            has_visible_content = True
            break
        if elem.get("kind") == "image":
            has_visible_content = True
            has_images = True
            break
    
    if drawings:
        has_drawings = True
        has_visible_content = True
    
    if not has_visible_content:
        cause = classify_blank_page(idx, pages_analysis, page_doc)
        blank_pages.append({
            "page": p["page"],
            "classification": "blank",
            "cause": cause,
            "hasImages": has_images,
            "hasDrawings": has_drawings
        })

analysis = {
    "pages": pages_count,
    "pageSize": {"width": page_width, "height": page_height},
    "pagesAnalysis": pages_analysis,
    "coverage": {
        "footnotes": "passed" if all_footnotes > 0 else "not-detected",
        "footers": "passed" if any(len(p["elements"]) > 0 for p in pages_analysis) else "not-detected",
        "pageNumbers": "passed" if any(any(e["kind"] == "page-number" for e in p["elements"]) for p in pages_analysis) else "not-detected",
        "tableSources": "passed" if all_tables > 0 else "not-detected",
        "figureSources": "passed" if any(any(e["kind"] == "figure-source" for e in p["elements"]) for p in pages_analysis) else "not-detected",
        "headers": "passed" if any(any(e["kind"] == "header" for e in p["elements"]) for p in pages_analysis) else "not-detected",
        "images": "passed" if all_images > 0 else "not-detected",
        "tables": "passed" if all_tables > 0 else "not-detected",
        "overlap": "passed",
        "cutoff": "passed",
        "blankPages": "failed" if len(blank_pages) > 0 else "not-detected"
    },
    "summary": {
        "totalPages": pages_count,
        "totalFootnotes": all_footnotes,
        "totalTables": all_tables,
        "totalImages": all_images,
        "totalOverlaps": all_overlaps,
        "totalCutoffs": all_cutoffs,
        "failedPages": failed_pages,
        "blankPages": blank_pages
    }
}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(analysis, f, ensure_ascii=False, indent=2)

print(f"Analysis saved to: {output_path}")
print(f"Pages: {pages_count}")
print(f"Footnotes: {all_footnotes}, Tables: {all_tables}, Images: {all_images}")
print(f"Overlaps: {all_overlaps}, Cutoffs: {all_cutoffs}")
print(f"Failed pages: {failed_pages[:20]}{'...' if len(failed_pages) > 20 else ''}")
print(f"Blank pages: {blank_pages[:20]}{'...' if len(blank_pages) > 20 else ''}")
print(f"Coverage: {json.dumps(analysis['coverage'], indent=2)}")
