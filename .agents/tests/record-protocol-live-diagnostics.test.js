const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..", "..");
const INDEX_HTML = path.join(ROOT, "index.html");

function readMainScript() {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const start = html.indexOf("const APP_VERSION");
  const end = html.lastIndexOf("</script>");
  assert.notEqual(start, -1, "index.html should contain the main inline script");
  assert.notEqual(end, -1, "index.html should contain the closing script tag");
  return html.slice(start, end);
}

test("record protocol live diagnostics runner is installed and syntax-valid", () => {
  const script = readMainScript();

  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /window\.RecordProtocolLiveDiagnostics\s*=\s*Object\.freeze/);
  assert.match(script, /runRecordProtocolLiveScenarioTests/);
  assert.match(script, /gain-record-protocol-live-test-report/);
});

test("record protocol live diagnostics defines 100 real conversation scenarios across required categories", () => {
  const script = readMainScript();

  assert.match(script, /count\s*\|\|\s*100/);
  assert.match(script, /category:"add"/);
  assert.match(script, /category:"context_add"/);
  assert.match(script, /category:"modify"/);
  assert.match(script, /category:"delete"/);
  assert.match(script, /平板支撑/);
  assert.match(script, /把刚才.*改成/);
  assert.match(script, /删除刚才那条/);
  assert.match(script, /resolveRecordProtocolLiveScenarioDate/);
  assert.match(script, /昨天/);
  assert.match(script, /前天/);
  assert.match(script, /周六/);
});
test("record protocol live diagnostics keeps API error evidence in failed rows", () => {
  const script = readMainScript();

  assert.match(script, /extractAiResponseErrorMessage/);
  assert.match(script, /createAiResponseError/);
  assert.match(script, /rawResponsePreview:err\.rawResponsePreview/);
  assert.match(script, /responseKeys:Array\.isArray\(err\.responseKeys\)/);
});

test("record protocol live diagnostics persists a running report for long 100-case runs", () => {
  const script = readMainScript();

  assert.match(script, /const RECORD_PROTOCOL_LIVE_TEST_REPORT_KEY\s*=\s*"gain-record-protocol-live-test-report"/);
  assert.match(script, /function persistRecordProtocolLiveReport\(report = \{\}\)/);
  assert.match(script, /persistRecordProtocolLiveReport\(report\);\s*if\(!ready\)/);
  assert.match(script, /report\.results\.push\(stepResult\);[\s\S]*persistRecordProtocolLiveReport\(report\);[\s\S]*record-protocol-live-scenario-progress/);
  assert.match(script, /getLastReport\(\)\{[\s\S]*RECORD_PROTOCOL_LIVE_TEST_REPORT_KEY/);
});
