# Mindmap NextGen / markmap — reference

## Copy-paste skeleton

```markdown
---
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 2
  maxWidth: 320
---

# 🧠 Корневая тема

## 🅰️ Ветка A
### Подветка A1
- лист
  - под-лист
    - ещё глубже
- лист с формулой: $E = mc^2$
### Подветка A2
- ...

## 🅱️ Ветка B
- ...
```

Rules of thumb:
- **One `# H1`** = root. `##`/`###` = branches (heading depth = tree depth). Indented `-` lists = deeper leaves.
- 6–12 top branches; 3–5 levels deep where it earns it. Labels short — a node is a label, not a paragraph.
- Indent consistently (2 spaces **or** tab, don't mix) — markmap is whitespace-sensitive.

## Frontmatter options (markmap:)

| Key                 | What it does                                              | Good default        |
|---------------------|----------------------------------------------------------|---------------------|
| `initialExpandLevel`| Depth the map opens unfolded. `-1` = all open.           | `2` (big), `-1` (small) |
| `colorFreezeLevel`  | From this depth down, a subtree keeps one color (groups).| `2`                 |
| `maxWidth`          | px cap on node width before wrapping. `0` = no cap.       | `300`–`320`         |
| `spacingHorizontal` | Horizontal gap between node columns.                     | `80`                |
| `spacingVertical`   | Vertical gap between sibling nodes.                      | `12`                |
| `duration`          | Fold/unfold animation ms.                                | `500`               |
| `color`             | Array of hex colors cycled across branches.              | omit (auto)         |

Per-plugin (Settings → Mindmap NextGen): split direction, "Title as root node", coloring approach,
screenshot/export (SVG/PNG), highlight inline mindmap. Frontmatter beats global settings per-file.

## What markmap markdown supports
- **Inline:** `**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `[links](url)`, `[[wikilinks]]` (Obsidian-resolved).
- **Math:** KaTeX — `$inline$` and `$$block$$`. **No Cyrillic inside math.**
- **Lists:** nested `-`/`*`/`1.` → the nesting engine. Checkboxes `- [ ]` render too.
- **Images:** `![alt](path)` render in nodes (keep small).
- **Tables / blockquotes / fenced code:** render inside a node but bloat it — prefer breaking into child nodes.

## KaTeX cheat (renders in nodes)
- Fractions `\frac{a}{b}`, roots `\sqrt{x}`, subscripts/superscripts `x_i^2`.
- Vectors/matrices `\mathbf{x}`, `W^\top`, `\sum_i`, `\prod_i`, `\nabla_\theta`.
- Greek `\sigma \theta \epsilon \mu \eta \beta`, ops `\odot \cdot \times`, `\leftarrow`.
- Sizing `\!` (neg space), `\left( ... \right)` auto-size brackets.
- Functions: `\softmax` is NOT a macro → write `\text{softmax}` (Latin only) or `\operatorname{softmax}`.
- **Cyrillic label + formula pattern:** node text = `Скрытое состояние RNN:` then `$h_t = \tanh(W_h h_{t-1} + W_x x_t + b)$`.

## Code-block (inline) mode
Inside any normal note, no Pin needed — auto-renders where the block sits:

````markdown
```markmap
# Root
## Branch
- leaf
```
````

Document (whole-file) mode is better for big standalone maps; code-block for embedding a small one in prose.

## Opening a document mindmap (recap)
1. `Cmd+P` → **Mindmap NextGen: Pin**
2. `Cmd+P` → **Mindmap NextGen: Open pinned mindmap**
3. (optional) bind a hotkey to step 2. Fold circles = recursive collapse/expand; scroll = zoom; drag = pan.

## Push to Yandex S3 on demand (only if user asks "sync now")
Normally Remotely Save syncs on next Obsidian launch. To force it from here, write the file locally AND
`boto3 put_object` to bucket `billynotes` at `storage.yandexcloud.net` — creds live (obfuscated) in
`~/Documents/billynotes/.obsidian/plugins/remotely-save/data.json` key `d` = base64(reversed(JSON)).
See memory `[[billynotes-s3-sync]]`.
