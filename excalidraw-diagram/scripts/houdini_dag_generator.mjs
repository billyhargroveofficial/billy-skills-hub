import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

const ROOT = process.env.DIAGRAM_ROOT || process.cwd();
const OUT = process.env.DIAGRAM_OUT || path.join(ROOT, "outputs", "excalidraw");
const VAULT = process.env.DIAGRAM_VAULT || "/Users/billy/Documents/billynotes";
const BASENAME = process.env.DIAGRAM_BASENAME || "houdini-dag-diagram";
const NOW = Date.now();

const C = {
  primaryFill: "#3b82f6",
  primaryStroke: "#1e3a5f",
  secondaryFill: "#60a5fa",
  tertiaryFill: "#93c5fd",
  startFill: "#fed7aa",
  startStroke: "#c2410c",
  successFill: "#a7f3d0",
  successStroke: "#047857",
  warnFill: "#fee2e2",
  warnStroke: "#dc2626",
  decisionFill: "#fef3c7",
  decisionStroke: "#b45309",
  aiFill: "#ddd6fe",
  aiStroke: "#6d28d9",
  inactiveFill: "#dbeafe",
  inactiveStroke: "#1e40af",
  errorFill: "#fecaca",
  errorStroke: "#b91c1c",
  title: "#1e40af",
  subtitle: "#3b82f6",
  body: "#64748b",
  text: "#374151",
  dark: "#1e293b",
  dataGreen: "#22c55e",
  white: "#ffffff",
  bg: "#ffffff",
  panelFill: "#f8fafc",
  panelStroke: "#94a3b8",
};

const FONT_SCALE = 1.1;

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: AllPackages });
const svgJax = new SVG({ fontCache: "none" });
const mjDoc = mathjax.document("", { InputJax: tex, OutputJax: svgJax });

let elements = [];
let files = {};
let embedded = [];
let order = 0;
let seed = 10000;

function nextIndex() {
  return `a${String(order++).padStart(4, "0")}`;
}

function nextSeed() {
  seed += 7919;
  return seed;
}

function safeId(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 56);
}

function base(type, eid, x, y, width = 0, height = 0, extra = {}) {
  return {
    type,
    id: eid,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: C.primaryStroke,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: nextIndex(),
    roundness: type === "rectangle" ? { type: 3 } : null,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    isDeleted: false,
    boundElements: null,
    updated: NOW,
    link: null,
    locked: false,
    ...extra,
  };
}

function estimateLineWidth(line, fontSize, mono = true) {
  let units = 0;
  for (const ch of line) {
    if (/[A-Z]/.test(ch)) units += mono ? 0.62 : 0.68;
    else if (/[a-z0-9_]/.test(ch)) units += mono ? 0.58 : 0.54;
    else if (/[^\x00-\x7F]/.test(ch)) units += 0.95;
    else if (ch === " ") units += 0.34;
    else units += 0.48;
  }
  return units * fontSize;
}

function wrapText(input, maxWidth, fontSize = 16, mono = true) {
  const hardLines = String(input).split("\n");
  const out = [];
  for (const hard of hardLines) {
    if (hard.trim() === "") {
      out.push("");
      continue;
    }
    const words = hard.split(/(\s+)/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line}${word}` : word.trimStart();
      if (estimateLineWidth(candidate, fontSize, mono) <= maxWidth || line === "") {
        line = candidate;
      } else {
        out.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    out.push(line.trimEnd());
  }
  return out.join("\n");
}

function text(eid, label, x, y, width, opts = {}) {
  const fontSize = Math.round((opts.fontSize ?? 16) * (opts.noScale ? 1 : FONT_SCALE));
  const lineHeight = opts.lineHeight ?? 1.18;
  const mono = opts.fontFamily !== 1;
  const wrapped = opts.noWrap ? String(label) : wrapText(label, width, fontSize, mono);
  const lines = wrapped.split("\n");
  const height = opts.height ?? Math.ceil(lines.length * fontSize * lineHeight);
  const el = base("text", eid, x, y, width, height, {
    text: wrapped,
    originalText: String(label),
    rawText: String(label),
    fontSize,
    fontFamily: opts.fontFamily ?? 3,
    textAlign: opts.align ?? "left",
    verticalAlign: opts.valign ?? "top",
    strokeColor: opts.color ?? C.text,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: null,
    containerId: opts.containerId ?? null,
    autoResize: false,
    lineHeight,
    hasTextLink: false,
  });
  elements.push(el);
  return el;
}

function rect(eid, x, y, width, height, opts = {}) {
  const el = base("rectangle", eid, x, y, width, height, {
    strokeColor: opts.stroke ?? C.primaryStroke,
    backgroundColor: opts.fill ?? C.inactiveFill,
    strokeWidth: opts.strokeWidth ?? 2,
    strokeStyle: opts.strokeStyle ?? "solid",
    roundness: opts.roundness === false ? null : { type: 3 },
  });
  elements.push(el);
  return el;
}

function ellipse(eid, x, y, width, height, opts = {}) {
  const el = base("ellipse", eid, x, y, width, height, {
    strokeColor: opts.stroke ?? C.primaryStroke,
    backgroundColor: opts.fill ?? C.primaryFill,
    strokeWidth: opts.strokeWidth ?? 2,
  });
  elements.push(el);
  return el;
}

function diamond(eid, x, y, width, height, opts = {}) {
  const el = base("diamond", eid, x, y, width, height, {
    strokeColor: opts.stroke ?? C.decisionStroke,
    backgroundColor: opts.fill ?? C.decisionFill,
    strokeWidth: opts.strokeWidth ?? 2,
  });
  elements.push(el);
  return el;
}

function line(eid, pts, opts = {}) {
  const [x0, y0] = pts[0];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const el = base("line", eid, x0, y0, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), {
    strokeColor: opts.stroke ?? C.body,
    backgroundColor: "transparent",
    strokeWidth: opts.strokeWidth ?? 1,
    strokeStyle: opts.strokeStyle ?? "solid",
    roundness: null,
    points: pts.map(([x, y]) => [x - x0, y - y0]),
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
  });
  elements.push(el);
  return el;
}

function arrow(eid, pts, opts = {}) {
  const [x0, y0] = pts[0];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const el = base("arrow", eid, x0, y0, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), {
    strokeColor: opts.stroke ?? C.primaryStroke,
    backgroundColor: "transparent",
    strokeWidth: opts.strokeWidth ?? 2,
    strokeStyle: opts.strokeStyle ?? "solid",
    roundness: null,
    points: pts.map(([x, y]) => [x - x0, y - y0]),
    startBinding: null,
    endBinding: null,
    startArrowhead: opts.startArrowhead ?? null,
    endArrowhead: opts.endArrowhead ?? "arrow",
    elbowed: false,
  });
  elements.push(el);
  if (opts.label) {
    const mid = pts[Math.floor(pts.length / 2)];
    text(`${eid}_label`, opts.label, mid[0] + 10, mid[1] - 24, opts.labelWidth ?? 180, {
      fontSize: opts.labelSize ?? 12,
      color: opts.labelColor ?? C.body,
      lineHeight: 1.06,
    });
  }
  return el;
}

function formulaSvgSource(latex, color = "#111827") {
  const node = mjDoc.convert(latex, { display: true });
  const outer = adaptor.outerHTML(node);
  const match = outer.match(/<svg[\s\S]*<\/svg>/);
  if (!match) throw new Error(`MathJax did not return SVG for ${latex}`);
  return match[0].replace(/currentColor/g, color);
}

function parseFormulaSize(svg, fontPx = 22) {
  const wMatch = svg.match(/width="([\d.]+)ex"/);
  const hMatch = svg.match(/height="([\d.]+)ex"/);
  const view = svg.match(/viewBox="[^"]*? [^"]*? ([\d.]+) ([\d.]+)"/);
  let w = wMatch ? Number(wMatch[1]) * fontPx * 0.53 : (view ? Number(view[1]) * 0.016 : 220);
  let h = hMatch ? Number(hMatch[1]) * fontPx * 0.53 : (view ? Number(view[2]) * 0.016 : 60);
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

function formula(eid, latex, x, y, opts = {}) {
  const svg = formulaSvgSource(latex, opts.color ?? "#111827");
  let { w, h } = parseFormulaSize(svg, opts.fontPx ?? 24);
  if (opts.maxWidth && w > opts.maxWidth) {
    const scale = opts.maxWidth / w;
    w = Math.ceil(w * scale);
    h = Math.ceil(h * scale);
  }
  if (opts.maxHeight && h > opts.maxHeight) {
    const scale = opts.maxHeight / h;
    w = Math.ceil(w * scale);
    h = Math.ceil(h * scale);
  }
  if (opts.minWidth && w < opts.minWidth) w = opts.minWidth;
  const fileId = safeId(eid.replace(/[^a-zA-Z0-9]/g, "")).padEnd(40, "0").slice(0, 40);
  const dataURL = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  files[fileId] = {
    mimeType: "image/svg+xml",
    id: fileId,
    dataURL,
    created: NOW,
    lastRetrieved: NOW,
  };
  embedded.push(`${fileId}: $$${latex}$$`);
  const el = base("image", `${eid}_img`, x, y, w, h, {
    strokeColor: "transparent",
    backgroundColor: "transparent",
    strokeWidth: 1,
    roundness: null,
    status: "saved",
    fileId,
    scale: [1, 1],
    crop: null,
    customData: { latex },
  });
  elements.push(el);
  return el;
}

function chip(eid, label, x, y, width, opts = {}) {
  const fill = opts.fill ?? C.inactiveFill;
  const stroke = opts.stroke ?? C.inactiveStroke;
  const h = opts.height ?? 28;
  const r = rect(`${eid}_chip`, x, y, width, h, {
    fill,
    stroke,
    strokeWidth: 1,
  });
  const t = text(`${eid}_text`, label, x + 10, y + 6, width - 20, {
    fontSize: opts.fontSize ?? 11,
    color: opts.color ?? stroke,
    noScale: true,
    align: opts.align ?? "center",
    containerId: r.id,
    lineHeight: 1.0,
  });
  r.boundElements = [{ id: t.id, type: "text" }];
  return { box: r, text: t };
}

function formulaCard(eid, title, latex, x, y, width, opts = {}) {
  const boxH = opts.height ?? 132;
  const r = rect(`${eid}_box`, x, y, width, boxH, {
    fill: opts.fill ?? "#ffffff",
    stroke: opts.stroke ?? C.primaryStroke,
    strokeWidth: opts.strokeWidth ?? 1,
  });
  const titleEl = text(`${eid}_title`, title, x + 18, y + 15, width - 36, {
    fontSize: opts.titleSize ?? 13,
    color: opts.stroke ?? C.primaryStroke,
    noWrap: opts.titleNoWrap ?? false,
    lineHeight: 1.1,
    containerId: r.id,
  });
  const f = formula(`${eid}_formula`, latex, x + 18, y + 48, {
    fontPx: opts.fontPx ?? 22,
    maxWidth: width - 36,
    maxHeight: opts.maxFormulaHeight,
  });
  r.height = Math.max(boxH, f.height + 70);
  r.boundElements = [{ id: titleEl.id, type: "text" }, { id: f.id, type: "image" }];
  return { box: r, formula: f };
}

function card(eid, x, y, width, height, title, body, opts = {}) {
  const r = rect(`${eid}_box`, x, y, width, height, {
    fill: opts.fill ?? "#ffffff",
    stroke: opts.stroke ?? C.primaryStroke,
    strokeWidth: opts.strokeWidth ?? 1,
    strokeStyle: opts.strokeStyle ?? "solid",
  });
  const titleEl = text(`${eid}_title`, title, x + 18, y + 16, width - 36, {
    fontSize: opts.titleSize ?? 15,
    color: opts.titleColor ?? opts.stroke ?? C.primaryStroke,
    noWrap: opts.titleNoWrap ?? false,
    containerId: r.id,
    lineHeight: 1.08,
  });
  const bodyEl = text(`${eid}_body`, body, x + 18, y + 52, width - 36, {
    fontSize: opts.bodySize ?? 12,
    color: opts.bodyColor ?? C.text,
    containerId: r.id,
    lineHeight: opts.lineHeight ?? 1.18,
  });
  r.boundElements = [{ id: titleEl.id, type: "text" }, { id: bodyEl.id, type: "text" }];
  return { box: r, title: titleEl, body: bodyEl };
}

function darkTable(eid, x, y, width, height, title, lines) {
  return card(eid, x, y, width, height, title, lines.join("\n"), {
    fill: C.dark,
    stroke: "#0f172a",
    titleColor: C.white,
    bodyColor: C.dataGreen,
    titleSize: 14,
    bodySize: 10,
    lineHeight: 1.22,
  });
}

function dot(eid, cx, cy, opts = {}) {
  const d = opts.size ?? 12;
  return ellipse(eid, cx - d / 2, cy - d / 2, d, d, {
    fill: opts.fill ?? C.primaryFill,
    stroke: opts.stroke ?? opts.fill ?? C.primaryStroke,
    strokeWidth: opts.strokeWidth ?? 1,
  });
}

function port(eid, cx, cy, opts = {}) {
  return dot(eid, cx, cy, {
    size: opts.size ?? 13,
    fill: opts.fill ?? "#ffffff",
    stroke: opts.stroke ?? C.primaryStroke,
    strokeWidth: opts.strokeWidth ?? 2,
  });
}

function dotGrid(eid, x, y, colors, opts = {}) {
  const size = opts.size ?? 9;
  const gap = opts.gap ?? 7;
  const perRow = opts.perRow ?? 9;
  colors.forEach((fill, i) => {
    const cx = x + (i % perRow) * (size + gap);
    const cy = y + Math.floor(i / perRow) * (size + gap);
    dot(`${eid}_${i}`, cx, cy, { size, fill, stroke: fill });
  });
}

function backdrop(eid, title, x, y, w, h, opts = {}) {
  rect(`${eid}_box`, x, y, w, h, {
    fill: opts.fill ?? C.panelFill,
    stroke: opts.stroke ?? C.panelStroke,
    strokeWidth: 1,
  });
  text(`${eid}_title`, title, x + 22, y + 16, w - 44, {
    fontSize: 18,
    color: opts.titleColor ?? opts.stroke ?? C.title,
    noWrap: true,
  });
}

function node(eid, x, y, w, h, cfg) {
  const stroke = cfg.stroke ?? C.primaryStroke;
  const fill = cfg.fill ?? "#ffffff";
  const headerH = 38;
  const r = rect(`${eid}_box`, x, y, w, h, { fill, stroke, strokeWidth: cfg.strokeWidth ?? 2 });
  rect(`${eid}_header`, x, y, w, headerH, { fill: cfg.headerFill ?? stroke, stroke, strokeWidth: 0 });
  const level = text(`${eid}_level`, cfg.level, x + 14, y + 9, 58, {
    fontSize: 13,
    color: C.white,
    noWrap: true,
    containerId: r.id,
  });
  const titleEl = text(`${eid}_title`, cfg.title, x + 82, y + 8, w - 185, {
    fontSize: cfg.titleSize ?? 17,
    color: C.white,
    noWrap: true,
    containerId: r.id,
  });
  if (cfg.badge) {
    chip(`${eid}_badge`, cfg.badge, x + w - 92, y + 7, 72, {
      fill: cfg.badgeFill ?? "#ffffff",
      stroke,
      color: stroke,
      fontSize: 10,
      height: 24,
    });
  }
  chip(`${eid}_type`, cfg.type ?? "operator", x + 18, y + 52, 145, {
    fill: "#ffffff",
    stroke,
    fontSize: 10,
    height: 26,
  });
  chip(`${eid}_outchip`, cfg.output, x + w - 245, y + 52, 225, {
    fill: cfg.outputFill ?? C.inactiveFill,
    stroke: cfg.outputStroke ?? stroke,
    fontSize: 10,
    height: 26,
  });
  const summary = text(`${eid}_summary`, cfg.summary, x + 20, y + 88, w - 40, {
    fontSize: cfg.summarySize ?? 13,
    color: C.text,
    containerId: r.id,
    lineHeight: 1.12,
  });
  const dotColors = cfg.dots ?? [];
  if (dotColors.length) dotGrid(`${eid}_dots`, x + 22, y + h - 20, dotColors, { size: 8, gap: 6, perRow: 12 });
  const top = [x + w / 2, y];
  const bottom = [x + w / 2, y + h];
  const left = [x, y + h / 2];
  const right = [x + w, y + h / 2];
  port(`${eid}_in`, top[0], top[1], { stroke });
  port(`${eid}_out`, bottom[0], bottom[1], { stroke, fill: fill });
  port(`${eid}_left`, left[0], left[1], { stroke, fill: "#ffffff", size: 11 });
  port(`${eid}_right`, right[0], right[1], { stroke, fill: "#ffffff", size: 11 });
  r.boundElements = [
    { id: level.id, type: "text" },
    { id: titleEl.id, type: "text" },
    { id: summary.id, type: "text" },
  ];
  return { id: eid, x, y, w, h, top, bottom, left, right, stroke, box: r };
}

function dataWire(eid, from, to, label, opts = {}) {
  const x = from.bottom[0];
  const y0 = from.bottom[1] + 12;
  const y1 = to.top[1] - 12;
  arrow(eid, [[x, y0], [x, y1]], {
    stroke: opts.stroke ?? C.primaryStroke,
    strokeWidth: opts.strokeWidth ?? 4,
  });
  if (label) {
    chip(`${eid}_wire_label`, label, x + 22, (y0 + y1) / 2 - 14, opts.labelWidth ?? 270, {
      fill: "#ffffff",
      stroke: opts.labelStroke ?? C.panelStroke,
      color: opts.labelColor ?? C.body,
      fontSize: 10,
      height: 28,
      align: "left",
    });
  }
}

function sideConnector(eid, fromPt, nodePt, busX, label, opts = {}) {
  const stroke = opts.stroke ?? C.body;
  const busY = opts.busY ?? fromPt[1];
  line(`${eid}_stub_a`, [fromPt, [busX, busY]], {
    stroke,
    strokeWidth: opts.strokeWidth ?? 1.6,
    strokeStyle: opts.strokeStyle ?? "dashed",
  });
  dot(`${eid}_pinned`, busX, busY, { size: 12, fill: "#ffffff", stroke, strokeWidth: 2 });
  arrow(`${eid}_to_node`, [[busX, busY], [busX, nodePt[1]], nodePt], {
    stroke,
    strokeWidth: opts.strokeWidth ?? 1.6,
    strokeStyle: opts.strokeStyle ?? "dashed",
  });
  if (label) {
    text(`${eid}_label`, label, opts.labelX ?? (busX + 14), opts.labelY ?? (busY + 12), opts.labelWidth ?? 210, {
      fontSize: opts.labelSize ?? 11,
      color: opts.labelColor ?? C.body,
      lineHeight: 1.05,
    });
  }
}

function overviewChip(eid, label, x, y, w, opts = {}) {
  chip(eid, label, x, y, w, {
    fill: opts.fill ?? "#ffffff",
    stroke: opts.stroke ?? C.primaryStroke,
    color: opts.stroke ?? C.primaryStroke,
    fontSize: 12,
    height: 34,
  });
}

function codebookMini(x, y) {
  card("codebook_locked", x, y, 620, 260, "LOCKED side input: fixed codebook T", [
    "7-12 stable groups; K ~= 50-70 measurable leaves",
    "LLM may map evidence to TopicLeaf IDs only",
    "No generated one-hot columns from 1350 question bank",
  ].join("\n"), {
    fill: C.inactiveFill,
    stroke: C.inactiveStroke,
    titleSize: 15,
    bodySize: 12,
  });
  const groups = [
    ["nlp_llm", "rag / evals / prompts"],
    ["ml_core", "loss / validation / features"],
    ["math_stats", "probability / inference"],
    ["systems", "serving / tradeoffs"],
    ["coding", "python / algorithms"],
  ];
  line("codebook_tree_trunk", [[x + 42, y + 118], [x + 42, y + 230]], {
    stroke: C.inactiveStroke,
    strokeWidth: 2,
  });
  groups.forEach(([g, leaves], i) => {
    const yy = y + 124 + i * 25;
    line(`codebook_tree_branch_${i}`, [[x + 42, yy], [x + 92, yy]], {
      stroke: C.inactiveStroke,
      strokeWidth: 2,
    });
    dot(`codebook_tree_dot_${i}`, x + 94, yy, {
      size: 9,
      fill: i % 2 ? C.aiFill : C.inactiveFill,
      stroke: C.inactiveStroke,
    });
    text(`codebook_tree_group_${i}`, `${g}: ${leaves}`, x + 112, yy - 10, 430, {
      fontSize: 10,
      noScale: true,
      color: C.text,
      noWrap: true,
    });
  });
}

function statusSemantics(x, y) {
  const r = rect("status_semantics_box", x, y, 610, 285, {
    fill: "#ffffff",
    stroke: C.primaryStroke,
    strokeWidth: 1,
  });
  const titleEl = text("status_semantics_title", "Status semantics table", x + 18, y + 16, 570, {
    fontSize: 15,
    color: C.primaryStroke,
    containerId: r.id,
  });
  const bodyEl = text("status_semantics_body", [
    "present: evidence exists -> Z=1, E=1",
    "absent: visible-if-present passed -> Z=0, E=1",
    "insufficient_evidence: weak/noisy/ambiguous -> E=0",
    "not_recoverable: missing artifact blocks judgment -> E=0",
    "",
    "Rule: absent is not 'model did not find it'.",
  ].join("\n"), x + 18, y + 54, 330, {
    fontSize: 11,
    color: C.text,
    containerId: r.id,
    lineHeight: 1.16,
  });
  r.boundElements = [{ id: titleEl.id, type: "text" }, { id: bodyEl.id, type: "text" }];
  const rows = [
    ["present", C.successFill, C.successStroke],
    ["absent", C.warnFill, C.warnStroke],
    ["insufficient", C.decisionFill, C.decisionStroke],
    ["not_recoverable", C.inactiveFill, "#475569"],
  ];
  rows.forEach(([name, fill, stroke], i) => {
    chip(`status_badge_${safeId(name)}`, name, x + 365, y + 66 + i * 39, 205, {
      fill,
      stroke,
      color: stroke,
      height: 29,
      fontSize: 10,
    });
  });
}

function build() {
  const leftX = 100;
  const centerX = 950;
  const rightX = 1810;
  const w = 650;
  const h = 136;
  const busL = 810;
  const busR = 1710;
  const lineX = centerX + w / 2;

  text("title", "Interview topic extraction as a Houdini/TOP data network", 100, 60, 1760, {
    fontSize: 30,
    color: C.title,
    noWrap: true,
  });
  text("subtitle", "Follow the thick vertical wire for data. Side rails show evidence, assumptions, formulas, guardrails and audit metadata.", 102, 114, 1680, {
    fontSize: 15,
    color: C.body,
    noWrap: true,
  });

  const flowChips = [
    ["Corpus", C.startStroke],
    ["Evidence", C.aiStroke],
    ["Measurement", C.primaryStroke],
    ["Matrix", "#475569"],
    ["Estimands", C.successStroke],
    ["Audit", C.decisionStroke],
    ["Claims", C.successStroke],
  ];
  flowChips.forEach(([label, stroke], i) => {
    const x = 100 + i * 210;
    overviewChip(`overview_${i}`, label, x, 168, 170, { stroke });
    if (i < flowChips.length - 1) {
      arrow(`overview_arrow_${i}`, [[x + 175, 185], [x + 205, 185]], { stroke: C.body, strokeWidth: 2 });
    }
  });
  card("legend", 1810, 78, 620, 178, "Visual grammar", [
    "solid thick wire = typed data stream",
    "dashed side wire = reference / formula / audit",
    "small dots = work items or pinned routing dots",
    "badges carry state; big node fill carries type",
  ].join("\n"), {
    fill: C.panelFill,
    stroke: C.primaryStroke,
    titleSize: 15,
    bodySize: 12,
  });

  backdrop("bd_ingest", "01 SOURCE QUALITY", 78, 330, 2368, 780, { fill: "#fff7ed", stroke: C.startStroke });
  backdrop("bd_evidence", "02 EVIDENCE AND MEASUREMENT", 78, 1140, 2368, 700, { fill: "#faf5ff", stroke: C.aiStroke });
  backdrop("bd_reduce", "03 INTERVIEW-LEVEL REDUCTION", 78, 1870, 2368, 520, { fill: "#eef6ff", stroke: C.primaryStroke });
  backdrop("bd_est", "04 MATRIX, SEGMENT, ESTIMANDS", 78, 2420, 2368, 580, { fill: "#f8fafc", stroke: "#64748b" });
  backdrop("bd_audit", "05 AUDIT ENVELOPE AND CLAIMS", 78, 3030, 2368, 640, { fill: "#fffdf0", stroke: C.decisionStroke });
  backdrop("bd_lineage", "06 PER-TOPIC LINEAGE VIEW", 78, 3710, 2368, 520, { fill: "#ecfdf5", stroke: C.successStroke });

  line("left_evidence_bus", [[busL, 390], [busL, 3640]], {
    stroke: "#94a3b8",
    strokeWidth: 2,
    strokeStyle: "dashed",
  });
  line("right_reference_bus", [[busR, 390], [busR, 3640]], {
    stroke: "#94a3b8",
    strokeWidth: 2,
    strokeStyle: "dashed",
  });
  text("left_bus_label", "evidence / formula rail", busL - 154, 354, 190, {
    fontSize: 11,
    color: C.body,
    noWrap: true,
  });
  text("right_bus_label", "config / audit rail", busR + 14, 354, 190, {
    fontSize: 11,
    color: C.body,
    noWrap: true,
  });

  const y = {
    n0: 420,
    n1: 680,
    n2: 940,
    n3: 1210,
    n4: 1480,
    n5: 1760,
    n6: 2030,
    n7: 2300,
    n8: 2570,
    n9: 2840,
    n10: 3140,
    out: 3420,
  };

  const doneDots = [C.successStroke, C.successStroke, C.successStroke, C.successStroke, "#64748b", "#64748b", "#64748b", "#64748b", C.decisionStroke, C.successStroke, "#64748b", "#64748b"];
  const fanDots = [C.successStroke, C.successStroke, C.successStroke, C.decisionStroke, C.successStroke, "#64748b", C.successStroke, C.successStroke, C.successStroke, C.decisionStroke, "#64748b", "#64748b", C.successStroke, C.successStroke];

  const n0 = node("n0_contract", centerX, y.n0, w, h, {
    level: "L0",
    title: "CorpusContract",
    type: "contract",
    output: "CorpusScope + schema",
    summary: "Defines target population, corpus scope, sampling unit and allowed claims.",
    fill: "#ffffff",
    stroke: C.startStroke,
    headerFill: C.startStroke,
    badge: "LOCK",
    dots: [C.startStroke, C.startStroke, "#64748b", "#64748b"],
  });
  const n1 = node("n1_raw", centerX, y.n1, w, h, {
    level: "L1",
    title: "RawInterview[]",
    type: "source",
    output: "RawInterview[]",
    summary: "One work item per interview. Raw text remains the quote source of truth.",
    fill: C.startFill,
    stroke: C.startStroke,
    headerFill: C.startStroke,
    dots: doneDots,
  });
  const n2 = node("n2_quality", centerX, y.n2, w, h, {
    level: "L2",
    title: "QualityGate",
    type: "diagnostic",
    output: "Q_i + recoverability",
    summary: "Checks ASR quality, completeness, missing screen/code/task artifacts.",
    fill: C.decisionFill,
    stroke: C.decisionStroke,
    headerFill: C.decisionStroke,
    badge: "WARN",
    dots: [C.successStroke, C.decisionStroke, C.successStroke, C.errorStroke, "#64748b", C.successStroke],
  });
  const n3 = node("n3_events", centerX, y.n3, w, h, {
    level: "L3",
    title: "EventExtractor",
    type: "LLM + parser",
    output: "QuestionEvent[]",
    summary: "Transforms transcript into ordered evidence events with quote spans.",
    fill: C.aiFill,
    stroke: C.aiStroke,
    headerFill: C.aiStroke,
    badge: "FANOUT",
    dots: fanDots,
  });
  const n4 = node("n4_topic", centerX, y.n4, w, h, {
    level: "L4",
    title: "TopicCoder",
    type: "measurement",
    output: "EventTopicLink[]",
    summary: "Maps events to fixed TopicLeaf IDs and asked_status without inventing columns.",
    fill: C.aiFill,
    stroke: C.aiStroke,
    headerFill: C.aiStroke,
    badge: "T LOCK",
    dots: fanDots,
  });
  const n5 = node("n5_reduce", centerX, y.n5, w, h, {
    level: "L5",
    title: "InterviewTopicReducer",
    type: "reducer",
    output: "TopicCell[i,t]",
    summary: "Collapses many event links to one interview-topic cell: status, Z, E, C, L.",
    fill: "#eef6ff",
    stroke: C.primaryStroke,
    headerFill: C.primaryStroke,
    badge: "COLLAPSE",
    dots: [C.successStroke, C.successStroke, C.warnStroke, C.decisionStroke, "#64748b", "#64748b"],
  });
  const n6 = node("n6_matrix", centerX, y.n6, w, h, {
    level: "L6",
    title: "MatrixBuilder",
    type: "table builder",
    output: "AnalysisMatrix X",
    summary: "One row per interview: metadata, Q, axes, Z/E/C/L for fixed topic leaves.",
    fill: "#ffffff",
    stroke: "#475569",
    headerFill: "#475569",
    dots: doneDots,
  });
  const n7 = node("n7_segment", centerX, y.n7, w, h, {
    level: "L7",
    title: "SegmentView",
    type: "partition",
    output: "X_C",
    summary: "Every statistic first declares segment predicate A_i(C) and leakage flags.",
    fill: C.decisionFill,
    stroke: C.decisionStroke,
    headerFill: C.decisionStroke,
    badge: "NO LEAK",
    dots: [C.successStroke, C.successStroke, C.successStroke, C.decisionStroke, "#64748b"],
  });
  const n8 = node("n8_estimator", centerX, y.n8, w, h, {
    level: "L8",
    title: "EstimatorBank",
    type: "estimand",
    output: "Estimate[]",
    summary: "Computes prevalence, deltas, intensity, co-occurrence and transitions.",
    fill: C.successFill,
    stroke: C.successStroke,
    headerFill: C.successStroke,
    badge: "STAT",
    dots: doneDots,
  });
  const n9 = node("n9_audit", centerX, y.n9, w, h + 10, {
    level: "L9",
    title: "AuditEnvelope",
    type: "uncertainty",
    output: "AuditedEstimate[]",
    summary: "Adds Wilson CI, cluster bootstrap, label-noise correction and stress views.",
    fill: C.decisionFill,
    stroke: C.decisionStroke,
    headerFill: C.decisionStroke,
    badge: "AUDIT",
    dots: [C.successStroke, C.successStroke, C.decisionStroke, C.decisionStroke, C.successStroke, "#64748b", "#64748b", C.errorStroke],
  });
  const n10 = node("n10_claim", centerX, y.n10, w, h + 10, {
    level: "L10",
    title: "ClaimCompiler",
    type: "compiler",
    output: "ClaimObject[]",
    summary: "Turns audited estimates into structured claims with assumptions and failure modes.",
    fill: C.successFill,
    stroke: C.successStroke,
    headerFill: C.successStroke,
    badge: "SAFE",
    dots: [C.successStroke, C.successStroke, C.successStroke, C.decisionStroke, C.successStroke],
  });
  const out = node("n11_outputs", centerX, y.out, w, 142, {
    level: "OUT",
    title: "Research outputs",
    type: "reports",
    output: "roadmap + benchmark",
    summary: "Roadmap, differentiators, hiring benchmark, recruiting brief, limits.",
    fill: C.successFill,
    stroke: C.successStroke,
    headerFill: C.successStroke,
    badge: "VIEW",
    dots: [C.successStroke, C.successStroke, C.successStroke, C.successStroke],
  });

  const flow = [
    [n0, n1, "contracted corpus"],
    [n1, n2, "raw interviews"],
    [n2, n3, "raw + Q_i"],
    [n3, n4, "events + spans"],
    [n4, n5, "topic links"],
    [n5, n6, "TopicCell[i,t]"],
    [n6, n7, "X"],
    [n7, n8, "X_C"],
    [n8, n9, "Estimate[]"],
    [n9, n10, "AuditedEstimate[]"],
    [n10, out, "ClaimObject[]"],
  ];
  flow.forEach(([a, b, label], i) => dataWire(`main_${i}`, a, b, label, { labelWidth: i < 5 ? 260 : 225 }));

  card("contract_artifact", leftX, 390, 610, 160, "Corpus contract artifact", [
    "population: explicitly declared",
    "sampling unit: interview_i",
    "scope: representative OR corpus-only",
    "forbidden: population claims from convenience corpus",
  ].join("\n"), {
    fill: "#ffffff",
    stroke: C.startStroke,
    bodySize: 12,
  });
  formulaCard("infer_formula", "Inference target", "I_i\\sim\\mathcal{P}\\Rightarrow\\hat\\theta\\approx\\theta_{\\mathcal{P}},\\quad else\\ \\hat\\theta=\\theta_{corpus}", rightX, 390, 620, {
    stroke: C.startStroke,
    fontPx: 18,
    height: 126,
  });
  darkTable("raw_artifact", leftX, 650, 610, 210, "RawInterview sample", [
    "interview_id: int_0127",
    "raw_text: \"How would you evaluate a RAG system?\"",
    "source: public transcript",
    "role_title: ML Engineer",
    "invariant: quote spans always point back here",
  ]);
  card("assumption_stack", rightX, 560, 620, 230, "Assumption/config side rail", [
    "topic_definition_version",
    "minimum evidence threshold",
    "taxonomy policy + merge threshold",
    "prompt_hash, model_id, seed, temperature",
    "language/domain/redaction policy",
  ].join("\n"), {
    fill: C.decisionFill,
    stroke: C.decisionStroke,
    bodySize: 12,
  });
  card("quality_mask", leftX, 910, 610, 210, "QualityGate output", [
    "Q_i.asr_quality",
    "Q_i.context_completeness",
    "Q_i.speaker_attribution",
    "artifact_gap: editor/code/screen/task missing",
    "usable_i and recoverability_mask",
  ].join("\n"), {
    fill: C.decisionFill,
    stroke: C.decisionStroke,
    bodySize: 12,
  });
  formulaCard("quality_formula", "Recoverability mask", "usable_i=\\mathbf{1}(Q_i.asr\\ge q_{min}\\land Q_i.context\\ge c_{min})", rightX, 835, 620, {
    stroke: C.decisionStroke,
    fontPx: 20,
    height: 128,
  });
  card("not_recoverable_note", rightX, 982, 620, 120, "Origin of not_recoverable", "A topic can be real but absent from transcript artifacts. That is not counted as absence.", {
    fill: C.decisionFill,
    stroke: C.decisionStroke,
    titleSize: 14,
    bodySize: 12,
  });

  darkTable("event_table", leftX, 1185, 610, 250, "QuestionEvent[] evidence rows", [
    "event | interview | order | type        | quote",
    "e044  | int_0127  | 04    | system_des  | \"eval RAG\"",
    "e045  | int_0127  | 05    | follow_up   | \"which metrics\"",
    "fields: char_start, char_end, speaker_role, confidence",
    "events are evidence rows, not sampling units",
  ]);
  formulaCard("quote_formula", "Quote trace", "quote_{i,j}=raw\\_text_i[char\\_start_{i,j}:char\\_end_{i,j}]", rightX, 1185, 620, {
    stroke: C.aiStroke,
    fontPx: 18,
    height: 126,
  });
  formulaCard("order_formula", "Conversation order", "E_{i,1}\\prec E_{i,2}\\prec\\dots\\prec E_{i,m_i}", rightX, 1330, 620, {
    stroke: C.aiStroke,
    fontPx: 22,
    height: 110,
  });
  formulaCard("asked_formula", "Asked-status filter", "A^{asked}_{i,j,t}=A_{i,j,t}\\cdot\\mathbf{1}(asked\\_status=asked)", leftX, 1472, 610, {
    stroke: C.aiStroke,
    fontPx: 22,
    height: 126,
  });
  formulaCard("count_depth_formula", "Count and depth", "C_{i,t}=\\sum_j A^{asked}_{i,j,t},\\qquad L_{i,t}=\\max_j d_{i,j,t}", leftX, 1615, 610, {
    stroke: C.aiStroke,
    fontPx: 20,
    height: 126,
  });
  codebookMini(rightX, 1480);

  statusSemantics(leftX, 1760);
  formulaCard("evaluable_formula", "Correct denominator gate", "E_{i,t}=1\\iff status_{i,t}\\in\\{present,absent\\}", rightX, 1760, 620, {
    stroke: C.primaryStroke,
    fontPx: 23,
    height: 124,
  });
  formulaCard("status_case_formula", "Status case rule", "status_{i,t}=\\begin{cases}present,&|P_{i,t}|>0\\\\not\\_recoverable,&artifact\\_gap_{i,t}=1\\\\insufficient,&weak\\ or\\ noisy\\\\absent,&visible\\mbox{-}if\\mbox{-}present\\ passes\\end{cases}", rightX, 1905, 620, {
    stroke: C.primaryStroke,
    fontPx: 18,
    height: 210,
  });
  darkTable("matrix_row", leftX, 2058, 610, 220, "AnalysisMatrix X row", [
    "id | asr | stage | domain_source | Z_rag | E_rag | C | L",
    "127| med | tech  | explicit_text  | 1     | 1     | 2 | 4",
    "128| low | live  | missing_art    | NA    | 0     | 0 | NA",
    "X_i stores Z and E separately.",
  ]);
  card("leakage_ledger", rightX, 2160, 620, 220, "Leakage ledger / rules bus", [
    "domain_source=question_content -> block domain-vs-topic claim",
    "Tier_i not inferred from difficulty_i",
    "D_i is not topic_count_i",
    "Every ClaimObject carries assumption + failure_modes",
  ].join("\n"), {
    fill: C.warnFill,
    stroke: C.warnStroke,
    bodySize: 12,
  });

  formulaCard("segment_formula", "Segment predicate", "A_i(C)=\\mathbf{1}\\{interview_i\\in C\\}", rightX, 2428, 620, {
    stroke: C.decisionStroke,
    fontPx: 25,
    height: 120,
  });
  formulaCard("prevalence_formula", "Main prevalence in segment C", "\\hat p_{t\\mid C}=\\frac{\\sum_i A_i(C)E_{i,t}Z_{i,t}}{\\sum_i A_i(C)E_{i,t}}", leftX, 2500, 610, {
    stroke: C.successStroke,
    fontPx: 25,
    height: 148,
  });
  formulaCard("secondary_formula", "Secondary estimands", "\\widehat\\Delta_{t,A-B}=\\hat p_{t\\mid A}-\\hat p_{t\\mid B},\\quad \\hat\\lambda_{t\\mid C}=\\frac{\\sum_i A_i(C)C_{i,t}}{\\sum_i A_i(C)}", rightX, 2590, 620, {
    stroke: C.successStroke,
    fontPx: 17,
    height: 150,
  });
  formulaCard("coocc_formula", "Co-occurrence / transition", "\\widehat P(b\\mid a,C)=\\frac{\\sum_i A_i(C)E_aE_bZ_aZ_b}{\\sum_i A_i(C)E_aE_bZ_a},\\quad \\hat T_{a\\to b}=\\frac{\\sum_iN_i(a\\to b)}{\\sum_iN_i(a\\to*)}", rightX, 2758, 620, {
    stroke: C.successStroke,
    fontPx: 15,
    height: 160,
  });

  formulaCard("wilson_formula", "Wilson interval", "CI_W=\\frac{\\hat p+z^2/(2m)}{1+z^2/m}\\pm\\frac{z}{1+z^2/m}\\sqrt{\\frac{\\hat p(1-\\hat p)}{m}+\\frac{z^2}{4m^2}}", leftX, 2850, 610, {
    stroke: C.decisionStroke,
    fontPx: 17,
    height: 150,
  });
  darkTable("audit_metadata", rightX, 3040, 620, 230, "Audit/reproducibility metadata", [
    "run_id, input_hashes, transcript_version",
    "code_commit, prompt_hash, model_id",
    "config_hash, output_checksums",
    "timings, token_cost, failed/retried steps",
    "support_count, rerun_stability, ambiguity_label",
  ]);
  formulaCard("label_noise_formula", "Label-noise correction", "p^*=\\frac{\\hat p-(1-\\mathrm{spec})}{\\mathrm{sens}+\\mathrm{spec}-1}", leftX, 3022, 610, {
    stroke: C.decisionStroke,
    fontPx: 24,
    height: 128,
  });
  formulaCard("stress_formula", "Stress view: unknown as absent", "\\hat p^{unknown0}_{t\\mid C}=\\frac{present}{present+absent+insufficient+not\\_recoverable}", rightX, 3290, 620, {
    stroke: "#475569",
    fontPx: 17,
    height: 126,
  });
  card("claim_schema", leftX, 3168, 610, 220, "ClaimObject schema", [
    "claim_id, text, conclusion_type",
    "segment_definition, estimand, estimator",
    "n_total, n_evaluable, estimate, CI",
    "assumptions, limitations, failure_modes",
    "business_action, overclaiming_warning",
  ].join("\n"), {
    fill: C.successFill,
    stroke: C.successStroke,
    bodySize: 12,
  });
  card("outputs_card", rightX, 3430, 620, 178, "Legit outputs", [
    "curriculum roadmap",
    "topic differentiators",
    "hiring benchmark",
    "recruiting brief",
    "limitations and audit appendix",
  ].join("\n"), {
    fill: C.successFill,
    stroke: C.successStroke,
    bodySize: 12,
  });

  const linkMap = [
    ["contract_artifact", [leftX + 610, 470], n0.left, busL, "contract"],
    ["infer_formula", [rightX, 455], n0.right, busR, "target"],
    ["raw_artifact", [leftX + 610, 745], n1.left, busL, "sample row"],
    ["assumption_stack", [rightX, 675], n1.right, busR, "config"],
    ["quality_mask", [leftX + 610, 1010], n2.left, busL, "Q_i"],
    ["quality_formula", [rightX, 900], n2.right, busR, "mask"],
    ["not_recoverable_note", [rightX, 1042], n2.right, busR, "artifact gap"],
    ["event_table", [leftX + 610, 1302], n3.left, busL, "events"],
    ["quote_formula", [rightX, 1248], n3.right, busR, "quote"],
    ["order_formula", [rightX, 1386], n3.right, busR, "order"],
    ["asked_formula", [leftX + 610, 1534], n4.left, busL, "asked"],
    ["count_depth_formula", [leftX + 610, 1678], n4.left, busL, "C,L"],
    ["codebook_locked", [rightX, 1610], n4.right, busR, "T"],
    ["status_semantics", [leftX + 610, 1902], n5.left, busL, "status"],
    ["evaluable_formula", [rightX, 1818], n5.right, busR, "E gate"],
    ["status_case_formula", [rightX, 2010], n5.right, busR, "case"],
    ["matrix_row", [leftX + 610, 2165], n6.left, busL, "row"],
    ["leakage_ledger", [rightX, 2275], n7.right, busR, "rules"],
    ["segment_formula", [rightX, 2490], n7.right, busR, "A_i(C)"],
    ["prevalence_formula", [leftX + 610, 2574], n8.left, busL, "main p"],
    ["secondary_formula", [rightX, 2664], n8.right, busR, "secondary"],
    ["coocc_formula", [rightX, 2838], n8.right, busR, "relations"],
    ["wilson_formula", [leftX + 610, 2924], n9.left, busL, "CI"],
    ["label_noise_formula", [leftX + 610, 3086], n9.left, busL, "noise"],
    ["audit_metadata", [rightX, 3155], n9.right, busR, "metadata"],
    ["stress_formula", [rightX, 3352], n9.right, busR, "stress"],
    ["claim_schema", [leftX + 610, 3278], n10.left, busL, "schema"],
    ["outputs_card", [rightX, 3518], out.right, busR, "views"],
  ];
  linkMap.forEach(([eid, from, to, busX, label], i) => {
    const stroke = String(eid).includes("formula") ? C.decisionStroke
      : String(eid).includes("codebook") ? C.inactiveStroke
      : String(eid).includes("leakage") ? C.warnStroke
      : String(eid).includes("outputs") || String(eid).includes("claim") ? C.successStroke
      : String(eid).includes("event") || String(eid).includes("asked") || String(eid).includes("count") ? C.aiStroke
      : C.body;
    sideConnector(`side_${i}_${eid}`, from, to, busX, label, {
      stroke,
      labelWidth: 140,
      labelX: busX === busL ? busX - 120 : busX + 16,
      labelY: from[1] + 8,
    });
  });

  buildLineageFrame(leftX, 3768, 2330);

  text("footer_rule", "Final rule: present + absent are evaluable; insufficient_evidence and not_recoverable are excluded from the main denominator. Unknown evidence is not absence.", 100, 4270, 2180, {
    fontSize: 17,
    color: C.title,
    noWrap: true,
  });
}

function buildLineageFrame(x, y, width) {
  text("lineage_title", "Per-topic lineage: why topic t appears in one final claim", x + 28, y, width - 56, {
    fontSize: 20,
    color: C.successStroke,
    noWrap: true,
  });
  const startY = y + 70;
  const nodes = [
    ["span", "QuoteSpan[]", "raw quote + char offsets", C.startFill, C.startStroke],
    ["event", "EventID[]", "ordered question events", C.aiFill, C.aiStroke],
    ["link", "TopicLink[]", "event maps to topic t", C.aiFill, C.aiStroke],
    ["cell", "TopicCell", "{status,Z,E,C,L}", "#eef6ff", C.primaryStroke],
    ["seg", "SegmentView", "A_i(C) selects rows", C.decisionFill, C.decisionStroke],
    ["est", "Estimate", "p_hat, CI, diagnostics", C.successFill, C.successStroke],
    ["claim", "ClaimObject", "text + assumptions + limits", C.successFill, C.successStroke],
  ];
  const gap = 22;
  const nw = 300;
  nodes.forEach(([key, title, body, fill, stroke], i) => {
    const nx = x + 28 + i * (nw + gap);
    const n = card(`lineage_${key}`, nx, startY, nw, 112, title, body, {
      fill,
      stroke,
      titleSize: 14,
      bodySize: 11,
    });
    if (i < nodes.length - 1) {
      arrow(`lineage_arrow_${i}`, [[nx + nw + 2, startY + 56], [nx + nw + gap - 4, startY + 56]], {
        stroke: C.successStroke,
        strokeWidth: 2,
      });
    }
    if (key === "span" || key === "event" || key === "est") {
      dotGrid(`lineage_${key}_dots`, nx + 22, startY + 94, [stroke, stroke, "#64748b", stroke], {
        size: 7,
        gap: 5,
        perRow: 6,
      });
    }
    n.box;
  });
  formulaCard("lineage_prevalence", "Estimator attached to lineage", "\\hat p_{t\\mid C}=\\frac{\\sum_i A_i(C)E_{i,t}Z_{i,t}}{\\sum_i A_i(C)E_{i,t}}", x + 28, y + 230, 680, {
    stroke: C.successStroke,
    fontPx: 23,
    height: 150,
  });
  card("lineage_audit", x + 750, y + 230, 560, 150, "Evidence audit checklist", [
    "support_count, span diversity, nearest competing topics",
    "agreement across prompts/models",
    "rerun stability and human-review flag",
  ].join("\n"), {
    fill: "#ffffff",
    stroke: C.decisionStroke,
    bodySize: 12,
  });
  card("lineage_bad_claim", x + 1350, y + 230, 650, 150, "Blocked claim examples", [
    "domain-vs-topic claim when domain_source came from question text",
    "population claim when CorpusContract says corpus-only",
    "causal claim without identification strategy",
  ].join("\n"), {
    fill: C.warnFill,
    stroke: C.warnStroke,
    bodySize: 12,
  });
}

function scene() {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: {
      theme: "light",
      viewBackgroundColor: C.bg,
      currentItemStrokeColor: C.primaryStroke,
      currentItemBackgroundColor: "transparent",
      currentItemFillStyle: "solid",
      currentItemStrokeWidth: 2,
      currentItemStrokeStyle: "solid",
      currentItemRoughness: 0,
      currentItemOpacity: 100,
      currentItemFontFamily: 3,
      currentItemFontSize: 16,
      currentItemTextAlign: "left",
      currentItemStartArrowhead: null,
      currentItemEndArrowhead: "arrow",
      scrollX: 240,
      scrollY: 120,
      zoom: { value: 0.18 },
      gridSize: 20,
    },
    files,
  };
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bounds() {
  const minX = Math.min(...elements.map((e) => e.x)) - 80;
  const minY = Math.min(...elements.map((e) => e.y)) - 80;
  const maxX = Math.max(...elements.map((e) => e.x + Math.max(1, e.width))) + 120;
  const maxY = Math.max(...elements.map((e) => e.y + Math.max(1, e.height))) + 120;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function previewSvg(sceneData) {
  const b = bounds();
  let defs = `<defs><marker id="arrow" markerWidth="11" markerHeight="11" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="${C.primaryStroke}"/></marker></defs>`;
  let body = "";
  for (const e of elements) {
    if (e.isDeleted) continue;
    if (e.type === "rectangle") {
      body += `<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" rx="${e.roundness ? 10 : 0}" fill="${e.backgroundColor}" stroke="${e.strokeColor}" stroke-width="${e.strokeWidth}"${e.strokeStyle === "dashed" ? ' stroke-dasharray="10 8"' : ""}/>`;
    } else if (e.type === "ellipse") {
      body += `<ellipse cx="${e.x + e.width / 2}" cy="${e.y + e.height / 2}" rx="${e.width / 2}" ry="${e.height / 2}" fill="${e.backgroundColor}" stroke="${e.strokeColor}" stroke-width="${e.strokeWidth}"/>`;
    } else if (e.type === "diamond") {
      const pts = [
        [e.x + e.width / 2, e.y],
        [e.x + e.width, e.y + e.height / 2],
        [e.x + e.width / 2, e.y + e.height],
        [e.x, e.y + e.height / 2],
      ].map((p) => p.join(",")).join(" ");
      body += `<polygon points="${pts}" fill="${e.backgroundColor}" stroke="${e.strokeColor}" stroke-width="${e.strokeWidth}"/>`;
    } else if (e.type === "line" || e.type === "arrow") {
      const pts = e.points.map(([px, py]) => `${e.x + px},${e.y + py}`).join(" ");
      const marker = e.type === "arrow" && e.endArrowhead ? ' marker-end="url(#arrow)"' : "";
      body += `<polyline points="${pts}" fill="none" stroke="${e.strokeColor}" stroke-width="${e.strokeWidth}"${e.strokeStyle === "dashed" ? ' stroke-dasharray="10 8"' : ""}${marker}/>`;
    } else if (e.type === "text") {
      const family = e.fontFamily === 3 ? "Menlo, Monaco, Consolas, monospace" : "Arial, sans-serif";
      const lines = e.text.split("\n");
      const dy = e.fontSize * e.lineHeight;
      let yy = e.y + e.fontSize;
      if (e.verticalAlign === "middle") yy = e.y + (e.height - lines.length * dy) / 2 + e.fontSize;
      let anchor = "start";
      let xx = e.x;
      if (e.textAlign === "center") {
        anchor = "middle";
        xx = e.x + e.width / 2;
      }
      body += `<text x="${xx}" y="${yy}" font-family="${family}" font-size="${e.fontSize}" fill="${e.strokeColor}" text-anchor="${anchor}">`;
      lines.forEach((ln, i) => {
        body += `<tspan x="${xx}" dy="${i === 0 ? 0 : dy}">${escapeXml(ln)}</tspan>`;
      });
      body += `</text>`;
    } else if (e.type === "image") {
      const f = sceneData.files[e.fileId];
      if (f) body += `<image x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" href="${f.dataURL}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${b.height}" viewBox="${b.minX} ${b.minY} ${b.width} ${b.height}">${defs}<rect x="${b.minX}" y="${b.minY}" width="${b.width}" height="${b.height}" fill="${C.bg}"/>${body}</svg>`;
}

function mdWrapper(sceneData) {
  const textElements = elements
    .filter((e) => e.type === "text")
    .map((e) => `${e.originalText}\n^${e.id.slice(0, 8)}`)
    .join("\n\n");
  return `---\nexcalidraw-plugin: parsed\ntags: [excalidraw, interview-research, methodology, houdini-dag]\n---\n\n# Excalidraw Data\n\n## Text Elements\n${textElements}\n\n## Embedded Files\n${embedded.join("\n")}\n\n%%\n## Drawing\n\`\`\`json\n${JSON.stringify(sceneData, null, 2)}\n\`\`\`\n%%\n`;
}

function verify() {
  const warnings = [];
  const byId = new Map(elements.map((e) => [e.id, e]));
  for (const e of elements) {
    if (e.type !== "text") continue;
    const maxLine = Math.max(...e.text.split("\n").map((ln) => estimateLineWidth(ln, e.fontSize, e.fontFamily !== 1)));
    if (maxLine > e.width * 1.04) {
      warnings.push(`text overflow risk: ${e.id} line=${Math.round(maxLine)} width=${Math.round(e.width)}`);
    }
    if (e.containerId && !byId.has(e.containerId)) {
      warnings.push(`missing container for ${e.id}: ${e.containerId}`);
    }
    if (e.containerId && byId.has(e.containerId)) {
      const c = byId.get(e.containerId);
      if (e.y + e.height > c.y + c.height - 8) {
        warnings.push(`text vertical overflow risk: ${e.id} bottom=${Math.round(e.y + e.height)} containerBottom=${Math.round(c.y + c.height)}`);
      }
    }
  }
  for (const e of elements) {
    if (e.type === "image" && !files[e.fileId]) warnings.push(`missing file for image ${e.id}`);
  }
  return warnings;
}

async function writeOutputs(sceneData) {
  fs.mkdirSync(OUT, { recursive: true });
  const jsonPath = path.join(OUT, `${BASENAME}.excalidraw`);
  const mdPath = path.join(OUT, `${BASENAME}.excalidraw.md`);
  const svgPath = path.join(OUT, `${BASENAME}.preview.svg`);
  const pngPath = path.join(OUT, `${BASENAME}.preview.png`);
  fs.writeFileSync(jsonPath, JSON.stringify(sceneData, null, 2), "utf8");
  fs.writeFileSync(mdPath, mdWrapper(sceneData), "utf8");
  const svg = previewSvg(sceneData);
  fs.writeFileSync(svgPath, svg, "utf8");
  await sharp(Buffer.from(svg)).png().toFile(pngPath);

  const b = bounds();
  const crops = [
    ["top", 0, 0, b.width, Math.min(1160, b.height)],
    ["evidence", 0, 1120, b.width, 860],
    ["estimation", 0, 2380, b.width, 840],
    ["audit-claims", 0, 3000, b.width, 780],
    ["lineage", 0, 3680, b.width, 680],
  ];
  for (const [name, x, y, w, h] of crops) {
    const xx = Math.max(0, Math.round(x));
    const yy = Math.max(0, Math.round(y));
    const ww = Math.min(Math.round(w), Math.round(b.width) - xx);
    const hh = Math.min(Math.round(h), Math.round(b.height) - yy);
    if (ww > 10 && hh > 10) {
      await sharp(pngPath)
        .extract({ left: xx, top: yy, width: ww, height: hh })
        .toFile(path.join(OUT, `houdini-v2-network-${name}.png`));
    }
  }

  fs.mkdirSync(VAULT, { recursive: true });
  const vaultJson = path.join(VAULT, `${BASENAME}.excalidraw`);
  const vaultMd = path.join(VAULT, `${BASENAME}.excalidraw.md`);
  fs.writeFileSync(vaultJson, JSON.stringify(sceneData, null, 2), "utf8");
  fs.writeFileSync(vaultMd, mdWrapper(sceneData), "utf8");
  return { jsonPath, mdPath, svgPath, pngPath, vaultJson, vaultMd };
}

async function main() {
  build();
  const sceneData = scene();
  const warnings = verify();
  const outputs = await writeOutputs(sceneData);
  const report = [
    `elements=${elements.length}`,
    `text=${elements.filter((e) => e.type === "text").length}`,
    `images=${elements.filter((e) => e.type === "image").length}`,
    `embedded_formulas=${embedded.length}`,
    `warnings=${warnings.length}`,
    ...warnings,
    `json=${outputs.jsonPath}`,
    `md=${outputs.mdPath}`,
    `vault_json=${outputs.vaultJson}`,
    `vault_md=${outputs.vaultMd}`,
    `preview_png=${outputs.pngPath}`,
  ].join("\n");
  fs.writeFileSync(path.join(OUT, `${BASENAME}.report.txt`), report, "utf8");
  console.log(report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
