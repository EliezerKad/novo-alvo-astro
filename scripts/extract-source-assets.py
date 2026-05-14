#!/usr/bin/env python3
import json
import os
import re
import sys
import asyncio
from html import unescape
from urllib.parse import urljoin
from urllib.request import Request, urlopen


BLOCKED_IMAGE_RE = re.compile(
    r"(logo|avatar|icon|sprite|profile|pixel|tracking|blank|placeholder|favicon|author|badge|watermark)",
    re.I,
)
GOOGLE_BRANDING_RE = re.compile(
    r"(google(?:logo|news)|google\.com/images/branding|gstatic\.com/images/branding|/logos/|/branding/)",
    re.I,
)
IMAGE_EXT_RE = re.compile(r"\.(?:jpe?g|png|webp)(?:[?#].*)?$", re.I)
USER_AGENT = "PortalNovoAlvoAssetScout/1.0"
CRAWL4AI_FIRST = os.environ.get("CRAWL4AI_FIRST") == "1"
CAMOUFOX_ENABLED = os.environ.get("CAMOUFOX_ENABLED", "1") != "0"
CAMOUFOX_SOURCE_LIMIT = max(0, int(os.environ.get("CAMOUFOX_SOURCE_LIMIT", "2")))
CAMOUFOX_NAV_TIMEOUT_MS = max(3000, int(os.environ.get("CAMOUFOX_NAV_TIMEOUT_MS", "7000")))
CAMOUFOX_IDLE_TIMEOUT_MS = max(500, int(os.environ.get("CAMOUFOX_IDLE_TIMEOUT_MS", "1500")))
CAMOUFOX_SETTLE_MS = max(0, int(os.environ.get("CAMOUFOX_SETTLE_MS", "250")))


def clean(value, limit=2000):
    return str(value or "").replace("\x00", "").strip()[:limit]


def attr(tag, name):
    match = re.search(rf"""\s{name}\s*=\s*["']([^"']+)["']""", tag or "", re.I)
    return unescape(match.group(1).strip()) if match else ""


def strip_html(value, limit=3200):
    text = re.sub(r"<script[\s\S]*?</script>", " ", str(value or ""), flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return clean(unescape(re.sub(r"\s+", " ", text)), limit)


def usable_image(url):
    url = clean(url, 2000)
    if not url.startswith("https://"):
        return False
    lowered = url.lower()
    if BLOCKED_IMAGE_RE.search(lowered):
        return False
    if GOOGLE_BRANDING_RE.search(lowered):
        return False
    if re.search(r"\.(?:svg|gif|ico)(?:[?#]|$)", lowered):
        return False
    if "news.google." in lowered:
        return False
    return True


def unique_images(images, limit=12):
    seen = set()
    output = []
    for image in images:
        url = clean(image.get("url"), 2000)
        key = re.sub(r"[?#].*$", "", url.lower())
        if not url or key in seen or not usable_image(url):
            continue
        seen.add(key)
        output.append({**image, "url": url})
        if len(output) >= limit:
            break
    return output


def images_from_html(html, base_url, source):
    output = []

    def push(url, kind, tag=""):
        absolute = urljoin(base_url, unescape(clean(url, 2000)))
        if not usable_image(absolute):
            return
        output.append(
            {
                "url": absolute,
                "kind": kind,
                "alt": clean(attr(tag, "alt"), 220),
                "credit": "",
                "sourceTitle": clean(source.get("title"), 240),
                "sourcePublisher": clean(source.get("publisher"), 120),
                "sourceUrl": base_url,
                "category": clean(source.get("category"), 80),
            }
        )

    for tag in re.findall(r"<meta\b[^>]*>", html, re.I):
        name = f"{attr(tag, 'property')} {attr(tag, 'name')}".lower()
        if re.search(r"(^|\s)(og:image|twitter:image|twitter:image:src)(\s|$)", name):
            push(attr(tag, "content"), "meta", tag)

    for match in re.finditer(r"<script\b[^>]*type=['\"]application/ld\+json['\"][^>]*>([\s\S]*?)</script>", html, re.I):
        for url in re.findall(r"https?:\\?/\\?/[^\"',}\]\s]+", match.group(1)):
            push(url.replace("\\/", "/"), "jsonld")
        for key in ("contentUrl", "thumbnailUrl", "url"):
            for url in re.findall(rf'"{key}"\s*:\s*"([^"]+)"', match.group(1), re.I):
                push(url.replace("\\/", "/"), f"jsonld:{key}")

    for tag in re.findall(r"<(?:figure|picture|img|source)\b[^>]*>", html, re.I):
        if BLOCKED_IMAGE_RE.search(tag):
            continue
        push(
            attr(tag, "src")
            or attr(tag, "data-src")
            or attr(tag, "data-original")
            or attr(tag, "data-lazy-src")
            or attr(tag, "data-image")
            or attr(tag, "data-url"),
            "dom",
            tag,
        )
        srcset = attr(tag, "srcset") or attr(tag, "data-srcset") or attr(tag, "data-lazy-srcset")
        if srcset:
            urls = [part.strip().split()[0] for part in srcset.split(",") if part.strip()]
            if urls:
                push(urls[-1], "srcset", tag)

    return unique_images(output)


def excerpt_from_html(html):
    blocks = []
    for match in re.finditer(r"<(?:article|main)\b[^>]*>([\s\S]*?)</(?:article|main)>", html or "", re.I):
        blocks.append(strip_html(match.group(1), 3200))
    paragraph_text = " ".join(
        strip_html(match.group(1), 700)
        for match in re.finditer(r"<p\b[^>]*>([\s\S]*?)</p>", html or "", re.I)
        if len(strip_html(match.group(1), 700)) > 50
    )
    if paragraph_text:
        blocks.append(clean(paragraph_text, 3200))
    if not blocks:
        blocks.append(strip_html(html, 3200))
    return sorted(blocks, key=len, reverse=True)[0] if blocks else ""


def fetch_stdlib(url):
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6",
        },
    )
    with urlopen(request, timeout=10) as response:
        content_type = response.headers.get("content-type", "")
        if "html" not in content_type and "xhtml" not in content_type:
            return response.url, ""
        raw = response.read(2_000_000)
        charset_match = re.search(r"charset=([^;\s]+)", content_type, re.I)
        charset = charset_match.group(1) if charset_match else "utf-8"
        return response.url, raw.decode(charset, errors="replace")


def fetch_with_scrapling(url):
    try:
        from scrapling.fetchers import Fetcher

        page = Fetcher.get(url, headers={"User-Agent": USER_AGENT}, timeout=10000)
        return str(getattr(page, "url", url) or url), str(page.html if hasattr(page, "html") else page)
    except Exception:
        return fetch_stdlib(url)


def fetch_with_camoufox(url):
    from camoufox.sync_api import Camoufox

    images = []
    with Camoufox(headless=True, locale="pt-BR", window=(1366, 900)) as browser:
        page = browser.new_page()
        page.set_extra_http_headers({"Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6"})
        page.set_default_timeout(CAMOUFOX_NAV_TIMEOUT_MS)
        page.goto(url, wait_until="domcontentloaded", timeout=CAMOUFOX_NAV_TIMEOUT_MS)
        try:
            page.wait_for_load_state("networkidle", timeout=CAMOUFOX_IDLE_TIMEOUT_MS)
        except Exception:
            pass
        try:
            page.wait_for_timeout(CAMOUFOX_SETTLE_MS)
        except Exception:
            pass
        final_url = clean(page.url or url, 2000)
        images = page.evaluate(
            """() => Array.from(document.images).map((img) => {
              const figure = img.closest('figure');
              const container = figure || img.closest('article, main, section, div');
              const caption = figure?.querySelector('figcaption')?.innerText
                || container?.querySelector?.('[class*="caption" i], [class*="legenda" i], [class*="credit" i], [class*="credito" i]')?.innerText
                || '';
              const rect = img.getBoundingClientRect();
              return {
                url: img.currentSrc || img.src || img.getAttribute('data-src') || '',
                alt: img.alt || img.getAttribute('aria-label') || '',
                caption,
                width: img.naturalWidth || Math.round(rect.width) || 0,
                height: img.naturalHeight || Math.round(rect.height) || 0
              };
            })"""
        )
        html = page.content()

    normalized = []
    for item in images or []:
        if not isinstance(item, dict):
            continue
        absolute = urljoin(final_url, unescape(clean(item.get("url"), 2000)))
        width = int(item.get("width") or 0)
        height = int(item.get("height") or 0)
        if not usable_image(absolute) or width < 280 or height < 160:
            continue
        caption = clean(item.get("caption"), 260)
        normalized.append(
            {
                "url": absolute,
                "kind": "camoufox",
                "alt": clean(item.get("alt"), 220),
                "credit": caption if re.search(r"(foto|cr[eé]dito|imagem|reprodu[cç][aã]o|divulga[cç][aã]o)", caption, re.I) else "",
                "caption": caption,
                "sourceUrl": final_url,
            }
        )
    return final_url, html, unique_images(normalized, 10), excerpt_from_html(html)


async def fetch_with_crawl4ai_async(url):
    from crawl4ai import AsyncWebCrawler

    try:
        from crawl4ai import BrowserConfig, CrawlerRunConfig

        browser_config = BrowserConfig(headless=True, verbose=False)
        run_config = CrawlerRunConfig(word_count_threshold=20, excluded_tags=["script", "style", "nav", "footer"])
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(url=url, config=run_config)
    except TypeError:
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=url)

    final_url = clean(getattr(result, "url", "") or url, 2000)
    html = str(getattr(result, "cleaned_html", "") or getattr(result, "html", "") or "")
    markdown = str(getattr(result, "markdown", "") or "")
    media = getattr(result, "media", {}) or {}
    images = []
    raw_images = media.get("images") if isinstance(media, dict) else []
    for item in raw_images or []:
        if not isinstance(item, dict):
            continue
        candidate_url = item.get("src") or item.get("url") or item.get("data-src")
        absolute = urljoin(final_url, unescape(clean(candidate_url, 2000)))
        if not usable_image(absolute):
            continue
        images.append(
            {
                "url": absolute,
                "kind": "crawl4ai",
                "alt": clean(item.get("alt") or item.get("desc") or item.get("title"), 220),
                "credit": "",
                "sourceUrl": final_url,
            }
        )
    excerpt = strip_html(markdown, 3200) or excerpt_from_html(html)
    return final_url, html, images, excerpt


def fetch_with_crawl4ai(url):
    return asyncio.run(fetch_with_crawl4ai_async(url))


def is_google_url(url):
    return bool(re.search(r"https?://([^/]+\.)?(news\.google|google|gstatic|googleusercontent)\.", clean(url), re.I))


def first_external_url(html):
    for match in re.finditer(r"https?:\/\/[^\"'\s<>]+", html or "", re.I):
        candidate = unescape(match.group(0)).replace("\\/", "/")
        if not is_google_url(candidate):
            return candidate
    return ""


def extract_one(source, use_camoufox=True):
    source_url = clean(source.get("url"), 2000)
    if not source_url:
        return {**source, "resolvedUrl": "", "images": []}
    try:
        crawl_images = []
        excerpt = ""
        if CAMOUFOX_ENABLED and use_camoufox:
            try:
                final_url, html, crawl_images, excerpt = fetch_with_camoufox(source_url)
            except Exception:
                if CRAWL4AI_FIRST:
                    try:
                        final_url, html, crawl_images, excerpt = fetch_with_crawl4ai(source_url)
                    except Exception:
                        final_url, html = fetch_with_scrapling(source_url)
                else:
                    final_url, html = fetch_with_scrapling(source_url)
        elif CRAWL4AI_FIRST:
            try:
                final_url, html, crawl_images, excerpt = fetch_with_crawl4ai(source_url)
            except Exception:
                final_url, html = fetch_with_scrapling(source_url)
        else:
            final_url, html = fetch_with_scrapling(source_url)
        if is_google_url(final_url):
            external = first_external_url(html)
            if external:
                if CAMOUFOX_ENABLED and use_camoufox:
                    try:
                        final_url, html, crawl_images, excerpt = fetch_with_camoufox(external)
                    except Exception:
                        if CRAWL4AI_FIRST:
                            try:
                                final_url, html, crawl_images, excerpt = fetch_with_crawl4ai(external)
                            except Exception:
                                final_url, html = fetch_with_scrapling(external)
                        else:
                            final_url, html = fetch_with_scrapling(external)
                elif CRAWL4AI_FIRST:
                    try:
                        final_url, html, crawl_images, excerpt = fetch_with_crawl4ai(external)
                    except Exception:
                        final_url, html = fetch_with_scrapling(external)
                else:
                    final_url, html = fetch_with_scrapling(external)
        images = unique_images([*crawl_images, *images_from_html(html, final_url, source)])
        return {**source, "resolvedUrl": final_url, "images": images, "excerpt": excerpt or excerpt_from_html(html)}
    except Exception as error:
        return {**source, "resolvedUrl": source_url, "images": [], "error": str(error)[:180]}


def main():
    payload = json.loads(sys.stdin.read() or "{}")
    sources = payload.get("sources") or []
    category = clean(payload.get("category"), 80)
    normalized = [{**source, "category": clean(source.get("category") or category, 80)} for source in sources if isinstance(source, dict)]
    json.dump(
        {"sources": [extract_one(source, index < CAMOUFOX_SOURCE_LIMIT) for index, source in enumerate(normalized)]},
        sys.stdout,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    main()
