---
name: obsidian-mindmap
description: >-
  Create or update detailed, recursively collapsible mind-map notes in Billy's Obsidian vault
  (billynotes) using Mindmap NextGen and markmap. Use when the user asks for a "майндмапа", mind map,
  интеллект-карта, structured tree, topic decomposition, or wants branches added, expanded, or folded
  in an existing map. Covers the required heading-and-list Markdown structure, plugin frontmatter,
  KaTeX formulas, vault naming and opening workflow, document and code-block modes, and Yandex S3 sync.
---

# Obsidian mindmaps (Mindmap NextGen / markmap)

Generate **detailed, deeply-nested, recursively-foldable** mindmap notes for the user's vault.
Reference (load with Read when you need the full template / options table): **`reference.md`**.

## Where things live
- Vault: **`~/Documents/billynotes/`** — put new mindmaps in the **root** unless the user says otherwise.
- Plugin: **Mindmap NextGen** `obsidian-mindmap-nextgen` (v1.16, **markmap** engine) — already installed & **enabled**.
- File naming: **`<Тема> (mindmap).md`** (the `(mindmap)` suffix is the user's convention; keeps them findable).
- Sync: Remotely Save → Yandex S3 picks it up on next Obsidian launch. If asked to "push it now", write local
  **and** `boto3 put_object` (creds: `[[billynotes-s3-sync]]` memory — base64(reversed(JSON)) in remotely-save `data.json`).

## How the format works (this IS the whole trick)
markmap builds the tree from **markdown structure**, in this order of depth:
1. **`# H1`** = the single **root node** (one per file).
2. **`## H2`, `### H3` …** = branch nodes (heading level = tree depth).
3. **Nested bullet lists** under a heading = leaf subtrees. **Indentation = nesting** → each level becomes a
   collapsible child. This is where the "recursively expand/collapse" comes from — every node with children
   gets a fold circle.

So: a few big `##` branches, optional `###` sub-branches, then go deep with indented `-` lists.
Keep node **text short** (a label, not a paragraph) — long nodes wrap ugly; use `maxWidth` to cap.

## Frontmatter (tune the default view)
```yaml
---
markmap:
  colorFreezeLevel: 2      # branches keep their color from depth 2 down (visual grouping)
  initialExpandLevel: 2    # how unfolded it opens; 1–2 for big maps, -1 = all open
  maxWidth: 320            # px cap on node width before wrapping; 0 = no cap
  spacingHorizontal: 80    # optional: spread nodes if cramped
  spacingVertical: 12
---
```
Full option list + a ready skeleton are in `reference.md`.

## Math = LaTeX (standing user rule)
markmap renders **KaTeX**, so put **all** math in `$...$` (inline) or `$$...$$` (block) — never plain/unicode.
e.g. `Scaled dot-product: $\text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right)V$`.
**Hard gotcha:** keep **Cyrillic OUT of math** — KaTeX in markmap chokes on Cyrillic inside `$...$` / `\text{}`.
Put the Russian label as plain node text, the formula in math right after it (same node or a child). Same spirit
as the Manim Cyrillic rule. See `[[math-latex-always]]`.

## Workflow
1. Decide root + 6–12 top-level `##` branches that cover the topic; go 3–5 levels deep where it earns it.
2. Write Cyrillic/EN labels short; formulas in `$...$`; emoji on top branches is fine (user likes it).
3. Write the file to the billynotes root as `<Тема> (mindmap).md`.
4. **Tell the user how to open it** (below) — they WILL hit the "opened as a normal note" gotcha otherwise.
5. Offer to extend (more branches / split a family into its own map / raise `initialExpandLevel`).

## Opening it — the #1 gotcha (don't skip in your reply)
Mindmap NextGen's **document mindmap does NOT toggle** like reading/preview view. To view a note as a map:
- Command palette (`Cmd+P`) → **"Mindmap NextGen: Pin"** (binds a map to the active note), then
  **"Mindmap NextGen: Open pinned mindmap"**.
- Suggest a hotkey on **Open pinned mindmap** for one-press access from any note.
- In the map: **fold circles on nodes** = recursive collapse/expand of that subtree; scroll = zoom, drag bg = pan.

**Alternative — code-block mode (auto-renders inline, no Pin needed):** put a fenced ` ```markmap ` block
inside any normal note; its body is the same heading/list markdown. Good for embedding a small map in a larger
note. Whole-file document mode is better for big standalone maps.

## Gotchas
- **"Opened as a normal note"** → not pinned; use Pin → Open pinned mindmap (or code-block mode). Most common confusion.
- markmap is **whitespace-sensitive**: indent list items consistently (2 spaces or a tab). Ragged indent = wrong tree.
- **One `# H1`** per document map (the root). Multiple H1s confuse the root.
- Cyrillic inside `$...$` → broken/blank math. Keep it out (see Math rule).
- Huge maps open slow/cramped → lower `initialExpandLevel` (1) and set `maxWidth`.
- Don't dump prose into a node; it's a label. Break detail into child nodes instead.

## Existing example on this machine
`~/Documents/billynotes/Глубокое обучение (mindmap).md` — 10 top branches (Основы, CNN, RNN/LSTM, Transformers,
VAE/GAN/Diffusion, эмбеддинги, парадигмы, регуляризация, практика), LaTeX formulas, `initialExpandLevel: 2`.
Copy its shape for new topic maps.
