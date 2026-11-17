"""Board posts: HTML allowlist sanitiser and size limits."""
import html
import re
from html.parser import HTMLParser


# ---------------------------------------------------------------------------
# Board (Menu 3)
#
# Post bodies are HTML written in the browser's editor. Everything is rebuilt
# here from an allowlist, so a stored post can never carry scripts, event
# handlers, links, images or arbitrary CSS. Comments are plain text.
MAX_JSON = 1024 * 1024
MAX_TITLE = 200
MAX_BODY = 200_000
MAX_COMMENT = 2000
MAX_CATEGORY = 30
POST_TAGS = {"b", "strong", "i", "em", "u", "s", "strike", "span", "font", "p", "div",
             "br", "h2", "h3", "ul", "ol", "li", "blockquote"}
POST_STYLES = {"color", "background-color", "font-size", "font-weight", "font-style",
               "text-decoration", "text-decoration-line", "text-align"}
STYLE_VALUE = re.compile(r"[\w#(),.%\s-]{1,60}")
POST_IMG = re.compile(r"/api/files/[0-9a-f]{12}/raw")
POST_LINK = re.compile(r"(?:https?://|mailto:)[^\s\"<>]{1,2000}|/api/files/[0-9a-f]{12}/raw\?download")
FONT_ATTRS = {"color": re.compile(r"#[0-9a-fA-F]{3,8}|[a-zA-Z]{1,20}"), "size": re.compile(r"[1-7]")}


class PostSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.text, self.stack, self.skip = [], [], [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
            return
        if self.skip:
            return
        if tag == "img":   # only files uploaded to this dashboard
            src = dict(attrs).get("src") or ""
            if POST_IMG.fullmatch(src):
                self.out.append(f'<img src="{src}" alt="">')
            return
        if tag == "a":
            href = dict(attrs).get("href") or ""
            if POST_LINK.fullmatch(href):
                self.out.append(f'<a href="{html.escape(href)}" target="_blank" rel="noopener noreferrer">')
                self.stack.append("a")
            return
        if tag not in POST_TAGS:
            return
        if tag == "br":
            self.out.append("<br>")
            self.text.append("\n")
            return
        kept = []
        for name, value in attrs:
            value = value or ""
            if name == "style":
                rules = []
                for rule in value.split(";"):
                    prop, _, val = rule.partition(":")
                    prop, val = prop.strip().lower(), val.strip()
                    if prop in POST_STYLES and STYLE_VALUE.fullmatch(val) and "url" not in val.lower():
                        rules.append(f"{prop}: {val}")
                if rules:
                    kept.append(("style", "; ".join(rules)))
            elif tag == "font" and name in FONT_ATTRS and FONT_ATTRS[name].fullmatch(value):
                kept.append((name, value))
        self.out.append("<" + tag + "".join(f' {k}="{html.escape(v)}"' for k, v in kept) + ">")
        self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
            return
        if tag not in self.stack:
            return
        while self.stack:
            top = self.stack.pop()
            self.out.append(f"</{top}>")
            if top not in ("b", "strong", "i", "em", "u", "s", "strike", "span", "font", "a"):
                self.text.append("\n")
            if top == tag:
                break

    def handle_data(self, data):
        if not self.skip:
            self.out.append(html.escape(data, quote=False))
            self.text.append(data)

    def result(self):
        self.close()
        while self.stack:
            self.out.append(f"</{self.stack.pop()}>")
        text = re.sub(r"[ \t\xa0]+", " ", "".join(self.text))
        text = re.sub(r"\s*\n\s*", "\n", text).strip()
        return "".join(self.out), text


def sanitize_post(raw):
    parser = PostSanitizer()
    parser.feed(raw)
    return parser.result()
