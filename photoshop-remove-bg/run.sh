#!/bin/bash
# Batch background removal via Adobe Photoshop's "Remove Background" (macOS, CLI).
# Usage: run.sh <input-folder> [output-subdir]   (default subdir: nobg)
# Generates a temp JSX in /tmp, runs it in Photoshop, waits, prints a summary.
# Leaves NOTHING in the image folder except the output subfolder with PNGs.
set -euo pipefail

INPUT_RAW="${1:?usage: run.sh <input-folder> [output-subdir]}"
SUBDIR="${2:-nobg}"

INPUT="$(cd "$INPUT_RAW" 2>/dev/null && pwd)" || { echo "Folder not found: $INPUT_RAW" >&2; exit 1; }
OUTPUT="$INPUT/$SUBDIR"

# newest installed Photoshop
PS_APP="$(/bin/ls -d "/Applications/Adobe Photoshop"*/*.app 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$PS_APP" ] || { echo "Adobe Photoshop not found in /Applications" >&2; exit 1; }

shopt -s nullglob nocaseglob
IMGS=("$INPUT"/*.{png,jpg,jpeg,tif,tiff,heic,webp})
shopt -u nullglob nocaseglob
N=${#IMGS[@]}
[ "$N" -gt 0 ] || { echo "No images (png/jpg/tiff/heic/webp) in $INPUT" >&2; exit 1; }

# quit Photoshop afterwards only if this script is the one starting it
# (match the main app binary path: helpers like "Adobe Crash Processor" linger after quit)
if pgrep -f "MacOS/Adobe Photoshop" >/dev/null 2>&1; then QUIT=false; else QUIT=true; fi

TMP="$(mktemp -d /tmp/ps-removebg.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
LOG="$TMP/log.txt"
JSX="$TMP/removebg.jsx"

cat > "$JSX" <<EOF
#target photoshop
app.displayDialogs = DialogModes.NO;

var input  = new Folder("$INPUT");
var output = new Folder("$OUTPUT");
if (!output.exists) output.create();

var logFile = new File("$LOG");
logFile.open("w");
logFile.lineFeed = "Unix";

var files = input.getFiles(/\.(jpe?g|png|tiff?|heic|webp)$/i);

for (var i = 0; i < files.length; i++) {
    try {
        var doc = app.open(files[i]);
        try {
            // the "Remove Background" quick action (PS 2022+)
            executeAction(stringIDToTypeID("removeBackground"), undefined, DialogModes.NO);
        } catch (e) {
            // fallback for older PS: Select Subject -> clear background
            executeAction(stringIDToTypeID("autoCutout"), undefined, DialogModes.NO);
            doc.activeLayer.isBackgroundLayer = false;
            doc.selection.invert();
            doc.selection.clear();
            doc.selection.deselect();
        }
        // NB: never name this var "name" - top-level "name" is the app name in ExtendScript
        var baseName = doc.name.replace(/\.[^\.]+$/, "");
        doc.saveAs(new File(output + "/" + baseName + ".png"), new PNGSaveOptions(), true, Extension.LOWERCASE);
        doc.close(SaveOptions.DONOTSAVECHANGES);
        logFile.writeln("OK " + files[i].name);
    } catch (err) {
        logFile.writeln("FAIL " + files[i].name + " :: " + err);
        try { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
    }
}
logFile.writeln("DONE");
logFile.close();
if ($QUIT) {
    executeAction(charIDToTypeID("quit"), undefined, DialogModes.NO);
}
EOF

echo "Photoshop: $(basename "$PS_APP") | images: $N | output: $OUTPUT"
open -a "$PS_APP" "$JSX"

DEADLINE=$(( $(date +%s) + 180 + 30 * N ))
until [ -f "$LOG" ] && grep -q "^DONE" "$LOG"; do
    if [ "$(date +%s)" -ge "$DEADLINE" ]; then
        echo "Timed out waiting for Photoshop." >&2
        [ -f "$LOG" ] && cat "$LOG" >&2
        exit 1
    fi
    sleep 2
done

OK_N=$(grep -c "^OK " "$LOG" || true)
FAIL_N=$(grep -c "^FAIL " "$LOG" || true)
echo "Done: $OK_N ok, $FAIL_N failed -> $OUTPUT"
if [ "$FAIL_N" -ne 0 ]; then
    grep "^FAIL " "$LOG" >&2
    exit 1
fi
