"""Upload file-name cleaning."""
import re


def clean_name(raw):
    """Keep only the file name, drop control characters, cap the length."""
    name = re.sub(r"[\x00-\x1f\x7f]", "", raw.replace("\\", "/").split("/")[-1]).strip()
    return name[:200]
