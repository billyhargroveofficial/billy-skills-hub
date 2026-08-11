---
name: translate-paper-ru
description: Translate English academic papers, reports, PDFs, and figure/table-heavy documents into Russian while preserving readable layout. Use when the user asks to translate an English paper/PDF/report into Russian, keep layout from breaking, rebuild tables/figures, produce a Russian PDF/Typst/Quarto copy, or fix tiny/broken translated tables and charts.
---

# Translate Paper RU

## Core Rule

Translate the meaning yourself. Do not use external translation services or ask tools to understand/translate the text. Tools are allowed for extraction, OCR, layout analysis, rendering, packaging, and QA.

Prefer a faithful, readable Russian academic style over word-for-word calques. Keep stable abbreviations and dataset names when they are conventional: JEL, ACS, BGT, HWOL, BLS, BA+, p-values, model numbers, source names, and citation metadata.

## Workflow

1. Inspect the source PDF before choosing a format.
   - Count pages, detect text pages, tables, figures, appendices, rotation, and scanned pages.
   - Extract rough text with PyMuPDF/pdfplumber/pdftotext only as source material.
   - Render representative pages with `pdftoppm` and visually inspect them.

2. Choose the rebuild path.
   - Use Typst by default for paper-like PDFs where layout, tables, landscape pages, and final PDF quality matter.
   - Use Quarto when the target is more like a reproducible article with citations, markdown, and HTML/PDF variants.
   - Avoid direct PDF text overlay for long academic papers unless the user explicitly needs a visual patch; it usually breaks line wrapping, tables, and figures.

3. Reflow body text instead of copying original page breaks.
   - Preserve logical sections, title page, footnotes where practical, and appendix/table page boundaries.
   - Do not force one translated page per original page; Russian text length differs and creates half-empty pages.
   - Keep paragraphs justified and use a conservative academic font such as Times New Roman.

4. Rebuild tables as editable structured tables.
   - Do not leave tables as raw monospaced `pdftotext` dumps except for temporary debugging.
   - In Typst, use `#table(...)` with explicit columns, alignments, insets, strokes, and landscape pages for wide tables.
   - Parse numeric tables by cell positions and numeric tokens, not only by whitespace. Watch for glued numbers like `61,846.001,179.79`.
   - Split numeric bundles into neighboring empty columns when PDF extraction merges multiple estimates into one cell.
   - Translate titles, headers, row labels, notes, and source lines. Search the generated source for English leftovers.
   - Increase table font only as far as the grid survives. Wide descriptive tables may need a smaller size than 4-column regression tables.

5. Translate figures and images.
   - If a figure is mostly visual with labels, crop/render it at high resolution and overlay Russian labels, or rebuild the chart when data is available.
   - Do not leave tiny broken charts at the bottom of pages. Use full-width images or landscape pages where needed.
   - Translate captions, axes, legends, source notes, and callouts. Keep dataset names and units stable.

6. Validate by rendering, not by trusting the compiler.
   - Compile: `typst compile outputs/name.typ outputs/name.pdf`
   - Render checks: `pdftoppm -png -r 140 -f PAGE -l PAGE -singlefile outputs/name.pdf work/render/p-PAGE`
   - Inspect title page, dense text pages, every table style, and every figure style.
   - Run targeted searches such as:
     `rg -n "All specifications|weighted by|Sample excludes|Standard errors|Figure|Table|Delta|Share|Initial|with" outputs/name.typ`
   - Fix visual issues and rebuild until the result is readable.

7. Deliver both PDF and editable source.
   - Put final user-facing files under the thread `outputs/` directory when working in a projectless Codex chat.
   - Link the final PDF and `.typ`/`.qmd` in the final answer.
   - Mention any residual risks only if they matter, such as scanned low-resolution source figures or tables whose source extraction was ambiguous.

## Typst Defaults

Use these defaults unless the current paper suggests otherwise:

- Body pages: portrait letter or original page size, Times New Roman 10pt, justified paragraphs.
- Table pages: landscape, margins around 24-30pt, title around 9pt, notes around 7pt.
- Table font heuristic:
  - 4-5 columns: about 9pt.
  - 6-7 columns: about 8pt.
  - 8-10 columns: about 6.5-7pt.
  - 11-13 columns: about 5.5-6pt.
  - 14+ columns: about 4.5-5pt, or split/restructure if unreadable.
- Figures: render/crop at 2x or higher, place at 90-124% width depending on readability.

## Red Flags

- Text pages are half-empty because original page breaks were preserved.
- Tables are dumped as raw text or screenshots when they need to be read.
- Charts are all pushed to the end of the PDF.
- Russian labels are visibly smaller than surrounding English source layout.
- Table notes still contain phrases like `All specifications`, `Sample excludes`, `weighted by`, or `Standard errors`.
- The PDF compiled successfully but no rendered PNGs were inspected.

## User-Facing Style

Answer in Russian for Russian translation tasks. Be direct about the state of the artifact: what was rebuilt, what was visually checked, and where the final files are.
