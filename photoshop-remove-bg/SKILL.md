---
name: "photoshop-remove-bg"
description: "Batch-remove image backgrounds with Adobe Photoshop's \"Remove Background\" from the CLI on macOS \u2014 process a whole folder of images into transparent PNGs in a subfolder, fully unattended. Use when the user wants to \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0444\u043e\u043d / \u0443\u0431\u0440\u0430\u0442\u044c \u0444\u043e\u043d / remove background from many images (png/jpg/tiff/heic/webp) with Photoshop quality. Launches Photoshop GUI, runs the batch, quits Photoshop afterwards if it wasn't already running."
---

# Photoshop Remove Background (batch, CLI, macOS)

One command, no manual steps:

```bash
bash ~/.agents/skills/photoshop-remove-bg/run.sh <input-folder> [output-subdir]
```

- `output-subdir` defaults to `nobg`, created inside the input folder
- outputs are `<basename>.png` with transparency; same-name files are overwritten silently
- non-recursive: only top-level images of the folder are processed
- prints `Done: N ok, M failed`; exits non-zero and lists `FAIL` lines on any failure
- typical timing: ~20-40 s for Photoshop cold launch, then a few seconds per image

## How it works

`run.sh` generates a temp `.jsx` (ExtendScript) in `/tmp`, opens it with the newest `/Applications/Adobe Photoshop */Adobe Photoshop *.app` (`open -a` executes a `.jsx` in-process — no AppleScript, no macOS Automation permission needed), polls a temp log until `DONE`, prints a summary, and removes the temp dir. Nothing (no jsx, no logs) is left in the image folder.

The JSX runs the real "Remove Background" quick action — `executeAction(stringIDToTypeID("removeBackground"))` (PS 2022+) — with a fallback for older versions: `autoCutout` (Select Subject) + invert selection + clear.

Photoshop is quit at the end (`executeAction(charIDToTypeID("quit"))`) ONLY if it was not running before the script started — a user's already-open Photoshop session is never closed.

## Requirements / gotchas

- macOS with Adobe Photoshop installed. There is no headless mode: Photoshop launches with GUI but the batch runs unattended.
- If editing the JSX template: never use a top-level variable named `name` — in Photoshop ExtendScript the global `name` is the application name ("Adobe Photoshop") and cannot be shadowed by `var name`; every file then saves over one file. Use `baseName` etc.
- ExtendScript `File.writeln` defaults to CR (`\r`) line endings on Mac; the template sets `logFile.lineFeed = "Unix"` so `grep ^OK` works.
- Quality = Select Subject on-device model. For cloud quality ("Detailed results") set it once in the Photoshop GUI preference for Select Subject.
- If the script reports FAIL on every file with an `autoCutout` error too, the image likely has no detectable subject (plain texture etc.) — Photoshop's Select Subject found nothing.
