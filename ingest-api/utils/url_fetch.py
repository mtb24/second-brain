"""Fetch URL and extract readable text using readability-lxml."""

import logging

import httpx
from readability import Document

logger = logging.getLogger(__name__)


async def fetch_readable_text(url: str, timeout: float = 30.0) -> str:
    """Fetch URL, parse HTML, extract main readable text."""
    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
        headers={"User-Agent": "ingest-api/1.0"},
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        doc = Document(response.text)
        title = doc.title()
        body = doc.summary()
        # Strip HTML tags for plain text
        from html import unescape
        import re
        text = re.sub(r"<[^>]+>", " ", body)
        text = unescape(text)
        text = re.sub(r"\s+", " ", text).strip()
        if title and title != url:
            text = f"{title}\n\n{text}"
        return text or url
