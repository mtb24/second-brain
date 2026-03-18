"""Ollama API client: classify, embed."""

import logging

import httpx

logger = logging.getLogger(__name__)


VALID_TAGS = frozenset(
    {
        "note",
        "code",
        "recipe",
        "task",
        "bookmark",
        "journal",
        "trading_research",
    }
)

CLASSIFY_SYSTEM = """You are a content classifier. Given a piece of text, return ONLY a single word from this list: note, code, recipe, task, bookmark, journal, trading_research. No explanation. Just the word."""


class OllamaClient:
    """Client for Ollama API (chat, embed)."""

    def __init__(
        self,
        base_url: str,
        chat_model: str = "llama3.2",
        embed_model: str = "nomic-embed-text",
        timeout: float = 120.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.chat_model = chat_model
        self.embed_model = embed_model
        self.timeout = timeout

    async def classify_content(self, text: str) -> str:
        """Use chat model to classify; return one of VALID_TAGS or 'note' on failure."""
        if not text or not text.strip():
            return "note"
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.chat_model,
                        "messages": [
                            {"role": "system", "content": CLASSIFY_SYSTEM},
                            {"role": "user", "content": text[:8000]},
                        ],
                        "stream": False,
                    },
                )
                response.raise_for_status()
                data = response.json()
                message = data.get("message") or {}
                content = (message.get("content") or "").strip().lower()
                # Take first word that looks like a tag
                word = content.split()[0] if content else ""
                if word in VALID_TAGS:
                    return word
                logger.warning("Ollama classification returned unexpected output: %s", content)
                return "note"
            except Exception as e:
                logger.warning("Ollama classification failed: %s", e)
                return "note"

    async def embed_text(self, text: str) -> list[float]:
        """POST to embed model; return 768-dim vector."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.embed_model, "prompt": text},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [])

    async def check_reachable(self) -> bool:
        """Return True if Ollama is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{self.base_url}/api/tags")
                return r.status_code == 200
        except Exception:
            return False
