const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const INDEX_HTML = path.join(ROOT, "index.html");

const WEEK_DATES = [
  { iso: "2026-05-11", weekday: "\u5468\u4e00" },
  { iso: "2026-05-12", weekday: "\u5468\u4e8c" },
  { iso: "2026-05-13", weekday: "\u5468\u4e09" },
  { iso: "2026-05-14", weekday: "\u5468\u56db" },
  { iso: "2026-05-15", weekday: "\u5468\u4e94" },
  { iso: "2026-05-16", weekday: "\u5468\u516d" },
  { iso: "2026-05-17", weekday: "\u5468\u65e5" }
];

function createElement(id) {
  return {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    style: {},
    dataset: {},
    className: "",
    scrollTop: 0,
    scrollHeight: 0,
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild() {},
    remove() {},
    closest() { return null; },
    focus() {},
    setAttribute() {},
    getAttribute() { return ""; }
  };
}

function createLocalStorage() {
  const store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      Object.keys(store).forEach((key) => delete store[key]);
    }
  };
}

function loadProtocolApi() {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const scriptStart = html.indexOf("const APP_VERSION");
  const initStart = html.indexOf('document.querySelectorAll(".tab").forEach((btn) => {\n      btn.addEventListener("click"', scriptStart);
  assert.notEqual(scriptStart, -1, "index.html should contain the main inline script");
  assert.notEqual(initStart, -1, "test harness should stop before DOM boot code");

  const elements = new Map();
  const document = {
    body: createElement("body"),
    documentElement: { dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} } },
    getElementById(id) {
      if(!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) { return createElement(tag); }
  };
  const localStorage = createLocalStorage();
  const context = vm.createContext({
    console,
    document,
    window: {
      document,
      localStorage,
      navigator: { standalone: false },
      crypto: { randomUUID: () => "record-protocol-chat-scenario-id" },
      addEventListener() {},
      removeEventListener() {},
      matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
      supabase: { createClient() { return {}; } }
    },
    navigator: { standalone: false },
    crypto: { randomUUID: () => "record-protocol-chat-scenario-id" },
    localStorage,
    alert() {},
    confirm() { return true; },
    requestAnimationFrame(callback) { return callback(); },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    AbortController: class {
      constructor() {
        this.signal = {};
      }
      abort() {}
    },
    fetch: async () => {
      throw new Error("network should not be used by chat record scenario tests");
    },
    Date
  });

  vm.runInContext(html.slice(scriptStart, initStart), context, { filename: "index.html" });
  vm.runInContext(`
    globalThis.__testApi = {
      adaptAiRecordEnvelope,
      applyRecordProtocol
    };
  `, context);
  return context.__testApi;
}

function runChatRecordScenario(input) {
  const api = loadProtocolApi();
  const protocolOutput = api.adaptAiRecordEnvelope({
    envelope: input.aiEnvelope,
    source: {
      kind: "chat",
      messageId: "test-message-1",
      capturedAtIso: "2026-05-17T10:00:00-07:00",
      rawTextHash: "test-hash",
      rawTextPreview: String(input.userText || "").slice(0, 120)
    }
  });

  return api.applyRecordProtocol({
    protocolOutput,
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "America/Los_Angeles",
      visibleWeekDates: WEEK_DATES,
      ...(input.context || {})
    },
    currentState: {
      dailyLogs: {},
      captureAttempts: [],
      visibleWeekDates: WEEK_DATES,
      ...(input.currentState || {})
    }
  });
}

test("chat scenario: today's completed plan exercise is written with aiCapture", () => {
  const result = runChatRecordScenario({
    userText: "\u4eca\u5929\u6df1\u8e72\u505a\u4e86 3 \u7ec4",
    aiEnvelope: {
      reply: "\u8bb0\u4e0b\u4e86\uff1a\u4eca\u5929\u6df1\u8e72 3 \u7ec4\u3002",
      record_candidates: [{
        candidateType: "plan_progress",
        confidence: 0.94,
        evidenceText: "\u4eca\u5929\u6df1\u8e72\u505a\u4e86 3 \u7ec4",
        targetDateText: "today",
        dateSource: "explicit",
        exerciseRef: { type: "mentioned", displayName: "\u6df1\u8e72" },
        amount: 3,
        unit: "set",
        writeIntent: "auto"
      }]
    }
  });

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-17");

  const records = result.nextState.dailyLogs["2026-05-17"].records;
  assert.equal(records.length, 1);
  assert.equal(records[0].exerciseName, "\u6df1\u8e72");
  assert.equal(records[0].amount, 3);
  assert.equal(records[0].unit, "set");
  assert.ok(records[0].aiCapture);
});

test("chat scenario: Saturday completion ignores a wrong AI targetDateIso", () => {
  const result = runChatRecordScenario({
    userText: "\u5468\u516d\u5e73\u677f\u652f\u6491\u5b8c\u6210 3 \u7ec4",
    aiEnvelope: {
      reply: "\u8bb0\u4e0b\u4e86\uff1a\u5468\u516d\u5e73\u677f\u652f\u6491 3 \u7ec4\u3002",
      record_candidates: [{
        candidateType: "plan_progress",
        confidence: 0.93,
        evidenceText: "\u5468\u516d\u5e73\u677f\u652f\u6491\u5b8c\u6210 3 \u7ec4",
        targetDateText: "\u5468\u516d",
        targetDateIso: "2026-05-10",
        dateSource: "explicit",
        exerciseRef: { type: "mentioned", displayName: "\u5e73\u677f\u652f\u6491" },
        amount: 3,
        unit: "set",
        writeIntent: "auto"
      }]
    }
  });

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-16");
  assert.equal(result.nextState.dailyLogs["2026-05-10"], undefined);

  const records = result.nextState.dailyLogs["2026-05-16"].records;
  assert.equal(records.length, 1);
  assert.equal(records[0].exerciseName, "\u5e73\u677f\u652f\u6491");
  assert.equal(records[0].amount, 3);
  assert.equal(records[0].unit, "set");
});

test("chat scenario: consultation request is ignored without changing dailyLogs", () => {
  const result = runChatRecordScenario({
    userText: "\u660e\u5929\u6211\u5e94\u8be5\u7ec3\u4ec0\u4e48\uff1f",
    aiEnvelope: {
      reply: "\u660e\u5929\u5efa\u8bae\u5148\u770b\u4f60\u7684\u6062\u590d\u72b6\u6001\uff0c\u518d\u5b89\u6392\u4e0b\u80a2\u6216\u6838\u5fc3\u8bad\u7ec3\u3002",
      record_candidates: [{
        candidateType: "consultation_request",
        confidence: 0.96,
        evidenceText: "\u660e\u5929\u6211\u5e94\u8be5\u7ec3\u4ec0\u4e48\uff1f",
        targetDateText: "today",
        dateSource: "default_today",
        writeIntent: "ignore"
      }]
    }
  });

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "ignored");
  assert.match(result.decisions[0].reason, /consultation|ignore|write/i);
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);

  assert.equal(result.nextState.captureAttempts.length, 1);
  assert.equal(result.nextState.captureAttempts[0].candidates.length, 1);
  assert.equal(result.nextState.captureAttempts[0].candidates[0].decision, "ignored");
});

test("chat scenario: date correction enters pending without moving the old record", () => {
  const result = runChatRecordScenario({
    userText: "\u4e0d\u662f 5 \u6708 10 \u53f7\uff0c\u662f\u5468\u516d\u90a3\u5929\u505a\u7684",
    aiEnvelope: {
      reply: "\u6211\u7406\u89e3\u4e86\uff0c\u8fd9\u6761\u9700\u8981\u6539\u5230\u5468\u516d\u3002\u8bf7\u786e\u8ba4\u540e\u6211\u518d\u79fb\u52a8\u3002",
      record_candidates: [{
        candidateType: "correction",
        confidence: 0.92,
        evidenceText: "\u4e0d\u662f 5 \u6708 10 \u53f7\uff0c\u662f\u5468\u516d\u90a3\u5929\u505a\u7684",
        correction: {
          operation: "move_record_to_date",
          targetRecordRef: {
            recordId: "record-wrong-date-1",
            previousDateIso: "2026-05-10",
            subjectText: "\u5e73\u677f\u652f\u6491",
            originalEvidenceText: "\u5468\u516d\u5e73\u677f\u652f\u6491\u5b8c\u6210 3 \u7ec4"
          },
          newDate: {
            targetDateText: "\u5468\u516d",
            dateSource: "explicit"
          }
        }
      }]
    },
    currentState: {
      dailyLogs: {
        "2026-05-10": {
          records: [{
            recordId: "record-wrong-date-1",
            type: "plan_progress",
            exerciseName: "\u5e73\u677f\u652f\u6491",
            amount: 3,
            unit: "set",
            evidenceText: "\u5468\u516d\u5e73\u677f\u652f\u6491\u5b8c\u6210 3 \u7ec4"
          }]
        }
      }
    }
  });

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "correction_requires_confirmation");
  assert.equal(result.decisions[0].correction.operation, "move_record_to_date");
  assert.equal(result.decisions[0].correction.targetRecordRef.recordId, "record-wrong-date-1");
  assert.equal(result.decisions[0].correction.previousDateIso, "2026-05-10");
  assert.equal(result.decisions[0].correction.targetDateIso, "2026-05-16");

  assert.equal(result.nextState.dailyLogs["2026-05-10"].records.length, 1);
  assert.equal(result.nextState.dailyLogs["2026-05-10"].records[0].recordId, "record-wrong-date-1");
  assert.equal(result.nextState.dailyLogs["2026-05-16"], undefined);

  assert.equal(result.nextState.captureAttempts.length, 1);
  assert.equal(result.nextState.captureAttempts[0].candidates[0].decision, "pending");
});

test("chat scenario: candidate missing evidenceText is ignored and audited", () => {
  const result = runChatRecordScenario({
    userText: "\u52a0\u7ec3\u4e86 10 \u5206\u949f\u62c9\u4f38",
    aiEnvelope: {
      reply: "\u542c\u8d77\u6765\u4f60\u52a0\u7ec3\u4e86\u62c9\u4f38\u3002",
      record_candidates: [{
        candidateType: "extra_training",
        confidence: 0.91,
        targetDateText: "today",
        dateSource: "default_today",
        exerciseRef: { type: "mentioned", displayName: "\u62c9\u4f38" },
        amount: 10,
        unit: "minute",
        writeIntent: "auto"
      }]
    }
  });

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "ignored");
  assert.equal(result.decisions[0].reason, "missing_evidence_text");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);

  assert.equal(result.nextState.captureAttempts.length, 1);
  assert.equal(result.nextState.captureAttempts[0].candidates.length, 1);
  assert.equal(result.nextState.captureAttempts[0].candidates[0].decision, "ignored");
  assert.equal(result.nextState.captureAttempts[0].candidates[0].decisionReason, "missing_evidence_text");
});
