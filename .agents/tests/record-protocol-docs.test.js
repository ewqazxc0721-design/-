const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..", "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("AI record protocol v1 docs preserve the candidate-based architecture decision", () => {
  const adr = readProjectFile("docs/adr/0001-use-candidate-based-ai-record-protocol.md");

  assert.match(adr, /Use candidate-based AI record protocol/i);
  assert.match(adr, /AI does not write final daily logs/i);
  assert.match(adr, /RecordProtocolEngine/);
  assert.match(adr, /visibleWeekDates/);
  assert.match(adr, /CaptureAttempt/);
  assert.match(adr, /correction/i);
});

test("AI record protocol v1 docs describe the public contract and final regression checklist", () => {
  const guide = readProjectFile("docs/ai-record-protocol-v1.md");
  const candidateTypes = [
    "plan_progress",
    "correction",
    "extra_training",
    "feedback",
    "body_state",
    "note",
    "consultation_request"
  ];

  assert.match(guide, /reply/);
  assert.match(guide, /record_candidates/);
  assert.match(guide, /function applyRecordProtocol/);
  for (const type of candidateTypes) {
    assert.match(guide, new RegExp(type));
  }
  for (const checklistItem of [
    "high-confidence plan_progress",
    "missing evidenceText",
    "visibleWeekDates",
    "correction candidates enter pending",
    "confirmed move_record_to_date",
    "CaptureAttempt",
    "aiCapture"
  ]) {
    assert.match(guide, new RegExp(checklistItem));
  }
});
