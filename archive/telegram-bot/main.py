import os
import logging
import httpx
import base64
from fastapi import FastAPI, Request, HTTPException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

TELEGRAM_TOKEN = os.environ["TELEGRAM_TOKEN"]
TELEGRAM_API = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"
INGEST_URL = os.environ.get("INGEST_URL", "http://ingest-api:8000/ingest")
API_SECRET = os.environ["API_SECRET"]
ALLOWED_USER_ID = int(os.environ["ALLOWED_USER_ID"])

DOMAIN_KEYWORDS = {
    "note": ["note", "idea", "thought", "remember"],
    "journal": ["journal", "feeling", "today", "mood"],
    "code": ["code", "function", "bug", "fix", "snippet"],
    "task": ["task", "todo", "remind", "do this"],
    "recipe": ["recipe", "cook", "ingredient", "food"],
    "bookmark": ["bookmark", "link", "article", "read"],
    "trading_research": ["trading", "crypto", "bitcoin", "strategy"],
}


async def send_message(chat_id: int, text: str):
    async with httpx.AsyncClient() as client:
        await client.post(f"{TELEGRAM_API}/sendMessage", json={
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown"
        })


async def get_file_url(file_id: str) -> str:
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{TELEGRAM_API}/getFile", params={"file_id": file_id})
        file_path = r.json()["result"]["file_path"]
        return f"https://api.telegram.org/file/bot{TELEGRAM_TOKEN}/{file_path}"


async def download_file(url: str) -> bytes:
    async with httpx.AsyncClient() as client:
        r = await client.get(url)
        return r.content


async def ingest(content_type: str, payload: dict, chat_id: int):
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            INGEST_URL,
            json=payload,
            headers={"Authorization": f"Bearer {API_SECRET}"}
        )
        if r.status_code == 200:
            data = r.json()
            domain = data.get("domain_tag", "note")
            content = data.get("content", "")
            preview = content[:200] + "..." if len(content) > 200 else content
            await send_message(chat_id,
                f"✓ Saved as *{domain}*\n\n_{preview}_"
            )
        else:
            await send_message(chat_id, f"⚠️ Ingest failed: {r.text}")


@app.post("/webhook")
async def webhook(request: Request):
    data = await request.json()
    message = data.get("message", {})

    chat_id = message.get("chat", {}).get("id")
    user_id = message.get("from", {}).get("id")

    if not chat_id:
        return {"ok": True}

    # Security — only respond to your own Telegram account
    if user_id != ALLOWED_USER_ID:
        await send_message(chat_id, "Unauthorized.")
        return {"ok": True}

    # --- Voice message ---
    if "voice" in message:
        await send_message(chat_id, "🎙 Transcribing...")
        file_url = await get_file_url(message["voice"]["file_id"])
        audio_bytes = await download_file(file_url)
        audio_b64 = base64.b64encode(audio_bytes).decode()
        await ingest("audio", {
            "type": "audio",
            "audio_base64": audio_b64,
            "source": "telegram_voice"
        }, chat_id)
        return {"ok": True}

    # --- Text message ---
    if "text" in message:
        text = message["text"].strip()

        # Commands
        if text.startswith("/start"):
            await send_message(chat_id,
                "👋 *Brain Capture Bot*\n\n"
                "Send me a voice message or text to save to your second brain.\n\n"
                "Commands:\n"
                "/note — save as note\n"
                "/journal — save as journal\n"
                "/code — save as code\n"
                "/task — save as task\n"
                "/recipe — save as recipe\n"
                "/help — show this message"
            )
            return {"ok": True}

        if text.startswith("/help"):
            await send_message(chat_id,
                "Send any voice message or text.\n"
                "Prefix with a command to force a domain:\n"
                "/note /journal /code /task /recipe /bookmark"
            )
            return {"ok": True}

        # Force domain via command prefix
        forced_domain = None
        for cmd in ["note", "journal", "code", "task", "recipe", "bookmark", "trading_research"]:
            if text.startswith(f"/{cmd}"):
                forced_domain = cmd
                text = text[len(cmd)+1:].strip()
                break

        if not text:
            await send_message(chat_id, "Please add some text after the command.")
            return {"ok": True}

        payload = {
            "type": "text",
            "content": text,
            "source": "telegram_text"
        }
        if forced_domain:
            payload["metadata"] = {"forced_domain": forced_domain}

        await ingest("text", payload, chat_id)
        return {"ok": True}

    return {"ok": True}


@app.get("/health")
async def health():
    return {"status": "ok"}
