from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Protocol


class PdfConversionError(RuntimeError):
    """Erro controlado de conversão DOCX -> PDF."""


class DocxPdfConverter(Protocol):
    async def convert(self, docx_path: Path) -> Path:
        """Converte um DOCX em PDF e retorna o caminho do PDF gerado."""


class LocalLibreOfficeConverter:
    """Conversor local com LibreOffice headless.

    Uso recomendado para ambiente local, laboratório ou instância web de baixa
    concorrência. O lock evita duas conversões simultâneas usando o mesmo perfil
    do LibreOffice, que é uma das causas comuns de PDF corrompido, travamento ou
    falha silenciosa.
    """

    _lock = asyncio.Lock()

    def __init__(self, soffice_path: str | None = None, output_root: Path | None = None) -> None:
        self.soffice_path = soffice_path or os.getenv("SOFFICE_PATH") or "soffice"
        self.output_root = output_root or Path(os.getenv("PDF_OUTPUT_DIR", tempfile.gettempdir()))

    async def convert(self, docx_path: Path) -> Path:
        docx_path = docx_path.resolve()
        if not docx_path.exists():
            raise PdfConversionError(f"Arquivo DOCX não encontrado: {docx_path}")
        if docx_path.suffix.lower() != ".docx":
            raise PdfConversionError("A conversão para PDF exige arquivo .docx.")
        if shutil.which(self.soffice_path) is None and not Path(self.soffice_path).exists():
            raise PdfConversionError(
                "LibreOffice/soffice não encontrado. Configure SOFFICE_PATH ou instale o LibreOffice."
            )

        async with self._lock:
            return await asyncio.to_thread(self._convert_sync, docx_path)

    def _convert_sync(self, docx_path: Path) -> Path:
        work_id = uuid.uuid4().hex
        output_dir = self.output_root / f"site_abnt_pdf_{work_id}"
        profile_dir = self.output_root / f"site_abnt_lo_profile_{work_id}"
        output_dir.mkdir(parents=True, exist_ok=True)
        profile_dir.mkdir(parents=True, exist_ok=True)

        command = [
            self.soffice_path,
            "--headless",
            "--nologo",
            "--nofirststartwizard",
            f"-env:UserInstallation=file:///{profile_dir.as_posix()}",
            "--convert-to",
            "pdf:writer_pdf_Export",
            "--outdir",
            str(output_dir),
            str(docx_path),
        ]

        completed = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=int(os.getenv("PDF_CONVERSION_TIMEOUT", "90")),
            check=False,
        )

        expected_pdf = output_dir / f"{docx_path.stem}.pdf"
        if completed.returncode != 0 or not expected_pdf.exists():
            raise PdfConversionError(
                "Falha ao converter DOCX para PDF com LibreOffice. "
                f"stdout={completed.stdout.strip()} stderr={completed.stderr.strip()}"
            )

        return expected_pdf


class GotenbergConverter:
    """Conversor via Gotenberg, indicado para deploy web.

    Mantém a mesma interface do conversor local. A implementação usa httpx apenas
    quando esta classe é chamada, evitando dependência obrigatória no uso local.
    """

    def __init__(self, endpoint: str | None = None, output_root: Path | None = None) -> None:
        self.endpoint = (endpoint or os.getenv("GOTENBERG_URL") or "http://localhost:3000").rstrip("/")
        self.output_root = output_root or Path(os.getenv("PDF_OUTPUT_DIR", tempfile.gettempdir()))

    async def convert(self, docx_path: Path) -> Path:
        try:
            import httpx
        except ImportError as exc:
            raise PdfConversionError("Instale httpx para usar o conversor Gotenberg.") from exc

        docx_path = docx_path.resolve()
        if not docx_path.exists():
            raise PdfConversionError(f"Arquivo DOCX não encontrado: {docx_path}")

        output_pdf = self.output_root / f"{docx_path.stem}-{uuid.uuid4().hex}.pdf"
        url = f"{self.endpoint}/forms/libreoffice/convert"

        async with httpx.AsyncClient(timeout=int(os.getenv("PDF_CONVERSION_TIMEOUT", "90"))) as client:
            with docx_path.open("rb") as file_handle:
                response = await client.post(url, files={"files": (docx_path.name, file_handle)})

        if response.status_code >= 400:
            raise PdfConversionError(f"Gotenberg falhou com HTTP {response.status_code}: {response.text[:500]}")

        output_pdf.write_bytes(response.content)
        return output_pdf


def get_docx_pdf_converter() -> DocxPdfConverter:
    backend = os.getenv("PDF_CONVERTER", "local").strip().lower()
    if backend == "gotenberg":
        return GotenbergConverter()
    return LocalLibreOfficeConverter()
