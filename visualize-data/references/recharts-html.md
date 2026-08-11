# Recharts HTML

Use this reference whenever the selected delivery surface is a self-contained HTML report or dashboard, including Codex explicit HTML, ChatGPT web Work Mode, and HTML used for PDF, Google Docs, or Google Slides conversion. It does not apply to MCP app artifacts or explicit standalone Python/static-image output.

Resolve `<DATA_ANALYTICS_PLUGIN_DIR>` to the installed Data Analytics plugin root, three directories above this reference. Relative paths below are from this reference.

## Delivery Contract

- Build a self-contained HTML file from the app-style shell at ../../../assets/html-report-shell.html. Replace `{{REPORT_AUDIENCE}}` with the selected audience before handoff.
- Keep narrative, KPI cards, tables, caveats, and source text as static semantic HTML. Keep table cards on the shell's shared reading width; reserve `.wide` for chart cards. Wrap every semantic table directly in `.table-scroll` and preserve the shell's table patterns so narrow tables fill their card, wide tables scroll inside it, and all tables remain readable without JavaScript.
- Upgrade chart placeholders with the packaged Recharts runtime by running ../../build-report/scripts/embed_html_report_runtime.py; the helper keeps the precompiled runtime compressed and defers the live upgrade until the static fallback has painted. Do not paste the raw runtime into the report; do not install npm packages, run Vite, use a CDN, copy the full MCP artifact bundle, patch minified symbols, import mcp-host.js, or depend on /api/*, fetch, or required localStorage.
- Every chart needs a readable data-recharts-fallback rendered directly in the authored HTML from the same reviewed rows as the Recharts payload. Prefer a compact inline SVG for line, bar, area, scatter, and composition charts; use a compact semantic table when a faithful static SVG would be risky. The live Recharts mount replaces the fallback only after it produces a supported rendered chart surface, including non-SVG leaderboard and heatmap panels, so the report remains readable when scripts are suppressed or a conversion helper reads static HTML.
- Keep fallback labels inside the SVG viewBox with edge padding. On wide layouts, keep at least 96px of left gutter around live charts so exact currency ticks remain inside clipped report cards. On narrow layouts, use compact symmetric chart padding so the plot keeps a readable width. For signed horizontal bars, keep negative value labels inside the bar or on its zero side, never in the category-label lane.
- For waterfall, bridge, variance, and other delta-focused charts where zero would materially compress the intended movement, use the renderer's focused value-axis domain and preserve honesty with exact start/end/change labels plus a clear scale cue.
- Give every live chart an explicit height of at least 280; use 320 by default and more for dense labels or many horizontal bars.
- Keep the delivered file self-contained: no sibling chart images, local runtime paths, remote scripts, or remote stylesheets.

## Report Section Maps

The bundled shell is the stakeholder/executive scaffold. When the selected report specification is technical, replace its `<main>` section map before authoring; do not merely rename the executive summary. Preserve these `data-contract-section` roles in order: `title`, `technical-summary`, `key-findings`, `scope-data-and-metric-definitions`, `methodology`, `limitations-uncertainty-and-robustness-checks`, `recommended-next-steps`, and `further-questions`. Set `data-report-audience="technical"`.

## HTML Placeholder Shape

Each chart card needs one host whose data-recharts-chart value matches a payload chart id:

~~~html
<div data-recharts-chart="weekly-growth">
  <div class="chart-fallback" data-recharts-fallback>
    <svg viewBox="0 0 960 420" role="img" aria-label="Weekly growth trend">
      <!-- Static marks generated from the same rows as the payload. -->
    </svg>
  </div>
  <div data-recharts-live aria-hidden="true"></div>
</div>
~~~

Leave exactly one <!-- DATA_ANALYTICS_HTML_REPORT_RUNTIME --> marker before </body>. The embedding helper replaces that marker with safely escaped payload JSON plus the precompiled runtime.

## Payload Shape

Write a separate JSON file with one entry per chart. Use reviewed row objects in dataset.data and the same canonical chart contract used by the app renderer. encodings.y must reference numeric data; percent formats use fractional values such as 0.193 for 19.3%. For multi-series charts, prefer long rows with one numeric y field and one color field so the legend uses reader-facing series values.

~~~json
{
  "charts": [
    {
      "id": "weekly-growth",
      "height": 320,
      "type": "line",
      "dataset": {
        "id": "weekly-growth",
        "title": "Weekly growth",
        "data": [
          { "week": "2026-04-06", "series": "Signups", "value": 1080 },
          { "week": "2026-04-06", "series": "Paid conversions", "value": 214 },
          { "week": "2026-04-13", "series": "Signups", "value": 1122 },
          { "week": "2026-04-13", "series": "Paid conversions", "value": 224 }
        ],
        "chart_spec": {
          "id": "weekly-growth",
          "dataset": "weekly-growth",
          "title": "Weekly growth",
          "type": "line",
          "encodings": {
            "x": { "field": "week", "type": "temporal" },
            "y": { "field": "value", "label": "Weekly count", "type": "quantitative" },
            "color": { "field": "series", "type": "nominal" }
          },
          "xAxisTitle": "",
          "yAxisTitle": "",
          "valueFormat": "number"
        }
      }
    }
  ]
}
~~~

For horizontal bars, keep the category in encodings.x, the numeric measure in encodings.y, and set settings: { "orientation": "horizontal", "groupMode": "grouped" }. Keep tooltip encodings as an array of encoding objects when they are needed. Set axis titles explicitly; use empty strings when the visible header/subtitle already carries the unit and field-name titles would add clutter.

## Build And QA

1. Copy and adapt ../../../assets/html-report-shell.html into a scratch/output HTML shell. Keep the selected audience specification's required data-contract-section attributes when the artifact is a report; for technical reports, use the complete technical section map above.
2. Author the static narrative, metric cards, semantic tables, and same-data chart fallbacks. Add one data-recharts-chart host and one payload entry per chart.
3. Run:

   ~~~bash
   python3 <DATA_ANALYTICS_PLUGIN_DIR>/skills/build-report/scripts/embed_html_report_runtime.py \
     --input report-shell.html \
     --payload report-payload.json \
     --output report.html
   ~~~

4. Open the delivered HTML itself. With scripts enabled, confirm each live mount contains an SVG, the fallback is replaced, chart labels fit, and there are no console errors. Keep exactly one host per payload chart; counting hosts is not a rendered-chart check, so visually confirm that each host has only one visible chart after the fallback/live swap. Check that live text stays inside its card and that bar value labels do not intersect category-axis labels. With scripts disabled or removed, confirm the fallback, tables, narrative, and source context remain readable.
5. Inspect desktop and narrow widths. Confirm every table card aligns to the reading column, narrow tables fill their card, wide tables scroll inside `.table-scroll`, and the document itself never gains horizontal overflow. Fix clipping, overflow, long labels, inconsistent scales, or mismatched fallback/payload values before handoff.

If the packaged runtime parts or embedding helper are unavailable, do not install dependencies or improvise a CDN runtime. Deliver the same semantic HTML with its same-data static fallbacks and label the missing live Recharts upgrade as a delivery limitation.
