# Excalidraw Render Pipeline

Use this for generator-based Excalidraw diagrams.

## Preferred Local Workflow

```bash
mkdir -p work/excalidraw
cp /Users/billy/.agents/skills/excalidraw-diagram/scripts/houdini_dag_generator.mjs work/excalidraw/generate.mjs
cd work/excalidraw
npm init -y
npm i mathjax-full sharp
DIAGRAM_BASENAME=my-diagram \
DIAGRAM_OUT=/absolute/output/dir \
DIAGRAM_VAULT=/Users/billy/Documents/billynotes \
node generate.mjs
```

Then inspect:

```bash
sips -g pixelWidth -g pixelHeight /absolute/output/dir/my-diagram.preview.png
sed -n '1,120p' /absolute/output/dir/my-diagram.report.txt
```

Open the generated PNG with `view_image`, plus crowded crops when available.

## Required Outputs

- `<basename>.excalidraw`
- `<basename>.excalidraw.md`
- `<basename>.preview.svg`
- `<basename>.preview.png`
- `<basename>.report.txt`
- optional section crops

## Validation

The bundled generator checks:

- text line overflow
- text vertical overflow inside containers
- missing formula/image files
- output paths and element counts

Treat `warnings=0` as the baseline. If warnings remain, fix them or explicitly explain why they are harmless.

## Formula Encoding

The generator renders LaTeX with MathJax to SVG, embeds the SVG as an Excalidraw image, and stores the source as:

```json
"customData": { "latex": "..." }
```

This gives crisp formulas in PNG/SVG exports and keeps the formula source recoverable.
