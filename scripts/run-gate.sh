#!/bin/bash
# Script de execuÃ§Ã£o do FULL COMPLIANCE GATE
# Uso: ./run-gate.sh [docx] [pdf]

DOCX="${1:-artifacts/ufla-compliance/normalized-dissertacao.docx}"
PDF="${2:-artifacts/ufla-compliance/dissertacao-rendered.pdf}"

echo "=== FULL COMPLIANCE GATE ==="
echo "DOCX: $DOCX"
echo "PDF: $PDF"
echo ""

ts-node scripts/ufla-compliance/gate.ts "$DOCX" "$PDF"
