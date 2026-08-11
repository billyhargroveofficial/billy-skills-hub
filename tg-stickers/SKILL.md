---
name: "tg-stickers"
description: >-
  Create or add stickers to a Telegram sticker pack from images. Use when the user wants to
  добавить стикер / создать стикерпак / make a sticker pack / add sticker from image /
  конвертировать картинку в стикер. Handles resizing, @Stickers bot automation via Telethon
  (same session as the telegram-mcp server). Supports adding to existing packs or creating new ones.
---

# Telegram Sticker Pack Manager

Automates creating and adding stickers to Telegram packs via the @Stickers bot,
using the same Telethon user-session as the `telegram-mcp` MCP server.

## Credentials & runtime

- **Session:** Telethon StringSession from `/Users/billy/telegram-mcp/.env`
- **Python:** `/Users/billy/telegram-mcp/venv/bin/python` (has Telethon + Pillow)
- **Script:** `/Users/billy/.agents/skills/tg-stickers/scripts/add_sticker.py`
- **User:** @billyhargroveofficial

## When to use

- User pastes/sends image(s) and says "добавь в стикерпак", "сделай стикер", "add to sticker pack"
- User wants a new sticker pack from images
- User says "tg-stickers" or references this skill

## How to invoke

### Add sticker(s) to an EXISTING pack

```bash
cd /Users/billy/telegram-mcp && set -a && . .env && set +a && \
/Users/billy/telegram-mcp/venv/bin/python \
  /Users/billy/.agents/skills/tg-stickers/scripts/add_sticker.py \
  --pack <SHORT_NAME> \
  --emoji <EMOJI1> --images <PATH1> \
  [--emoji <EMOJI2> --images <PATH2> ...]
```

### Create a NEW pack

```bash
cd /Users/billy/telegram-mcp && set -a && . .env && set +a && \
/Users/billy/telegram-mcp/venv/bin/python \
  /Users/billy/.agents/skills/tg-stickers/scripts/add_sticker.py \
  --new-pack --title "<TITLE>" --short-name <SHORT_NAME> \
  --emoji <EMOJI1> --images <PATH1> \
  [--emoji <EMOJI2> --images <PATH2> ...]
```

## Parameters

| Flag | Required | Description |
|------|----------|-------------|
| `--pack` | yes (unless --new-pack) | Short name of existing pack (e.g. `billy_cat_gator`) |
| `--new-pack` | yes (unless --pack) | Create a new pack instead of adding to existing |
| `--title` | with --new-pack | Display title for the new pack |
| `--short-name` | with --new-pack | URL-friendly short name (no spaces, lowercase) |
| `--emoji` | yes (repeatable) | Emoji for each sticker (one per --images) |
| `--images` | yes (repeatable) | Path to image file (PNG/JPG/WEBP, any size — auto-resized to 512px) |

## Workflow for the agent

1. **Identify images** — from clipboard (`@.qwen/tmp/clipboard/...`), user-provided paths, or downloads
2. **Pick emoji(s)** — ask user or infer from image content (cat→🐱, dog→🐶, etc.)
3. **Determine pack** — ask which pack to add to, or create new. Known packs:
   - `billy_cat_gator` — "Cat and Gator" (2 stickers)
4. **Run the script** with appropriate flags
5. **Report result** — show the t.me/addstickers/ link

## Image requirements (handled automatically)

- Any format (PNG, JPG, WEBP, HEIC) — converted to PNG
- Any size — resized so longest side = 512px, other side ≤ 512px
- Transparency preserved if present; opaque images get opaque stickers

## Known packs

| Short name | Title | Contents |
|------------|-------|----------|
| `billy_cat_gator` | Cat and Gator | 🐱 cat back view, 🐊 gator |

## Troubleshooting

- **"No reply from @Stickers"** — the MCP server's Telethon client may be interfering.
  Wait a few seconds and retry. If persistent, use the safe approach (stop MCP server first):
  ```bash
  launchctl bootout gui/$(id -u) com.billy.telegram-mcp
  # ... run the script ...
  launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.billy.telegram-mcp.plist
  ```
  The `train` skill uses this pattern to avoid `AuthKeyDuplicated`. In practice the
  concurrent approach (polling by message ID) usually works without stopping the service.
- **"session not authorized"** — session expired, regenerate with `gen-session.py`
- **Sticker not appearing** — check with GetStickerSet API; sometimes the bot's
  echo response confuses the polling. The sticker IS usually added despite odd output.
- **Pack name collision** — short names must be globally unique on Telegram

## Notes

- The script uses **polling** (get_messages by ID) instead of Telethon's `conversation()`
  to avoid update-stealing conflicts with the running MCP server on the same session.
- Temp files are written to `/Users/billy/telegram-mcp/stickers_tmp/` and cleaned up after.
- The bot sometimes echoes the emoji as its only reply — this is normal (confirmation).
