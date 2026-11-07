const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildFunctionalHtml } = require("../scripts/generate-liquid-glass-functional");

const ROOT = path.resolve(__dirname, "..", "..");
const INDEX_HTML = path.join(ROOT, "index.html");
const LIQUID_GLASS_FUNCTIONAL_HTML = path.join(ROOT, "index-liquid-glass-functional.html");

function collectHtmlIds(html) {
  return new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]));
}

function extractAppScript(html) {
  const markerIndex = html.indexOf("const APP_VERSION");
  assert.notEqual(markerIndex, -1, "app script should contain APP_VERSION");
  const start = html.lastIndexOf("<script>", markerIndex);
  const end = html.indexOf("</script>", markerIndex);
  assert.notEqual(start, -1, "app script opening tag should exist");
  assert.notEqual(end, -1, "app script closing tag should exist");
  return html.slice(start, end + "</script>".length);
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

test("liquid glass functional UI copy preserves the production feature surface", () => {
  assert.ok(fs.existsSync(LIQUID_GLASS_FUNCTIONAL_HTML), "functional liquid-glass UI copy should exist");
  const production = fs.readFileSync(INDEX_HTML, "utf8");
  const liquid = fs.readFileSync(LIQUID_GLASS_FUNCTIONAL_HTML, "utf8");
  assert.equal(liquid, buildFunctionalHtml(production), "functional liquid-glass UI copy should be generated from index.html");
  assert.equal(
    sha256(extractAppScript(liquid)),
    sha256(extractAppScript(production)),
    "functional liquid-glass UI copy should keep shared JavaScript byte-for-byte identical"
  );
  const productionIds = collectHtmlIds(production);
  const liquidIds = collectHtmlIds(liquid);
  const missingIds = Array.from(productionIds).filter((id) => !liquidIds.has(id));

  assert.deepEqual(missingIds, [], "new UI copy should keep every production DOM id so existing JS wiring still works");
  [
    "const APP_VERSION",
    "function processRecordCandidates(",
    "function renderRecordProtocolUi(",
    "function handleCharacterTrainingCapture(",
    "function startTrainingSession(",
    "function renderCalendar(",
    "function renderPlan(",
    "function callAiCoach("
  ].forEach((marker) => assert.ok(liquid.includes(marker), `new UI copy should include ${marker}`));
  assert.match(liquid, /data-liquid-glass-functional-ui/);
  assert.match(liquid, /--lgf-surface/);
  assert.match(liquid, /max-width:1180px !important/);
  assert.match(liquid, /safe-area-inset-bottom/);
  assert.match(liquid, /100svh/);
  assert.doesNotMatch(liquid, /data-liquid-glass-structure/);
  assert.doesNotMatch(liquid, /class="lgf-workbench"/);
  assert.doesNotMatch(liquid, /data-lgf-tab-target=/);
  assert.doesNotMatch(liquid, /data-lgf-open-ai/);
  assert.doesNotMatch(liquid, /\.tabs\s*\{[\s\S]*?position:fixed !important/);
  assert.doesNotMatch(liquid, /\.tab\s*\{[\s\S]*?min-height:48px !important/);
  assert.match(liquid, /#plan\.section\.active[\s\S]*grid-template-columns/);
  assert.match(liquid, /#record\.section\.active\s*\{[\s\S]*grid-template-columns:1fr/);
  assert.doesNotMatch(liquid, /#record\.section\.active > \.card:first-child\s*\{[\s\S]*display:grid/);
  assert.match(liquid, /#tools\.section\.active\s*\{[\s\S]*grid-template-columns:1fr/);
});
