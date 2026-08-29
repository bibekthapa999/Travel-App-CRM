import bleach

ALLOWED_TAGS = ["p", "strong", "em", "b", "i", "u", "ul", "ol", "li", "br", "a", "span"]
ALLOWED_ATTRS = {"a": ["href"]}
ALLOWED_PROTOCOLS = ["https", "mailto", "tel"]


def sanitize_html(html: str) -> str:
    return bleach.clean(html or "", tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, protocols=ALLOWED_PROTOCOLS, strip=True)
