import fitz
import json
import sys
from pathlib import Path
from datetime import datetime

rendered_dir = Path(r"artifacts\ufla-compliance\rendered\fixtures")
output_path = Path(r"artifacts\ufla-compliance\fixtures-physical-analysis.json")

MARGIN_THRESHOLD = 2.0

results = {}

for pdf_path in sorted(rendered_dir.glob("*.pdf")):
    doc = fitz.open(pdf_path)
    pages_count = doc.page_count
    first_page = doc[0]
    rect = first_page.rect
    page_width = rect.width
    page_height = rect.height

    all_elements = []
    overlaps = 0
    cutoffs = 0
    footnotes_found = 0
    sources_found = 0
    blank_pages = 0

    for i in range(pages_count):
        page = doc[i]
        blocks = page.get_text("dict")["blocks"]
        page_elements = []

        for block in blocks:
            if block["type"] != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span["text"].strip()
                    if not text:
                        continue
                    bbox = span["bbox"]
                    x0, y0, x1, y1 = bbox
                    elem = {
                        "text": text,
                        "bbox": {"x0": x0, "y0": y0, "x1": x1, "y1": y1},
                        "font": span.get("font", ""),
                        "size": span.get("size", 0),
                        "kind": "text"
                    }

                    lower = text.lower()
                    if lower.startswith(("fonte:", "fonte.")) and y0 > page_height * 0.85:
                        elem["kind"] = "table-source"
                        sources_found += 1
                    elif lower.startswith(("figura", "quadro", "gráfico", "mapa", "ilustração")) and y0 > page_height * 0.85:
                        elem["kind"] = "figure-source"
                        sources_found += 1
                    elif "nota" in lower and y0 > page_height * 0.85:
                        elem["kind"] = "footnote"
                        footnotes_found += 1
                    elif y0 < page_height * 0.15:
                        elem["kind"] = "header"
                    elif y0 > page_height * 0.85:
                        elem["kind"] = "footer"

                    page_elements.append(elem)

        for j in range(len(page_elements)):
            for k in range(j + 1, len(page_elements)):
                e1 = page_elements[j]
                e2 = page_elements[k]
                if e1["kind"] != "text" or e2["kind"] != "text":
                    continue
                bbox1 = e1["bbox"]
                bbox2 = e2["bbox"]
                same_line = abs(bbox1["y0"] - bbox2["y0"]) < 1.0 and abs(bbox1["y1"] - bbox2["y1"]) < 1.0
                if not same_line:
                    continue
                overlap_x = max(0, min(bbox1["x1"], bbox2["x1"]) - max(bbox1["x0"], bbox2["x0"]))
                min_width = min(bbox1["x1"] - bbox1["x0"], bbox2["x1"] - bbox2["x0"])
                if min_width <= 0:
                    continue
                ratio = overlap_x / min_width
                if ratio >= 0.35:
                    overlaps += 1

        if not page_elements and i > 0:
            blank_pages += 1

        all_elements.extend(page_elements)

    doc.close()

    results[pdf_path.name] = {
        "pages": pages_count,
        "pageWidth": page_width,
        "pageHeight": page_height,
        "elements": len(all_elements),
        "overlaps": overlaps,
        "cutoffs": cutoffs,
        "blankPages": blank_pages,
        "footnotesFound": footnotes_found,
        "sourcesFound": sources_found,
        "status": "passed" if overlaps == 0 and cutoffs == 0 and blank_pages == 0 else "failed"
    }

output_path.parent.mkdir(parents=True, exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump({
        "generatedAt": datetime.now().isoformat() + "Z",
        "fixtures": results
    }, f, indent=2, ensure_ascii=False)

print(json.dumps(results, indent=2, ensure_ascii=False))
