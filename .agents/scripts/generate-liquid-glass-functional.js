#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const SOURCE_HTML = path.join(ROOT, "index.html");
const TARGET_HTML = path.join(ROOT, "index-liquid-glass-functional.html");

const LIQUID_GLASS_FUNCTIONAL_PATCH = `  <style id="liquidGlassFunctionalUiPatch" data-liquid-glass-functional-ui>
    :root[data-liquid-glass-functional-ui]{
      --lgf-surface:rgba(255,255,255,.82);
      --lgf-border:rgba(148,163,184,.26);
      --lgf-shadow:0 18px 48px rgba(15,23,42,.14);
    }
    html[data-liquid-glass-functional-ui],
    html[data-liquid-glass-functional-ui] body{
      min-height:100svh;
    }
    html[data-liquid-glass-functional-ui] body{
      padding-bottom:calc(16px + env(safe-area-inset-bottom));
    }
    html[data-liquid-glass-functional-ui] .app{
      max-width:1180px !important;
    }
    html[data-liquid-glass-functional-ui] #plan.section.active{
      display:grid;
      grid-template-columns:minmax(0,1fr);
      gap:14px;
    }
    html[data-liquid-glass-functional-ui] #record.section.active{
      display:grid;
      grid-template-columns:1fr;
      gap:14px;
    }
    html[data-liquid-glass-functional-ui] #tools.section.active{
      display:grid;
      grid-template-columns:1fr;
      gap:14px;
    }
  </style>`;

function buildFunctionalHtml(sourceHtml) {
  if (!sourceHtml.includes("<html lang=\"zh-CN\">")) {
    throw new Error("Expected production index root tag: <html lang=\"zh-CN\">");
  }
  if (!sourceHtml.includes("</style>\n</head>")) {
    throw new Error("Expected production index to close the main style before </head>");
  }
  return sourceHtml
    .replace("<html lang=\"zh-CN\">", "<html lang=\"zh-CN\" data-liquid-glass-functional-ui>")
    .replace("</style>\n</head>", `</style>\n${LIQUID_GLASS_FUNCTIONAL_PATCH}\n</head>`);
}

function main(argv = process.argv.slice(2)) {
  const checkOnly = argv.includes("--check");
  const sourceHtml = fs.readFileSync(SOURCE_HTML, "utf8");
  const generated = buildFunctionalHtml(sourceHtml);

  if (checkOnly) {
    const current = fs.existsSync(TARGET_HTML) ? fs.readFileSync(TARGET_HTML, "utf8") : "";
    if (current !== generated) {
      console.error("index-liquid-glass-functional.html is out of date.");
      console.error("Run: node .agents/scripts/generate-liquid-glass-functional.js");
      process.exitCode = 1;
    }
    return;
  }

  fs.writeFileSync(TARGET_HTML, generated, "utf8");
  console.log(`Generated ${path.relative(ROOT, TARGET_HTML)} from ${path.relative(ROOT, SOURCE_HTML)}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  LIQUID_GLASS_FUNCTIONAL_PATCH,
  buildFunctionalHtml,
};
