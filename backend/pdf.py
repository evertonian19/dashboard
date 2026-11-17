"""PDF conversion of documents with LibreOffice (headless), when it is installed."""
import glob
import os
import shutil
import subprocess
import tempfile
import threading
from urllib.parse import quote

from backend.config import DATA, ROOT


# PDF conversion uses LibreOffice in headless mode, if it is installed.
SOFFICE = (os.environ.get("SOFFICE") or shutil.which("soffice") or shutil.which("libreoffice")
           or next(iter(sorted(glob.glob(os.path.expanduser("~/opt/libreoffice/opt/*/program/soffice")))), None))
PDF_SOURCES = [".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".rtf", ".odt", ".odp", ".ods",
               ".txt", ".md", ".csv"]
PDF_TIMEOUT = 180
_pdf_lock = threading.Lock()


def convert_to_pdf(source, ext, target):
    """Convert one document to PDF with LibreOffice. Raises RuntimeError with a
    message for the user when it cannot be done."""
    if not SOFFICE:
        raise RuntimeError("PDF 변환 프로그램(LibreOffice)이 서버에 설치되어 있지 않아요")
    env = dict(os.environ)
    libs = os.path.expanduser("~/opt/lo-libs/usr/lib/x86_64-linux-gnu")   # extra libraries for a home-directory install
    if os.path.isdir(libs):
        env["LD_LIBRARY_PATH"] = libs + os.pathsep + env.get("LD_LIBRARY_PATH", "")
    fonts = os.path.join(ROOT, "fonts.conf")
    if os.path.isfile(fonts):
        env["FONTCONFIG_FILE"] = fonts
    with _pdf_lock, tempfile.TemporaryDirectory(dir=DATA) as tmp:   # one conversion at a time
        work = os.path.join(tmp, "source" + ext)
        shutil.copyfile(source, work)
        try:
            subprocess.run(
                [SOFFICE, "--headless", "--norestore",
                 "-env:UserInstallation=file://" + quote(os.path.join(DATA, "lo-profile")),
                 "--convert-to", "pdf", "--outdir", tmp, work],
                capture_output=True, timeout=PDF_TIMEOUT, env=env, cwd=tmp)
        except subprocess.TimeoutExpired:
            raise RuntimeError("변환이 너무 오래 걸려서 중단했어요") from None
        made = os.path.join(tmp, "source.pdf")
        if not os.path.isfile(made) or not os.path.getsize(made):
            raise RuntimeError("이 파일은 PDF로 변환하지 못했어요")
        os.replace(made, target)
