#!/usr/bin/env python3
"""Add stickers to a Telegram sticker pack via @Stickers bot (Telethon).

Usage:
  # Add to existing pack:
  python add_sticker.py --pack billy_cat_gator --emoji 🐱 --images /path/to/img.png

  # Create new pack:
  python add_sticker.py --new-pack --title "My Pack" --short-name my_pack \
      --emoji 🐱 --images /path/to/img1.png \
      --emoji 🐊 --images /path/to/img2.png

  # Multiple stickers at once (emoji before each image):
  python add_sticker.py --pack my_pack \
      --emoji 🐱 --images cat.png \
      --emoji 🐊 --images gator.png

Environment: reads TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_STRING
from /Users/billy/telegram-mcp/.env (auto-sourced by the wrapper).
"""
import argparse
import asyncio
import os
import sys
import time
from pathlib import Path

from PIL import Image
from telethon import TelegramClient
from telethon.sessions import StringSession

ENV_FILE = Path("/Users/billy/telegram-mcp/.env")
VENV_PYTHON = "/Users/billy/telegram-mcp/venv/bin/python"
TMP_DIR = Path("/Users/billy/telegram-mcp/stickers_tmp")


def load_env():
    """Load .env file if env vars not already set."""
    if os.environ.get("TELEGRAM_SESSION_STRING"):
        return
    if not ENV_FILE.exists():
        print(f"ERROR: {ENV_FILE} not found and no env vars set", file=sys.stderr)
        sys.exit(1)
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def resize_for_sticker(src_path: str, dst_path: str) -> str:
    """Resize image: longest side = 512, other <= 512. Save as PNG RGBA."""
    img = Image.open(src_path).convert("RGBA")
    w, h = img.size
    if w >= h:
        new_w, new_h = 512, int(h * 512 / w)
    else:
        new_h, new_w = 512, int(w * 512 / h)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    img.save(dst_path, "PNG")
    return dst_path


async def get_last_msg_id(client, chat):
    msgs = await client.get_messages(chat, limit=1)
    return msgs[0].id if msgs else 0


async def wait_for_reply(client, chat, after_id, timeout=30):
    """Poll for a new message with ID > after_id."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        msgs = await client.get_messages(chat, limit=1)
        if msgs and msgs[0].id > after_id:
            return msgs[0]
        await asyncio.sleep(1.5)
    # Debug output
    msgs = await client.get_messages(chat, limit=3)
    for m in msgs:
        print(f"  [DEBUG] id={m.id} text={m.text[:80] if m.text else '[media]'}", file=sys.stderr)
    raise TimeoutError(f"No reply from @Stickers (waited {timeout}s after id={after_id})")


async def send_and_wait(client, chat, content, is_file=False, label="", timeout=30):
    """Send message/file and wait for bot reply. Returns the reply message."""
    last_id = await get_last_msg_id(client, chat)
    if is_file:
        await client.send_file(chat, content, force_document=True)
    else:
        await client.send_message(chat, content)
    resp = await wait_for_reply(client, chat, last_id, timeout=timeout)
    return resp


async def add_stickers_to_pack(client, stickers_entity, pack_name, stickers):
    """Add stickers to an existing pack. stickers = [(emoji, image_path), ...]"""
    # /addsticker
    resp = await send_and_wait(client, stickers_entity, "/addsticker", label="/addsticker")
    text = (resp.text or "").lower()
    if "choose" not in text and "выбер" not in text:
        print(f"WARNING: unexpected response to /addsticker: {resp.text[:200]}", file=sys.stderr)

    # Select pack
    resp = await send_and_wait(client, stickers_entity, pack_name, label=f"select {pack_name}")
    text = (resp.text or "").lower()
    if "send me the sticker" not in text and "отправ" not in text and "now send" not in text:
        print(f"WARNING: pack selection may have failed: {resp.text[:200]}", file=sys.stderr)

    # Add each sticker
    for i, (emoji, img_path) in enumerate(stickers):
        print(f"  Adding sticker {i+1}/{len(stickers)}: {emoji} ← {img_path}")
        # Send file
        resp = await send_and_wait(client, stickers_entity, img_path, is_file=True, label=f"file {i+1}")
        text = (resp.text or "").lower()
        if "emoji" not in text and "send me an emoji" not in text and "отправ" not in text:
            print(f"  WARNING: unexpected after file: {resp.text[:200]}", file=sys.stderr)

        # Send emoji
        resp = await send_and_wait(client, stickers_entity, emoji, label=f"emoji {emoji}")
        # Bot echoes emoji or says "send another sticker" — either way we're good
        print(f"  ✓ Sticker {i+1} added ({emoji})")

    # Done — bot is now waiting for next sticker or /done
    # Send /done to finish
    resp = await send_and_wait(client, stickers_entity, "/done", label="/done", timeout=10)
    print(f"  Bot: {resp.text[:200] if resp.text else '[no text]'}")


async def create_new_pack(client, stickers_entity, title, short_name, stickers):
    """Create a new sticker pack. stickers = [(emoji, image_path), ...]"""
    # /cancel first
    resp = await send_and_wait(client, stickers_entity, "/cancel", label="/cancel", timeout=10)

    await asyncio.sleep(1)

    # /newpack
    resp = await send_and_wait(client, stickers_entity, "/newpack", label="/newpack")

    # Title
    resp = await send_and_wait(client, stickers_entity, title, label="title")
    text = (resp.text or "").lower()
    if "sticker" not in text and "send me" not in text:
        print(f"WARNING: title may not have been accepted: {resp.text[:200]}", file=sys.stderr)

    # Add stickers
    for i, (emoji, img_path) in enumerate(stickers):
        print(f"  Adding sticker {i+1}/{len(stickers)}: {emoji} ← {img_path}")
        # Send file
        resp = await send_and_wait(client, stickers_entity, img_path, is_file=True, label=f"file {i+1}")
        # Send emoji
        resp = await send_and_wait(client, stickers_entity, emoji, label=f"emoji {emoji}")
        print(f"  ✓ Sticker {i+1} added ({emoji})")

    # /publish
    resp = await send_and_wait(client, stickers_entity, "/publish", label="/publish")
    text = (resp.text or "").lower()

    # Skip icon
    if "icon" in text or "skip" in text or "иконк" in text:
        resp = await send_and_wait(client, stickers_entity, "/skip", label="/skip icon")

    # Short name
    resp = await send_and_wait(client, stickers_entity, short_name, label="short_name")

    # Check for success (might be in next message)
    await asyncio.sleep(2)
    msgs = await client.get_messages(stickers_entity, limit=2)
    for m in msgs:
        if "t.me/addstickers" in (m.text or ""):
            print(f"\n✅ Pack created: {m.text}")
            return
    print(f"\n✅ Pack created (short name: {short_name})")
    print(f"   Link: https://t.me/addstickers/{short_name}")


async def main():
    parser = argparse.ArgumentParser(description="Add stickers to Telegram pack")
    parser.add_argument("--pack", help="Short name of existing pack to add to")
    parser.add_argument("--new-pack", action="store_true", help="Create a new pack")
    parser.add_argument("--title", help="Title for new pack")
    parser.add_argument("--short-name", help="Short name for new pack")
    parser.add_argument("--emoji", action="append", default=[], help="Emoji for sticker (repeat for each)")
    parser.add_argument("--images", action="append", default=[], help="Image path (repeat for each)")
    args = parser.parse_args()

    if not args.emoji or not args.images:
        parser.error("At least one --emoji and --images required")
    if len(args.emoji) != len(args.images):
        parser.error(f"Emoji count ({len(args.emoji)}) != image count ({len(args.images)})")
    if not args.pack and not args.new_pack:
        parser.error("Either --pack or --new-pack required")
    if args.new_pack and not args.title:
        parser.error("--title required with --new-pack")
    if args.new_pack and not args.short_name:
        parser.error("--short-name required with --new-pack")

    load_env()

    api_id = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    session_string = os.environ["TELEGRAM_SESSION_STRING"]

    # Prepare images
    TMP_DIR.mkdir(exist_ok=True)
    stickers = []
    for i, (emoji, img_path) in enumerate(zip(args.emoji, args.images)):
        img_path = os.path.expanduser(img_path)
        if not os.path.exists(img_path):
            print(f"ERROR: image not found: {img_path}", file=sys.stderr)
            sys.exit(1)
        dst = str(TMP_DIR / f"sticker_{i}.png")
        resize_for_sticker(img_path, dst)
        stickers.append((emoji, dst))
        print(f"  Resized: {img_path} → {dst}")

    # Connect
    client = TelegramClient(StringSession(session_string), api_id, api_hash)
    await client.connect()
    if not await client.is_user_authorized():
        print("ERROR: session not authorized", file=sys.stderr)
        sys.exit(1)

    me = await client.get_me()
    print(f"Logged in as @{me.username}")

    stickers_entity = await client.get_entity("Stickers")

    try:
        if args.new_pack:
            await create_new_pack(client, stickers_entity, args.title, args.short_name, stickers)
        else:
            await add_stickers_to_pack(client, stickers_entity, args.pack, stickers)
    finally:
        await client.disconnect()
        # Cleanup temp files
        import shutil
        if TMP_DIR.exists():
            shutil.rmtree(TMP_DIR, ignore_errors=True)

    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
