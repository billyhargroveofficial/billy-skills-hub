#!/bin/sh
# Send files (e.g. эталон .md with formulas) to a Telegram chat AS BILLY'S USER
# ACCOUNT — because the bot @BillyHargroveOfficial_bot is NOT in Парилка228 and
# the telegram MCP tool can only send TEXT, not files.
#
# The user-account telethon session lives in ~/telegram-mcp/.env, held by the
# launchd service com.billy.telegram-mcp (KeepAlive=true). Two telethon clients
# on one session => AuthKeyDuplicated, which would log the session out. So we
# bootout the service for the duration of the one-shot send, then bring it back.
#
# Usage:
#   send-files.sh <chat_id> <file1> [file2 ...]
# Example:
#   send-files.sh -1003179772905 "/tmp/train/Q1 — p-value.md" "/tmp/train/Q2 — bias-variance.md"
#
# Captions auto-get a #train tag (see send_files.py).
set -u
if [ "$#" -lt 2 ]; then echo "usage: send-files.sh <chat_id> <file...>"; exit 2; fi
CHAT="$1"; shift
UID_N=$(id -u)
SVC="com.billy.telegram-mcp"
PLIST="$HOME/Library/LaunchAgents/$SVC.plist"
HERE=$(cd "$(dirname "$0")" && pwd)

echo "==> stopping $SVC (bootout; KeepAlive)"
launchctl bootout "gui/$UID_N/$SVC" 2>/dev/null
sleep 2
if launchctl list | grep -q "$SVC"; then
  echo "!! $SVC still running — aborting to avoid AuthKeyDuplicated"; exit 1
fi

echo "==> sending $# file(s) to $CHAT as user account"
set -a; . "$HOME/telegram-mcp/.env"; set +a
"$HOME/telegram-mcp/venv/bin/python" "$HERE/send_files.py" "$CHAT" "$@"
RC=$?

echo "==> restarting $SVC"
launchctl bootstrap "gui/$UID_N" "$PLIST" 2>/dev/null || launchctl load -w "$PLIST" 2>/dev/null
sleep 2
if launchctl list | grep -q "$SVC"; then echo "ok — service back up"; else echo "!! service NOT back — run: launchctl bootstrap gui/$UID_N $PLIST"; fi
exit $RC
