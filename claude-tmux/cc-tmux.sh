#!/usr/bin/env bash
# Drive an INTERACTIVE Claude Code session inside a detached tmux session:
# start it, type prompts, wait for the answer, read it back. macOS bash 3.2 safe.
#
# Why tmux and not `claude -p`: this drives the interactive TUI, which stays on
# normal subscription limits. Headless `claude -p` moved to the metered Agent-SDK
# credit pool on 2026-06-15. So for scripted multi-turn on a Max plan, tmux wins.
#
# Usage:
#   cc-tmux.sh start <sess> [claude flags...]   # spawn detached `claude` (forward flags)
#   cc-tmux.sh ask   <sess> "<prompt>"          # send + wait + print the answer  (the one you want)
#   cc-tmux.sh send  <sess> "<prompt>"          # type prompt + Enter, return immediately
#   cc-tmux.sh wait  <sess>                      # block until the current turn finishes
#   cc-tmux.sh last  <sess>                      # best-effort: just the last assistant block
#   cc-tmux.sh read  <sess>                      # full denoised pane (source of truth)
#   cc-tmux.sh keys  <sess> <key> [key...]       # raw send-keys passthrough (answer dialogs)
#   cc-tmux.sh kill  <sess>                       # tmux kill-session
#   cc-tmux.sh list                               # tmux ls
#
# Exit codes from wait/ask: 0 done · 3 permission dialog open · 4 timeout.
#
# Env knobs: CC (claude path) CC_TMUX_CWD CC_TMUX_COLS/ROWS CC_TMUX_SCROLLBACK
#            CC_TMUX_SETTLE CC_TMUX_APPEAR CC_TMUX_DONE CC_TMUX_POLL
#            CC_TMUX_LAST_SETTLE
set -eo pipefail   # no -u: bash 3.2 trips on empty arrays

CC=${CC:-$(command -v claude || echo "$HOME/.local/bin/claude")}
SCROLLBACK=${CC_TMUX_SCROLLBACK:-400}
SETTLE=${CC_TMUX_SETTLE:-0.4}        # pause between typing text and Enter (TUI paste settle)
APPEAR_TIMEOUT=${CC_TMUX_APPEAR:-8}  # max s to wait for the busy spinner to show up
DONE_TIMEOUT=${CC_TMUX_DONE:-600}    # max s to wait for a turn to finish
POLL=${CC_TMUX_POLL:-1}

_pane()    { tmux capture-pane -t "$1" -p -S -"$SCROLLBACK"; }
_busy()    { _pane "$1" | grep -qi 'esc to interrupt'; }
_dialog()  { _pane "$1" | grep -qiE 'Do you want|❯ ?1\.|Yes, (and )?(proceed|allow|don)'; }
_now()     { date +%s; }

cmd=${1:?cmd: start|ask|send|wait|last|read|keys|kill|list}; shift || true

case "$cmd" in
  start)
    sess=${1:?session name}; shift || true
    if tmux has-session -t "$sess" 2>/dev/null; then echo "exists: $sess" >&2; exit 0; fi
    tmux new-session -d -s "$sess" \
      -x "${CC_TMUX_COLS:-200}" -y "${CC_TMUX_ROWS:-50}" \
      -c "${CC_TMUX_CWD:-$(pwd)}" \
      "$CC $*"
    for i in $(seq 1 40); do _pane "$sess" 2>/dev/null | grep -q '❯' && break; sleep 0.3; done
    echo "started: $sess"
    ;;

  send)
    sess=${1:?session}; shift; prompt=${1:?prompt}; shift || true
    tmux send-keys -t "$sess" -l -- "$prompt"   # -l = literal: prompt text isn't parsed as key names
    sleep "$SETTLE"
    tmux send-keys -t "$sess" Enter
    ;;

  keys)
    sess=${1:?session}; shift
    tmux send-keys -t "$sess" "$@"
    ;;

  wait)
    sess=${1:?session}
    # Phase A: wait for the busy spinner to appear (instant answers fall through after APPEAR_TIMEOUT)
    deadline=$(( $(_now) + APPEAR_TIMEOUT ))
    while :; do
      _busy "$sess" && break
      _dialog "$sess" && { echo PERMISSION_PROMPT; exit 3; }
      [ "$(_now)" -ge "$deadline" ] && break
      sleep 0.3
    done
    # Phase B: wait for the spinner to stay gone for 2 consecutive polls (debounce)
    deadline=$(( $(_now) + DONE_TIMEOUT ))
    gone=0
    while :; do
      if _busy "$sess"; then
        gone=0
      else
        _dialog "$sess" && { echo PERMISSION_PROMPT; exit 3; }
        gone=$((gone+1)); [ "$gone" -ge 2 ] && break
      fi
      [ "$(_now)" -ge "$deadline" ] && { echo TIMEOUT >&2; exit 4; }
      sleep "$POLL"
    done
    echo DONE
    ;;

  read)
    sess=${1:?session}; _pane "$sess" | grep -v '^[[:space:]]*$'
    ;;

  last)
    # Two-pass: grep -n to find the LAST ⏺ line, then print forward until a
    # stop boundary (next prompt, separator bar, timing line, or spinner line).
    # No full-pane awk array — only the tail window is processed.
    sess=${1:?session}
    pane=$(_pane "$sess")
    n=$({ printf '%s\n' "$pane"; echo; } | grep -n '⏺' | tail -1 | cut -d: -f1)
    if [ -z "$n" ]; then
      echo "# no ⏺ marker in pane — use 'read' to inspect" >&2
      exit 1
    fi
    { printf '%s\n' "$pane"; echo; } | tail -n +"$n" | awk '
      NR==1 { sub(/^[[:space:]]*⏺[[:space:]]*/, ""); if ($0!="") print; next }
      /✻/ || /─{40,}/ || /^[[:space:]]*❯/ || /esc to interrupt/ || /focus-events/ { exit }
      $0!="" { print }
    '
    ;;

  ask)
    sess=${1:?session}; shift; prompt=${1:?prompt}; shift || true
    "$0" send "$sess" "$prompt"
    if ! "$0" wait "$sess" >/dev/null; then
      ec=$?
      if [ "$ec" -eq 3 ]; then
        echo "PERMISSION_PROMPT — inspect: $0 read $sess  ·  approve: $0 keys $sess 1 Enter" >&2
      fi
      exit "$ec"
    fi
    sleep "${CC_TMUX_LAST_SETTLE:-0.4}"   # let the pane render the answer before capture
    "$0" last "$sess"
    ;;

  kill)
    sess=${1:?session}; tmux kill-session -t "$sess" && echo "killed: $sess"
    ;;

  list)
    tmux ls 2>/dev/null | grep -v '^[[:space:]]*$' || echo "(no tmux sessions)"
    ;;

  *)
    echo "cc-tmux.sh: unknown cmd '$cmd' (start|ask|send|wait|last|read|keys|kill|list)" >&2
    exit 2
    ;;
esac
