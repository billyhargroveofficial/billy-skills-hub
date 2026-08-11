---
name: excalidraw-diagram
description: Generate high-quality Excalidraw diagrams, especially detailed workflow, research-methodology, architecture, dataflow, DAG, flowchart, Houdini/TOP-style network, graph, and formula-heavy diagrams. Use when the user asks to create or improve an Excalidraw file, make a readable block scheme, render a precise data flow, include LaTeX/KaTeX-style formulas, save diagrams for Obsidian/BillyNotes, or produce PNG/SVG previews with validation.
---

# Excalidraw Diagram Generator

Create `.excalidraw` files as visual systems, not text pasted into boxes. Prefer a generator-first workflow: produce deterministic Excalidraw JSON, embed formulas as SVG images with LaTeX metadata, render PNG/SVG previews, inspect the result, and iterate until the layout is actually readable.

## Core Workflow

1. Identify the diagram type and the main data grain.
   - For DAG/dataflow diagrams, the main wire must answer: "what data type is flowing now?"
   - Put proof, assumptions, formulas, examples, and guardrails in side artifacts, not inside main nodes.

2. For complex diagrams, copy `scripts/houdini_dag_generator.mjs` into the current workspace under `work/` and edit the copied file.
   - Do not edit the skill's bundled script directly during a user task.
   - Set `DIAGRAM_BASENAME`, `DIAGRAM_OUT`, and optionally `DIAGRAM_VAULT`.
   - Install local deps in the workspace if needed: `npm i mathjax-full sharp`.

3. Use the Houdini/TOP visual model for large workflows.
   - Read `references/houdini-dag-style.md` before drawing a DAG or dataflow.
   - Read `references/render-pipeline.md` before rendering or validating.

4. Render and verify before final delivery.
   - Run the generator.
   - Require `warnings=0` in the report unless explicitly explained.
   - Inspect the full preview and at least the most crowded crops with `view_image`.
   - Fix text overflow, empty boxes, formula scale, wire crossings, and unreadable mini-text before responding.

5. Deliver the actual files.
   - Always produce `.excalidraw`, `.excalidraw.md`, `.preview.svg`, `.preview.png`, and `.report.txt`.
   - For BillyNotes/Obsidian requests, also copy `.excalidraw` and `.excalidraw.md` into the vault/root requested by the user.

## Visual Rules

- Use one dominant main flow direction: top-to-bottom for Houdini/TOP-like networks; left-to-right for lineage/architecture if that is clearer.
- Make main nodes compact: title, type chip, output chip, 1-2 lines of meaning, status/work-item dots.
- Put detailed text into attached artifacts: mini tables, dark evidence blocks, sticky assumption notes, formula cards, audit cards.
- Use thick solid arrows only for main data. Use dashed thin side wires for config, evidence, references, formulas, and audit.
- Use pinned dots and side rails for long side connections; avoid diagonal spaghetti.
- Use red only for hard failures, invalid claims, or blocked paths.
- Avoid cycles unless the system is truly cyclic. For acyclic workflows, say audit branch/wrapper/envelope, not loop.
- No large empty boxes. If text occupies only a tiny corner, shrink the box or add meaningful structure like chips, dots, ports, or a mini table.
- Formula cards must sit near the node they justify.
- The final preview must remain understandable at zoom-out and readable when cropped.

## Formula Rules

- Render formulas as SVG images via MathJax/LaTeX and store the LaTeX source in `customData.latex`.
- Keep Cyrillic and long prose outside formula elements; use normal text cards for explanations.
- Prefer a few high-value formulas over decorative math.
- For statistical diagrams, place denominator/estimand formulas next to the reducer/estimator node, not in a remote legend.

## Quality Gate

Before final response, check:

- `warnings=0` from the generator's text/formula validation.
- No visible text crosses box boundaries.
- No central node is a huge mostly empty rectangle.
- Main data flow is visually dominant.
- Side artifacts explain evidence and assumptions without competing with the main flow.
- LaTeX formulas are crisp in PNG preview.
- Output files are saved in user-facing output locations.
