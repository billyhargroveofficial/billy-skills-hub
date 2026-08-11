---
name: "claude-tmux"
description: >-
  Drive an interactive Claude Code TUI inside a detached tmux session from Codex or another shell-capable agent: start sessions, send prompts, wait for completion, scrape answers, and handle permission dialogs. Use when the user wants multi-turn scripted Claude Code while staying on subscription limits rather than headless claude -p or Agent SDK metering.
---

# claude-tmux — drive an interactive Claude Code session via tmux

Run `claude` (the interactive TUI) inside a **detached tmux session**, then control it
from the outside: type a prompt with `tmux send-keys`, poll the screen with
`tmux capture-pane` until the turn finishes, scrape the answer. It is one continuous
session with full conversational memory across turns — not a fresh subprocess per
prompt, and not a Claude Code subagent.

**Why this and not `claude -p` (headless):** the interactive TUI draws from the normal
**Claude subscription** limits. Headless `claude -p`, the Agent SDK, GitHub Actions, and
approved third-party ACP harnesses moved to a separate **metered Agent-SDK credit**
(billed at full API token rates, no rollover) on **2026-06-15**. So for scripted,
multi-turn driving of Claude Code on a Max plan, tmux is the path that does **not** burn
the credit pool. (For a true single-shot programmatic call where metering is fine,
`claude -p --output-format json` + `--resume <session_id>` is still simpler — see bottom.)

This is **not an official feature** — there is no documented tmux send-keys API. It is a
robust, verified hack. Official remote/automation features: `claude --rc` (Remote Control,
human phone/browser access, not scriptable) and the Agent SDK (metered after 2026-06-15).

---

## The wrapper — `cc-tmux.sh` (handles every gotcha)

```bash
CC=~/.agents/skills/claude-tmux/cc-tmux.sh

$CC start <sess> [claude flags...]   # spawn detached `claude`, forward flags
$CC ask   <sess> "<prompt>"          # send + wait + print the answer   ← the one you want
$CC send  <sess> "<prompt>"          # type prompt + Enter, return immediately (fire-and-forget)
$CC wait  <sess>                      # block until the current turn finishes
$CC last  <sess>                      # just the last assistant answer block (two-pass scrape)
$CC read  <sess>                      # full denoised pane (source of truth)
$CC keys  <sess> <key> [key...]       # raw send-keys passthrough (answer dialogs, Escape, etc.)
$CC kill  <sess>                       # tmux kill-session
$CC list                               # tmux ls
```

`wait`/`ask` exit codes: **0** done · **3** a permission dialog is open · **4** timeout.
`ask` waits for the pane to settle (`CC_TMUX_LAST_SETTLE`, default 0.4 s) before scraping, so the answer is fully rendered.

### Typical multi-turn drive

```bash
CC=~/.agents/skills/claude-tmux/cc-tmux.sh
$CC start work --permission-mode acceptEdits        # autonomous-ish; see permissions below
$CC ask   work "Read package.json and tell me the test command"
$CC ask   work "Now run it and summarize failures"  # same session — remembers turn 1
$CC kill  work
```

Verified working 2026-06-11 against Claude Code v2.1.173 (Fable 5). A 1-line answer turn
lands in ~7s; `ask` returns the clean answer text (e.g. `Токио`), follow-ups keep context.

---

## How it works under the hood (and why each step is the way it is)

1. **Start detached:**
   `tmux new-session -d -s <sess> 'claude <flags>'`. The wrapper sizes the pane
   (`-x 200 -y 50` so output is not truncated) and waits for the input box (`❯`) to draw.

2. **Send a prompt = two separate keystrokes.**
   `tmux send-keys -t <sess> -l -- "<prompt>"` then a short pause then
   `tmux send-keys -t <sess> Enter`. Splitting text from Enter matters: the TUI sometimes
   eats an Enter fired in the same instant as the paste, so the prompt sits unsent.
   `-l` (literal) stops tmux from interpreting words like `Enter`/`Space`/`C-c` inside the
   prompt as key names; `--` guards a prompt that starts with `-`.

3. **Wait = poll the pane for the busy spinner.**
   While generating, the footer shows **`esc to interrupt`**. The wrapper waits for it to
   appear (Phase A), then waits for it to stay gone for two consecutive polls (Phase B,
   debounced). The output is screenshot-based, so there is no event stream — polling
   `capture-pane` is the only signal.

4. **Read / Last = scrape the answer from the pane.**
   `last` uses a two-pass approach: `grep -n` finds the line number of the final `⏺`
   marker, then `tail -n +<N>` + `awk` prints forward from there until a stop boundary
   (next prompt `❯`, horizontal rule `─────`, timing line `✻`, or the spinner line).
   Empty lines and stop-marker lines are stripped, so the output is a clean answer block.
   `read` returns the full denoised pane — use it when `last` returns nothing (e.g. an
   answer that contains `⏺` symbols from tool output).

---

## Gotchas (each cost real time)

1. **Text and Enter must be separate `send-keys` calls** with a ~0.4s gap. One combined
   call frequently leaves the prompt unsent. (`CC_TMUX_SETTLE` tunes the gap.)

2. **Permission dialogs hang `wait` forever** unless detected. When Claude asks to run a
   tool, the spinner is gone but the session is *not* idle — it shows
   `Do you want to proceed?` with `❯ 1. Yes`. `wait`/`ask` detect this and exit **3**.
   Then either inspect + answer:
   ```bash
   $CC read work            # see the dialog
   $CC keys work 1 Enter    # choose option 1 (Yes)
   $CC wait work            # resume waiting
   ```
   …or avoid it entirely by starting with `--permission-mode acceptEdits` (edits auto-ok)
   or `--permission-mode bypassPermissions` / `--dangerously-skip-permissions` (full
   autonomy — only in a trusted dir). Pass these as `start` flags.

3. **`capture-pane` is a screenshot, not a transcript.** Long answers scroll; the wrapper
   captures `-S -400` of scrollback (`CC_TMUX_SCROLLBACK`). For very long outputs, bump it
   or have the driven session write results to a file and read that file instead.

4. **The TUI shows prompt *suggestions* in the input box** (ghost text like
   `Try "how does X work?"`). It is not a sent prompt — ignore it. It can appear in
   `read` output; `last` slices above it.

5. **Keep prompts single-line.** A literal newline inside the prompt submits early. For
   multi-line input, `send` the first line, then `keys <sess> Enter` per line, or have the
   prompt reference a file you wrote.

6. **`--permission-mode` only.** There is no flag to answer dialogs non-interactively from
   `claude` itself in TUI mode; that is what `keys <sess> 1 Enter` is for.

7. **Watch tokens.** Each turn is a real Claude turn on your subscription. A driver that
   loops can burn through your 5-hour / weekly window — see the live `--%` in the TUI
   status bar via `read`.

8. **Split-pane teammate features need iTerm2/tmux** and are unsupported in Ghostty; this
   skill uses a plain detached tmux session, which works everywhere tmux is installed.

9. **Pane render race.** `wait` returns `DONE` as soon as the spinner disappears, but the
   answer text may not have drawn yet when `capture-pane` runs. `ask` inserts a
   `sleep 0.4` (`CC_TMUX_LAST_SETTLE`) between `wait` and `last`. For manual `send` +
   `wait` + `last` workflows, add a short sleep yourself.

---

## Driving it from inside a parent Codex or Claude Code session

Call the wrapper via the local shell. For the wait step, prefer a background command
(`run_in_background: true`) with an `until` loop, or the `Monitor` tool, so the turn does
not block — you get notified when the answer is ready, then `read`/`last` it:

```bash
# fire-and-forget then notify-on-done, instead of a blocking `ask`:
$CC send work "Do the big refactor and run tests"
until ! tmux capture-pane -t work -p | grep -qi 'esc to interrupt'; do sleep 2; done
$CC last work
```

---

## When to use plain headless `claude -p` instead

If a single programmatic call is all you need and metered Agent-SDK billing (post
2026-06-15) is acceptable, skip tmux:

```bash
sid=$(claude -p "start a review of X" --output-format json | jq -r '.session_id')
claude -p "now fix what you found" --resume "$sid"      # same session, next turn
```

Use **tmux (this skill)** when you want to stay on subscription limits, watch/interact
with a live session, or keep a long-lived session you poke over many turns.
Use **`claude -p`** for one-shot scripted calls where metering is fine.
