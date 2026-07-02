from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.app.services.docx_pdf_converter import PdfConversionError, get_docx_pdf_converter

router = APIRouter(prefix="/pdf", tags=["pdf"])


def cleanup_directory(path: Path) -> None:
    shutil.rmtree(path, ignore_errors=True)


@router.post("/convert-docx", response_class=FileResponse)
async def convert_docx_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> FileResponse:
    """Converte DOCX para PDF usando motor de documento real.

    Esta rota não usa o PDF manual do navegador. O DOCX permanece como saída
    canônica; o PDF final é derivado dele por LibreOffice local ou Gotenberg.
    """

    filename = file.filename or "documento.docx"
    if not filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .docx.")

    temp_dir = Path(tempfile.mkdtemp(prefix="site_abnt_upload_"))
    background_tasks.add_task(cleanup_directory, temp_dir)
    docx_path = temp_dir / "entrada.docx"

    with docx_path.open("wb") as output:
        shutil.copyfileobj(file.file, output)

    try:
        pdf_path = await get_docx_pdf_converter().convert(docx_path)
    except PdfConversionError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    final_pdf = temp_dir / f"{Path(filename).stem}.pdf"
    shutil.copyfile(pdf_path, final_pdf)

    return FileResponse(
        final_pdf,
        media_type="application/pdf",
        filename=final_pdf.name,
        background=background_tasks,
    )
