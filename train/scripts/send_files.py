"""Send files to a Telegram chat AS BILLY'S USER ACCOUNT via the telethon
session held in ~/telegram-mcp/.env. Captions auto-get a #train tag.

Usage (called by send-files.sh, which sources ~/telegram-mcp/.env first):
    python send_files.py <chat_id> <file1> [file2 ...]

Each file's caption = its filename without extension, prefixed with "#train "
unless the name already starts with #train. Files go as documents (force_document),
so .md keeps its extension and Telegram renders the markdown/formulas.
"""
import os, sys, asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession

CHAT = int(sys.argv[1])
PATHS = sys.argv[2:]

async def main():
    client = TelegramClient(
        StringSession(os.environ["TELEGRAM_SESSION_STRING"]),
        int(os.environ["TELEGRAM_API_ID"]),
        os.environ["TELEGRAM_API_HASH"],
    )
    await client.connect()
    if not await client.is_user_authorized():
        print("NOT AUTHORIZED"); sys.exit(1)
    print("logged in as:", (await client.get_me()).username)
    try:
        entity = await client.get_entity(CHAT)
    except Exception:
        await client.get_dialogs()
        entity = await client.get_entity(CHAT)
    for p in PATHS:
        name = os.path.splitext(os.path.basename(p))[0]
        cap = name if name.lower().lstrip().startswith("#train") else f"#train {name}"
        msg = await client.send_file(entity, p, caption=cap, force_document=True)
        print("SENT", os.path.basename(p), "-> msg_id", msg.id)
    await client.disconnect()
    print("DONE")

asyncio.run(main())
