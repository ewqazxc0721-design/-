const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const INDEX_HTML = path.join(ROOT, "index.html");
const WEEKLY_JSON_DIR = path.join(ROOT, fs.readdirSync(ROOT).find((name) => {
  const full = path.join(ROOT, name);
  return fs.statSync(full).isDirectory() && /json$/i.test(name);
}));

function createElement(id, value = "") {
  return {
    id,
    value,
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

function createLocalStorage(initial = {}) {
  const store = { ...initial };
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
    },
    _store: store
  };
}

function makeSevenDayPlan(items) {
  const names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  return {
    version: 1,
    days: names.map((day) => ({
      day,
      focus: "训练",
      items,
      protein: ""
    }))
  };
}

function makeSundayRecoveryPlan(items) {
  const plan = makeSevenDayPlan(items);
  plan.days = plan.days.map((day, index) => ({
    ...day,
    focus: index === 6 ? "\u4f11\u606f / \u6062\u590d" : day.focus
  }));
  return plan;
}

function createFixedDateClass(now) {
  if(!now) return Date;
  const NativeDate = Date;
  const fixedMs = new NativeDate(now).getTime();
  return class FixedDate extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [fixedMs]));
    }
    static now() {
      return fixedMs;
    }
    static parse(value) {
      return NativeDate.parse(value);
    }
    static UTC(...args) {
      return NativeDate.UTC(...args);
    }
  };
}

function parseWeeklyPlanStartDate(fileName) {
  const match = String(fileName || "").match(/(\d{4})\.(\d{1,2})\.(\d{1,2})-/);
  assert.ok(match, `weekly plan file should start with a date range: ${fileName}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanWeeklyPlanExerciseName(item) {
  return String(item || "")
    .replace(/^可选[:：]\s*/, "")
    .replace(/[（(].*?[）)]/g, "")
    .split(/\s+\d| \d|×|脳/)[0]
    .trim();
}

function isWeeklyPlanTrainingItem(item) {
  const text = String(item || "").trim();
  const name = cleanWeeklyPlanExerciseName(text);
  if(!name) return false;
  if(/记录|体重|多吃|多睡/.test(name)) return false;
  return /\d/.test(text);
}

function addDaysLocal(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0);
}

function getWeeklyPlanChatCompletionCases() {
  const cases = [];
  const files = fs.readdirSync(WEEKLY_JSON_DIR).filter((name) => name.endsWith(".json")).sort();
  for(const file of files) {
    const plan = JSON.parse(fs.readFileSync(path.join(WEEKLY_JSON_DIR, file), "utf8"));
    const start = parseWeeklyPlanStartDate(file);
    (plan.days || []).forEach((day, dayIndex) => {
      const date = addDaysLocal(start, dayIndex);
      (day.items || []).forEach((item, itemIndex) => {
        if(!isWeeklyPlanTrainingItem(item)) return;
        cases.push({
          file,
          plan,
          dayName:day.day || `day-${dayIndex + 1}`,
          item,
          itemIndex,
          date,
          dateIso:formatIsoDate(date)
        });
      });
    });
  }
  return cases;
}

function makeRecordProtocolInput(candidates, overrides = {}) {
  return {
    protocolOutput: {
      protocolVersion: "record-protocol/v1",
      source: {
        kind: "chat",
        messageId: "m-record-protocol",
        capturedAtIso: "2026-05-17T10:00:00+08:00",
        rawTextHash: "hash-record-protocol",
        rawTextPreview: "训练记录候选",
        ...(overrides.source || {})
      },
      reply: "收到。",
      candidates
    },
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "Asia/Shanghai",
      visibleWeekDates: [],
      ...(overrides.context || {})
    },
    currentState: {
      dailyLogs: {},
      visibleWeekDates: [],
      captureAttempts: [],
      ...(overrides.currentState || {})
    }
  };
}

function loadApp(localStorageValues = {}, options = {}) {
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
  const localStorage = createLocalStorage(localStorageValues);
  const TestDate = createFixedDateClass(options.now);
  const context = vm.createContext({
    console,
    document,
    window: {
      document,
      localStorage,
      navigator: { standalone: false },
      crypto: { randomUUID: () => "record-protocol-test-id" },
      addEventListener() {},
      removeEventListener() {},
      matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
      supabase: {
        createClient() {
          return {
            auth: {
              onAuthStateChange() {},
              getUser: async () => ({ data: { user: null }, error: null }),
              getSession: async () => ({ data: { session: null } }),
              signInWithOAuth: async () => ({ error: null }),
              signOut: async () => ({ error: null })
            },
            from() {
              return {
                select() { return this; },
                insert() { return this; },
                update() { return this; },
                upsert() { return this; },
                eq() { return this; },
                limit() { return this; },
                single: async () => ({ data: null, error: null })
              };
            }
          };
        }
      }
    },
    navigator: { standalone: false },
    crypto: { randomUUID: () => "record-protocol-test-id" },
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
    fetch: async (url, init = {}) => {
      if(typeof options.onFetch === "function") options.onFetch(url, init);
      return {
        ok: true,
        json: async () => options.fetchJson || {}
      };
    },
    Date: TestDate
  });

  vm.runInContext(html.slice(scriptStart, initStart), context, { filename: "index.html" });
  vm.runInContext(`
    globalThis.__testApi = {
      normalizeRecordProtocol,
      validateRecordProtocol,
      getRecordProtocols,
      setRecordProtocols,
      getActiveRecordProtocol,
      setActiveRecordProtocolId,
      parseCharacterRecordEnvelope,
      processRecordCandidates,
      sendCharacterChat,
      getCharacterChatHistory,
      ensureDailyLogSnapshot,
      getDailyLogs,
      getPlanChecks,
      getActiveTrainingReference,
      formatDateKey,
      buildCharacterChatSystemPrompt,
      getRecordProtocolLastDebug,
      setRecordProtocolDebugEnabled,
      isRecordProtocolDebugEnabled,
      applyRecordProtocol
    };
  `, context);
  return {
    api: context.__testApi,
    localStorage,
    element(id) {
      return document.getElementById(id);
    }
  };
}

const CUSTOM_BEAR_PRESS_ACTION = {
  exerciseKey: "custom-bear-shoulder-press",
  displayName: "熊爬肩推",
  aliases: ["熊爬肩推", "熊式肩推"],
  status: "confirmed",
  userCreated: true
};

test("applyRecordProtocol handles an AI envelope with no record candidates", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol({
    protocolOutput: {
      reply: "只是普通回复"
    },
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "Asia/Shanghai",
      visibleWeekDates: [],
      source: {
        kind: "chat",
        messageId: "m-empty",
        capturedAtIso: "2026-05-17T10:00:00+08:00",
        rawTextHash: "hash-empty",
        rawTextPreview: "普通聊天"
      }
    },
    currentState: {
      dailyLogs: {},
      visibleWeekDates: [],
      captureAttempts: []
    }
  });

  assert.equal(result.decisions.length, 0);
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
  assert.equal(result.nextState.captureAttempts.length, 1);
  assert.equal(result.nextState.captureAttempts[0].protocolVersion, "record-protocol/v1");
  assert.equal(result.nextState.captureAttempts[0].source.messageId, "m-empty");
  assert.equal(result.nextState.captureAttempts[0].source.rawTextHash, "hash-empty");
  assert.equal(result.nextState.captureAttempts[0].candidates.length, 0);
  assert.equal(result.assistantFollowUp, undefined);
});

test("applyRecordProtocol assigns stable candidate ids through the public engine interface", () => {
  const { api } = loadApp();
  const input = {
    protocolOutput: {
      reply: "收到，深蹲完成 1 组。",
      record_candidates: [{
        candidateType: "plan_progress",
        confidence: 0.92,
        evidenceText: "深蹲完成 1 组",
        exerciseRef: { type: "mentioned", displayName: "深蹲" },
        amount: 1,
        unit: "set"
      }]
    },
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "Asia/Shanghai",
      visibleWeekDates: [],
      source: {
        kind: "chat",
        messageId: "m-plan-progress",
        capturedAtIso: "2026-05-17T10:00:00+08:00",
        rawTextHash: "hash-plan-progress",
        rawTextPreview: "深蹲完成 1 组"
      }
    },
    currentState: {
      dailyLogs: {},
      visibleWeekDates: [],
      captureAttempts: []
    }
  };

  const first = api.applyRecordProtocol(input);
  const second = api.applyRecordProtocol(input);

  assert.equal(first.decisions.length, 1);
  assert.equal(typeof first.decisions[0].candidateId, "string");
  assert.notEqual(first.decisions[0].candidateId, "");
  assert.equal(first.decisions[0].candidateId, second.decisions[0].candidateId);
  assert.equal(Object.keys(first.nextState.dailyLogs).length, 0);
});

test("applyRecordProtocol ignores candidates without evidenceText", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-missing-evidence",
    candidateType: "plan_progress",
    confidence: 0.93,
    exerciseRef: { type: "mentioned", displayName: "深蹲" },
    amount: 1,
    unit: "set"
  }]));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-missing-evidence");
  assert.equal(result.decisions[0].decision, "ignored");
  assert.equal(result.decisions[0].reason, "missing_evidence_text");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
});

test("applyRecordProtocol keeps low-confidence candidates pending", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-low-confidence",
    candidateType: "plan_progress",
    confidence: 0.84,
    evidenceText: "深蹲完成 1 组",
    exerciseRef: { type: "mentioned", displayName: "深蹲" },
    amount: 1,
    unit: "set"
  }]));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-low-confidence");
  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "low_confidence");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
});

test("applyRecordProtocol ignores consultation requests", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-consultation",
    candidateType: "consultation_request",
    confidence: 0.96,
    evidenceText: "俯卧撑做一组可以吗？",
    reason: "user is asking for advice"
  }]));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-consultation");
  assert.equal(result.decisions[0].decision, "ignored");
  assert.equal(result.decisions[0].reason, "consultation_request");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
});

test("applyRecordProtocol keeps correction candidates pending by default", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-correction",
    candidateType: "correction",
    confidence: 0.97,
    evidenceText: "周六那条平板支撑记错日期了",
    correction: {
      operation: "move_record_to_date",
      targetRecordRef: { subjectText: "平板支撑" },
      newDate: { targetDateText: "周六", dateSource: "explicit" }
    }
  }]));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-correction");
  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "correction_requires_confirmation");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
});

test("applyRecordProtocol exposes pending move-record correction details without moving records", () => {
  const { api } = loadApp();
  const visibleWeekDates = [
    { iso: "2026-05-16", weekday: "\u5468\u516d" }
  ];

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-correction-move-pending",
    candidateType: "correction",
    confidence: 0.97,
    evidenceText: "move the plank record from the wrong date to Saturday",
    correction: {
      operation: "move_record_to_date",
      targetRecordRef: {
        recordId: "record-wrong-date-1",
        previousDateIso: "2026-05-10",
        subjectText: "plank",
        originalEvidenceText: "Saturday plank completed 3 sets"
      },
      newDate: { targetDateText: "\u5468\u516d", dateSource: "explicit" }
    }
  }], {
    context: { visibleWeekDates },
    currentState: {
      visibleWeekDates,
      dailyLogs: {
        "2026-05-10": {
          records: [{
            recordId: "record-wrong-date-1",
            type: "plan_progress",
            exerciseName: "plank",
            amount: 3,
            unit: "set",
            evidenceText: "Saturday plank completed 3 sets"
          }]
        }
      }
    }
  }));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-correction-move-pending");
  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "correction_requires_confirmation");
  assert.equal(result.decisions[0].correction.operation, "move_record_to_date");
  assert.equal(result.decisions[0].correction.targetRecordRef.recordId, "record-wrong-date-1");
  assert.equal(result.decisions[0].correction.previousDateIso, "2026-05-10");
  assert.equal(result.decisions[0].correction.targetDateIso, "2026-05-16");
  assert.equal(result.nextState.dailyLogs["2026-05-10"].records.length, 1);
  assert.equal(result.nextState.dailyLogs["2026-05-16"], undefined);
});

test("applyRecordProtocol moves a referenced record after confirmed correction", () => {
  const { api } = loadApp();
  const visibleWeekDates = [
    { iso: "2026-05-16", weekday: "\u5468\u516d" }
  ];

  const input = makeRecordProtocolInput([{
    candidateId: "candidate-correction-move-confirmed",
    candidateType: "correction",
    confidence: 0.97,
    evidenceText: "move the plank record from the wrong date to Saturday",
    correction: {
      operation: "move_record_to_date",
      targetRecordRef: {
        recordId: "record-wrong-date-1",
        previousDateIso: "2026-05-10",
        subjectText: "plank",
        originalEvidenceText: "Saturday plank completed 3 sets"
      },
      newDate: { targetDateText: "\u5468\u516d", dateSource: "explicit" }
    }
  }], {
    context: { visibleWeekDates },
    currentState: {
      visibleWeekDates,
      dailyLogs: {
        "2026-05-10": {
          records: [{
            recordId: "record-wrong-date-1",
            type: "plan_progress",
            exerciseName: "plank",
            amount: 3,
            unit: "set",
            evidenceText: "Saturday plank completed 3 sets"
          }]
        }
      }
    }
  });

  const result = api.applyRecordProtocol({
    ...input,
    confirmedCandidateIds: ["candidate-correction-move-confirmed"]
  });

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-correction-move-confirmed");
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].reason, "confirmed_correction_applied");
  assert.equal(result.decisions[0].movedRecordId, "record-wrong-date-1");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-16");
  assert.equal(result.nextState.dailyLogs["2026-05-10"].records.length, 0);

  const moved = result.nextState.dailyLogs["2026-05-16"].records[0];
  assert.equal(moved.recordId, "record-wrong-date-1");
  assert.equal(moved.exerciseName, "plank");
  assert.equal(moved.movedFromDateIso, "2026-05-10");
  assert.equal(moved.targetDateIso, "2026-05-16");
});

test("applyRecordProtocol updates a referenced record after confirmed field correction", () => {
  const { api } = loadApp();
  const input = makeRecordProtocolInput([{
    candidateId: "candidate-correction-modify-confirmed",
    candidateType: "correction",
    confidence: 0.97,
    evidenceText: "\u628a\u521a\u624d\u6563\u6b65\u8bb0\u5f55\u6539\u621020\u5206\u949f",
    correction: {
      operation: "modify_record_fields",
      targetRecordRef: {
        recordId: "record-walking-30",
        previousDateIso: "2026-05-17",
        subjectText: "\u6563\u6b65",
        originalEvidenceText: "\u5b8c\u6210\u6563\u6b6530\u5206\u949f"
      },
      fields: {
        amount: 20,
        unit: "minute",
        duration: 20,
        durationUnit: "minute"
      }
    }
  }], {
    context: { todayIso: "2026-05-17" },
    currentState: {
      dailyLogs: {
        "2026-05-17": {
          records: [{
            recordId: "record-walking-30",
            type: "plan_progress",
            candidateId: "candidate-walking-30",
            targetDateIso: "2026-05-17",
            exerciseName: "\u6563\u6b65",
            amount: 30,
            unit: "minute",
            duration: 30,
            durationUnit: "minute",
            evidenceText: "\u5b8c\u6210\u6563\u6b6530\u5206\u949f"
          }]
        }
      }
    }
  });

  const result = api.applyRecordProtocol({
    ...input,
    confirmedCandidateIds: ["candidate-correction-modify-confirmed"]
  });

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-correction-modify-confirmed");
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].reason, "confirmed_correction_applied");
  assert.equal(result.decisions[0].updatedRecordId, "record-walking-30");
  assert.equal(result.nextState.dailyLogs["2026-05-17"].records.length, 1);

  const updated = result.nextState.dailyLogs["2026-05-17"].records[0];
  assert.equal(updated.recordId, "record-walking-30");
  assert.equal(updated.exerciseName, "\u6563\u6b65");
  assert.equal(updated.amount, 20);
  assert.equal(updated.unit, "minute");
  assert.equal(updated.duration, 20);
  assert.equal(updated.durationUnit, "minute");
  assert.equal(updated.lastCorrectionEvidenceText, "\u628a\u521a\u624d\u6563\u6b65\u8bb0\u5f55\u6539\u621020\u5206\u949f");
});

test("applyRecordProtocol keeps confirmed correction pending when target record is missing", () => {
  const { api } = loadApp();
  const visibleWeekDates = [
    { iso: "2026-05-16", weekday: "\u5468\u516d" }
  ];
  const input = makeRecordProtocolInput([{
    candidateId: "candidate-correction-missing-target",
    candidateType: "correction",
    confidence: 0.97,
    evidenceText: "move the missing plank record to Saturday",
    correction: {
      operation: "move_record_to_date",
      targetRecordRef: {
        recordId: "record-not-found",
        previousDateIso: "2026-05-10",
        subjectText: "plank"
      },
      newDate: { targetDateText: "\u5468\u516d", dateSource: "explicit" }
    }
  }], {
    context: { visibleWeekDates },
    currentState: {
      visibleWeekDates,
      dailyLogs: {
        "2026-05-10": { records: [] }
      }
    }
  });

  const result = api.applyRecordProtocol({
    ...input,
    confirmedCandidateIds: ["candidate-correction-missing-target"]
  });

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-correction-missing-target");
  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "target_record_not_found");
  assert.equal(result.decisions[0].correction.targetRecordRef.recordId, "record-not-found");
  assert.equal(result.nextState.dailyLogs["2026-05-10"].records.length, 0);
  assert.equal(result.nextState.dailyLogs["2026-05-16"], undefined);
  assert.equal(result.nextState.captureAttempts[0].candidates[0].decisionReason, "target_record_not_found");
});

test("applyRecordProtocol ignores candidates with writeIntent ignore", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-write-intent-ignore",
    candidateType: "plan_progress",
    confidence: 0.96,
    evidenceText: "只是举例：深蹲完成 1 组",
    writeIntent: "ignore",
    exerciseRef: { type: "mentioned", displayName: "深蹲" },
    amount: 1,
    unit: "set"
  }]));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-write-intent-ignore");
  assert.equal(result.decisions[0].decision, "ignored");
  assert.equal(result.decisions[0].reason, "write_intent_ignore");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
});

test("applyRecordProtocol keeps candidates pending when confirmation is required", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-needs-confirmation",
    candidateType: "plan_progress",
    confidence: 0.96,
    evidenceText: "又一组",
    needsConfirmation: true,
    exerciseRef: { type: "activeTrainingReference" },
    amount: 1,
    unit: "set"
  }]));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-needs-confirmation");
  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "needs_confirmation");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
});

test("applyRecordProtocol marks high-confidence evidenced plan progress as written without mutating logs in issue 2", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-written-plan-progress",
    candidateType: "plan_progress",
    confidence: 0.96,
    evidenceText: "深蹲完成 1 组",
    writeIntent: "auto",
    exerciseRef: { type: "mentioned", displayName: "深蹲" },
    amount: 1,
    unit: "set"
  }]));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-written-plan-progress");
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].reason, "eligible_for_write");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
});

test("applyRecordProtocol resolves weekday targetDateText from visibleWeekDates over advisory AI iso", () => {
  const { api } = loadApp();
  const visibleWeekDates = [
    { iso: "2026-05-11", weekday: "\u5468\u4e00" },
    { iso: "2026-05-12", weekday: "\u5468\u4e8c" },
    { iso: "2026-05-13", weekday: "\u5468\u4e09" },
    { iso: "2026-05-14", weekday: "\u5468\u56db" },
    { iso: "2026-05-15", weekday: "\u5468\u4e94" },
    { iso: "2026-05-16", weekday: "\u5468\u516d" },
    { iso: "2026-05-17", weekday: "\u5468\u65e5" }
  ];

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-weekday-advisory-iso",
    candidateType: "plan_progress",
    confidence: 0.93,
    evidenceText: "Saturday plank completed 3 sets",
    targetDateText: "\u5468\u516d",
    targetDateIso: "2026-05-10",
    dateSource: "explicit",
    writeIntent: "auto",
    exerciseRef: { type: "mentioned", displayName: "plank" },
    amount: 3,
    unit: "set"
  }], {
    context: { visibleWeekDates },
    currentState: { visibleWeekDates }
  }));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-16");
  assert.notEqual(result.decisions[0].targetDateIso, "2026-05-10");
});

test("applyRecordProtocol resolves today targetDateText from context todayIso", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-today-date",
    candidateType: "plan_progress",
    confidence: 0.94,
    evidenceText: "squat completed 3 sets today",
    targetDateText: "today",
    dateSource: "explicit",
    writeIntent: "auto",
    exerciseRef: { type: "mentioned", displayName: "squat" },
    amount: 3,
    unit: "set"
  }], {
    context: { todayIso: "2026-05-17" }
  }));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-17");
});

test("applyRecordProtocol keeps explicit unresolvable target dates pending", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-unresolved-explicit-date",
    candidateType: "plan_progress",
    confidence: 0.94,
    evidenceText: "plank completed on a date outside the visible week",
    targetDateText: "\u4e0a\u4e0a\u5468\u516d",
    dateSource: "explicit",
    writeIntent: "auto",
    exerciseRef: { type: "mentioned", displayName: "plank" },
    amount: 3,
    unit: "set"
  }], {
    context: {
      visibleWeekDates: [
        { iso: "2026-05-16", weekday: "\u5468\u516d" }
      ]
    }
  }));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "unresolved_target_date");
  assert.equal(result.decisions[0].targetDateIso, undefined);
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
});

test("applyRecordProtocol writes resolved plan progress into the target daily log", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-plan-progress-write",
    candidateType: "plan_progress",
    confidence: 0.94,
    evidenceText: "squat completed 3 sets today",
    targetDateText: "today",
    dateSource: "explicit",
    writeIntent: "auto",
    exerciseRef: { type: "mentioned", displayName: "squat" },
    amount: 3,
    unit: "set"
  }], {
    context: { todayIso: "2026-05-17" }
  }));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-17");
  assert.equal(typeof result.decisions[0].writtenRecordId, "string");
  assert.notEqual(result.decisions[0].writtenRecordId, "");

  const records = result.nextState.dailyLogs["2026-05-17"].records;
  assert.equal(records.length, 1);
  assert.equal(records[0].recordId, result.decisions[0].writtenRecordId);
  assert.equal(records[0].type, "plan_progress");
  assert.equal(records[0].exerciseName, "squat");
  assert.equal(records[0].amount, 3);
  assert.equal(records[0].unit, "set");
  assert.equal(records[0].evidenceText, "squat completed 3 sets today");

  assert.equal(result.nextState.captureAttempts.length, 1);
  assert.equal(records[0].aiCapture.attemptId, result.nextState.captureAttempts[0].attemptId);
  assert.equal(records[0].aiCapture.candidateId, "candidate-plan-progress-write");
  assert.equal(records[0].aiCapture.evidenceText, "squat completed 3 sets today");
  assert.equal(records[0].aiCapture.confidence, 0.94);
  assert.equal(records[0].aiCapture.rawText, undefined);
  assert.equal(records[0].aiCapture.rawTextPreview, undefined);

  const attempt = result.nextState.captureAttempts.find((item) => item.attemptId === records[0].aiCapture.attemptId);
  assert.ok(attempt);
  const auditedCandidate = attempt.candidates.find((item) => item.candidateId === records[0].aiCapture.candidateId);
  assert.ok(auditedCandidate);
  assert.equal(auditedCandidate.decision, "written");
  assert.equal(auditedCandidate.decisionReason, "eligible_for_write");
  assert.equal(auditedCandidate.writtenRecordId, records[0].recordId);
});

test("applyRecordProtocol writes resolved extra training into the target daily log", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-extra-training-write",
    candidateType: "extra_training",
    confidence: 0.92,
    evidenceText: "jump rope for 10 minutes today",
    targetDateText: "today",
    dateSource: "explicit",
    writeIntent: "auto",
    exerciseRef: { type: "mentioned", displayName: "jump rope" },
    amount: 10,
    unit: "minute"
  }], {
    context: { todayIso: "2026-05-17" }
  }));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-17");
  assert.equal(typeof result.decisions[0].writtenRecordId, "string");

  const records = result.nextState.dailyLogs["2026-05-17"].records;
  assert.equal(records.length, 1);
  assert.equal(records[0].recordId, result.decisions[0].writtenRecordId);
  assert.equal(records[0].type, "extra_training");
  assert.equal(records[0].exerciseName, "jump rope");
  assert.equal(records[0].amount, 10);
  assert.equal(records[0].unit, "minute");
  assert.equal(records[0].evidenceText, "jump rope for 10 minutes today");
  assert.equal(records[0].aiCapture.candidateId, "candidate-extra-training-write");
});

test("applyRecordProtocol normalizes AI exercise aliases through the merged exercise library", () => {
  const { api } = loadApp({
    "gain-exercise-library-custom": JSON.stringify([CUSTOM_BEAR_PRESS_ACTION])
  });

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-custom-library-alias",
    candidateType: "extra_training",
    confidence: 0.92,
    evidenceText: "今天熊式肩推做了30个",
    targetDateText: "today",
    dateSource: "explicit",
    writeIntent: "auto",
    exerciseRef: { type: "mentioned", displayName: "熊式肩推" },
    amount: 30,
    unit: "rep",
    evidenceSource: "current_user_message",
    riskLevel: "low",
    scope: "single_record"
  }], {
    context: { todayIso: "2026-05-17" }
  }));

  assert.equal(result.decisions[0].decision, "written");
  const record = result.nextState.dailyLogs["2026-05-17"].records[0];
  assert.equal(record.exerciseName, "熊爬肩推");
  assert.equal(record.exerciseKey, "custom-bear-shoulder-press");
  assert.equal(record.amount, 30);
  assert.equal(record.unit, "rep");
});

test("applyRecordProtocol keeps ambiguous exercise-library aliases pending", () => {
  const { api } = loadApp({
    "gain-exercise-library-custom": JSON.stringify([
      { exerciseKey: "custom-front-fly", displayName: "前平飞鸟", aliases: ["飞鸟"], status: "confirmed" },
      { exerciseKey: "custom-reverse-fly", displayName: "反向飞鸟", aliases: ["飞鸟"], status: "confirmed" }
    ])
  });

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-ambiguous-library-alias",
    candidateType: "extra_training",
    confidence: 0.92,
    evidenceText: "今天飞鸟做了1组",
    targetDateText: "today",
    dateSource: "explicit",
    writeIntent: "auto",
    exerciseRef: { type: "mentioned", displayName: "飞鸟" },
    amount: 1,
    unit: "set",
    evidenceSource: "current_user_message",
    riskLevel: "low",
    scope: "single_record"
  }], {
    context: { todayIso: "2026-05-17" }
  }));

  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "needs_confirmation");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
});

test("applyRecordProtocol writes resolved feedback into the target daily log", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-feedback-write",
    candidateType: "feedback",
    confidence: 0.91,
    evidenceText: "left knee felt sore during squats",
    targetDateText: "today",
    dateSource: "explicit",
    writeIntent: "auto",
    exerciseRef: { type: "mentioned", displayName: "squat" },
    feedbackType: "safety",
    text: "left knee felt sore"
  }], {
    context: { todayIso: "2026-05-17" }
  }));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-17");
  assert.equal(typeof result.decisions[0].writtenRecordId, "string");

  const records = result.nextState.dailyLogs["2026-05-17"].records;
  assert.equal(records.length, 1);
  assert.equal(records[0].recordId, result.decisions[0].writtenRecordId);
  assert.equal(records[0].type, "feedback");
  assert.equal(records[0].exerciseName, "squat");
  assert.equal(records[0].feedbackType, "safety");
  assert.equal(records[0].text, "left knee felt sore");
  assert.equal(records[0].aiCapture.candidateId, "candidate-feedback-write");
});

test("applyRecordProtocol writes resolved body state into the target daily log", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-body-state-write",
    candidateType: "body_state",
    confidence: 0.9,
    evidenceText: "slept 7 hours and fatigue was 3 today",
    targetDateText: "today",
    dateSource: "explicit",
    writeIntent: "auto",
    bodyState: { sleep: "7h", fatigueScore: 3 }
  }], {
    context: { todayIso: "2026-05-17" }
  }));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-17");
  assert.equal(typeof result.decisions[0].writtenRecordId, "string");

  const records = result.nextState.dailyLogs["2026-05-17"].records;
  assert.equal(records.length, 1);
  assert.equal(records[0].recordId, result.decisions[0].writtenRecordId);
  assert.equal(records[0].type, "body_state");
  assert.equal(records[0].bodyState.sleep, "7h");
  assert.equal(records[0].bodyState.fatigueScore, 3);
  assert.equal(records[0].evidenceText, "slept 7 hours and fatigue was 3 today");
  assert.equal(records[0].aiCapture.candidateId, "candidate-body-state-write");
});

test("applyRecordProtocol writes resolved note into the target daily log", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-note-write",
    candidateType: "note",
    confidence: 0.9,
    evidenceText: "today training felt smooth",
    targetDateText: "today",
    dateSource: "explicit",
    writeIntent: "auto",
    note: "training felt smooth"
  }], {
    context: { todayIso: "2026-05-17" }
  }));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-17");
  assert.equal(typeof result.decisions[0].writtenRecordId, "string");

  const records = result.nextState.dailyLogs["2026-05-17"].records;
  assert.equal(records.length, 1);
  assert.equal(records[0].recordId, result.decisions[0].writtenRecordId);
  assert.equal(records[0].type, "note");
  assert.equal(records[0].text, "training felt smooth");
  assert.equal(records[0].evidenceText, "today training felt smooth");
  assert.equal(records[0].aiCapture.candidateId, "candidate-note-write");
});

test("applyRecordProtocol ignores unknown candidate types without writing logs", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-unknown-type",
    candidateType: "meal_plan",
    confidence: 0.96,
    evidenceText: "ate a larger lunch today",
    targetDateText: "today",
    dateSource: "explicit",
    writeIntent: "auto"
  }], {
    context: { todayIso: "2026-05-17" }
  }));

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].candidateId, "candidate-unknown-type");
  assert.equal(result.decisions[0].decision, "ignored");
  assert.equal(result.decisions[0].reason, "unknown_candidate_type");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
  assert.equal(result.nextState.captureAttempts[0].candidates[0].decision, "ignored");
  assert.equal(result.nextState.captureAttempts[0].candidates[0].decisionReason, "unknown_candidate_type");
});

test("applyRecordProtocol does not duplicate an already written candidateId", () => {
  const { api } = loadApp();

  const result = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-plan-progress-duplicate",
    candidateType: "plan_progress",
    confidence: 0.94,
    evidenceText: "squat completed 3 sets today",
    targetDateText: "today",
    dateSource: "explicit",
    writeIntent: "auto",
    exerciseRef: { type: "mentioned", displayName: "squat" },
    amount: 3,
    unit: "set"
  }], {
    context: { todayIso: "2026-05-17" },
    currentState: {
      dailyLogs: {
        "2026-05-17": {
          records: [{
            recordId: "record-already-written",
            candidateId: "candidate-plan-progress-duplicate",
            type: "plan_progress",
            exerciseName: "squat",
            amount: 3,
            unit: "set",
            evidenceText: "squat completed 3 sets today"
          }]
        }
      }
    }
  }));

  const records = result.nextState.dailyLogs["2026-05-17"].records;
  assert.equal(records.length, 1);
  assert.equal(records[0].recordId, "record-already-written");
  assert.equal(result.decisions[0].decision, "ignored");
  assert.equal(result.decisions[0].reason, "duplicate_candidate");
  assert.equal(result.decisions[0].existingRecordId, "record-already-written");
});

test("applyRecordProtocol keeps only the latest 100 capture attempts", () => {
  const { api } = loadApp();
  const existingAttempts = Array.from({ length: 100 }, (_, index) => ({
    attemptId: `old-attempt-${index + 1}`,
    protocolVersion: "record-protocol/v1",
    capturedAtIso: "2026-05-16T10:00:00+08:00",
    source: {
      kind: "chat",
      messageId: `old-message-${index + 1}`,
      rawTextHash: `old-hash-${index + 1}`,
      rawTextPreview: "old preview"
    },
    candidates: []
  }));

  const result = api.applyRecordProtocol(makeRecordProtocolInput([], {
    source: {
      messageId: "new-message",
      capturedAtIso: "2026-05-17T10:00:00+08:00",
      rawTextHash: "new-hash",
      rawTextPreview: "new preview"
    },
    currentState: {
      captureAttempts: existingAttempts
    }
  }));

  assert.equal(result.nextState.captureAttempts.length, 100);
  assert.equal(result.nextState.captureAttempts[0].attemptId, "old-attempt-2");
  assert.equal(result.nextState.captureAttempts[99].source.messageId, "new-message");
});

test("applyRecordProtocol covers the v1 final acceptance checklist through the public interface", () => {
  const { api } = loadApp();
  const visibleWeekDates = [
    { iso: "2026-05-11", weekday: "\u5468\u4e00" },
    { iso: "2026-05-12", weekday: "\u5468\u4e8c" },
    { iso: "2026-05-13", weekday: "\u5468\u4e09" },
    { iso: "2026-05-14", weekday: "\u5468\u56db" },
    { iso: "2026-05-15", weekday: "\u5468\u4e94" },
    { iso: "2026-05-16", weekday: "\u5468\u516d" },
    { iso: "2026-05-17", weekday: "\u5468\u65e5" }
  ];

  const writtenResult = api.applyRecordProtocol(makeRecordProtocolInput([{
    candidateId: "candidate-final-missing-evidence",
    candidateType: "plan_progress",
    confidence: 0.94,
    targetDateText: "today",
    dateSource: "explicit",
    exerciseRef: { type: "mentioned", displayName: "\u6df1\u8e72" },
    amount: 1,
    unit: "set",
    writeIntent: "auto"
  }, {
    candidateId: "candidate-final-saturday",
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
  }], {
    context: { visibleWeekDates }
  }));

  const missingEvidenceDecision = writtenResult.decisions.find((decision) => decision.candidateId === "candidate-final-missing-evidence");
  assert.equal(missingEvidenceDecision.decision, "ignored");
  assert.equal(missingEvidenceDecision.reason, "missing_evidence_text");

  const saturdayDecision = writtenResult.decisions.find((decision) => decision.candidateId === "candidate-final-saturday");
  assert.equal(saturdayDecision.decision, "written");
  assert.equal(saturdayDecision.targetDateIso, "2026-05-16");
  assert.equal(typeof saturdayDecision.writtenRecordId, "string");
  assert.equal(writtenResult.nextState.dailyLogs["2026-05-10"], undefined);

  const saturdayRecords = writtenResult.nextState.dailyLogs["2026-05-16"].records;
  assert.equal(saturdayRecords.length, 1);
  assert.equal(saturdayRecords[0].recordId, saturdayDecision.writtenRecordId);
  assert.equal(saturdayRecords[0].exerciseName, "\u5e73\u677f\u652f\u6491");
  assert.equal(saturdayRecords[0].amount, 3);
  assert.equal(saturdayRecords[0].unit, "set");
  assert.equal(saturdayRecords[0].aiCapture.candidateId, "candidate-final-saturday");
  assert.equal(saturdayRecords[0].aiCapture.rawText, undefined);

  const attempt = writtenResult.nextState.captureAttempts.find((item) => item.attemptId === saturdayRecords[0].aiCapture.attemptId);
  assert.ok(attempt);
  assert.equal(attempt.candidates.length, 2);
  assert.equal(attempt.candidates.find((item) => item.candidateId === "candidate-final-saturday").decision, "written");
  assert.equal(attempt.candidates.find((item) => item.candidateId === "candidate-final-missing-evidence").decision, "ignored");

  const wrongDateState = {
    "2026-05-10": {
      records: [{
        recordId: "record-final-wrong-date",
        type: "plan_progress",
        exerciseName: "\u5e73\u677f\u652f\u6491",
        amount: 3,
        unit: "set",
        evidenceText: "\u5468\u516d\u5e73\u677f\u652f\u6491\u5b8c\u6210 3 \u7ec4"
      }]
    }
  };
  const correctionCandidate = {
    candidateId: "candidate-final-correction",
    candidateType: "correction",
    confidence: 0.92,
    evidenceText: "\u4e0d\u662f 5 \u6708 10 \u53f7\uff0c\u662f\u5468\u516d\u90a3\u5929\u505a\u7684",
    correction: {
      operation: "move_record_to_date",
      targetRecordRef: {
        recordId: "record-final-wrong-date",
        previousDateIso: "2026-05-10",
        subjectText: "\u5e73\u677f\u652f\u6491",
        originalEvidenceText: "\u5468\u516d\u5e73\u677f\u652f\u6491\u5b8c\u6210 3 \u7ec4"
      },
      newDate: { targetDateText: "\u5468\u516d", dateSource: "explicit" }
    }
  };

  const pendingResult = api.applyRecordProtocol(makeRecordProtocolInput([correctionCandidate], {
    context: { visibleWeekDates },
    currentState: {
      dailyLogs: wrongDateState,
      visibleWeekDates,
      captureAttempts: writtenResult.nextState.captureAttempts
    }
  }));

  assert.equal(pendingResult.decisions[0].decision, "pending");
  assert.equal(pendingResult.decisions[0].reason, "correction_requires_confirmation");
  assert.equal(pendingResult.decisions[0].correction.targetDateIso, "2026-05-16");
  assert.equal(pendingResult.nextState.dailyLogs["2026-05-10"].records.length, 1);
  assert.equal(pendingResult.nextState.dailyLogs["2026-05-16"], undefined);

  const confirmedInput = makeRecordProtocolInput([correctionCandidate], {
    context: { visibleWeekDates },
    currentState: {
      dailyLogs: pendingResult.nextState.dailyLogs,
      visibleWeekDates,
      captureAttempts: pendingResult.nextState.captureAttempts
    }
  });
  const confirmedResult = api.applyRecordProtocol({
    ...confirmedInput,
    confirmedCandidateIds: ["candidate-final-correction"]
  });

  assert.equal(confirmedResult.decisions[0].decision, "written");
  assert.equal(confirmedResult.decisions[0].reason, "confirmed_correction_applied");
  assert.equal(confirmedResult.decisions[0].targetDateIso, "2026-05-16");
  assert.equal(confirmedResult.nextState.dailyLogs["2026-05-10"].records.length, 0);
  const movedRecord = confirmedResult.nextState.dailyLogs["2026-05-16"].records[0];
  assert.equal(movedRecord.recordId, "record-final-wrong-date");
  assert.equal(movedRecord.movedFromDateIso, "2026-05-10");
});

test("record protocols provide a default and imported protocols are validated, hidden, and activated", () => {
  const { api } = loadApp();

  const fallback = api.getActiveRecordProtocol();
  assert.equal(fallback.schema, "gain-record-protocol/v1");
  assert.equal(fallback.id, "default-training-capture-v1");
  assert.equal(fallback.visibility.showCandidatesToUser, false);

  const imported = api.normalizeRecordProtocol({
    schema: "gain-record-protocol/v1",
    id: "custom-v1",
    name: "自定义协议",
    version: "1.2.0",
    description: "测试协议",
    visibility: { showCandidatesToUser: true, debugInspectable: true },
    prompt: { system: "只返回 envelope", outputContract: "reply + record_candidates", rules: ["候选不展示"] },
    candidateSchema: { allowedTypes: ["plan_progress", "feedback", "unknown_type"] }
  }, "custom.json");

  assert.equal(imported.visibility.showCandidatesToUser, false);
  assert.deepEqual(imported.candidateSchema.allowedTypes, ["plan_progress", "feedback"]);
  assert.equal(api.validateRecordProtocol(imported).ok, true);

  api.setRecordProtocols([imported]);
  api.setActiveRecordProtocolId("custom-v1");
  assert.equal(api.getActiveRecordProtocol().id, "custom-v1");
  assert.equal(api.getRecordProtocols().some((protocol) => protocol.id === "default-training-capture-v1"), true);
});

test("record envelope parsing only exposes reply and filters candidate types and fields", () => {
  const { api } = loadApp();
  const parsed = api.parseCharacterRecordEnvelope("```json\n{\"reply\":\"已记到深蹲。\",\"record_candidates\":[{\"candidateType\":\"plan_progress\",\"rawText\":\"深蹲一组\",\"exerciseRef\":{\"type\":\"mentioned\",\"displayName\":\"深蹲\",\"unsafe\":\"x\"},\"amount\":1,\"unit\":\"set\",\"extra\":\"hidden\"},{\"candidateType\":\"unsupported\",\"rawText\":\"x\"}]}\n```");

  assert.equal(parsed.reply, "已记到深蹲。");
  assert.equal(parsed.record_candidates.length, 1);
  assert.equal(parsed.record_candidates[0].candidateType, "plan_progress");
  assert.equal(parsed.record_candidates[0].extra, undefined);
  assert.equal(parsed.record_candidates[0].exerciseRef.unsafe, undefined);
});

test("record envelope parsing preserves v1 protocol fields before the adapter runs", () => {
  const { api } = loadApp();
  const parsed = api.parseCharacterRecordEnvelope(JSON.stringify({
    reply: "\u8bb0\u4e0b\u4e86\uff1a\u5468\u516d\u5e73\u677f\u652f\u6491 3 \u7ec4\u3002",
    record_candidates: [{
      candidateType: "plan_progress",
      confidence: 0.93,
      evidenceText: "\u5468\u516d\u5e73\u677f\u652f\u6491\u5b8c\u6210 3 \u7ec4",
      targetDateText: "\u5468\u516d",
      targetDateIso: "2026-05-10",
      dateSource: "explicit",
      exerciseRef: {
        type: "mentioned",
        displayName: "\u5e73\u677f\u652f\u6491",
        unsafe: "x"
      },
      amount: 3,
      unit: "set",
      writeIntent: "auto",
      extra: "hidden"
    }]
  }));

  assert.equal(parsed.record_candidates.length, 1);
  assert.equal(parsed.record_candidates[0].evidenceText, "\u5468\u516d\u5e73\u677f\u652f\u6491\u5b8c\u6210 3 \u7ec4");
  assert.equal(parsed.record_candidates[0].targetDateText, "\u5468\u516d");
  assert.equal(parsed.record_candidates[0].targetDateIso, "2026-05-10");
  assert.equal(parsed.record_candidates[0].dateSource, "explicit");
  assert.equal(parsed.record_candidates[0].writeIntent, "auto");
  assert.equal(parsed.record_candidates[0].extra, undefined);
  assert.equal(parsed.record_candidates[0].exerciseRef.unsafe, undefined);
});

test("character chat system prompt combines record protocol before role style", () => {
  const { api } = loadApp();
  const prompt = api.buildCharacterChatSystemPrompt(
    { name: "Role One", personality: "warm style" },
    { activeTrainingReference: { exerciseKey: "squat", displayName: "深蹲" } }
  );

  assert.match(prompt, /JSON envelope/);
  assert.match(prompt, /record_candidates/);
  assert.ok(prompt.indexOf("记录协议输出格式") < prompt.indexOf("personality"));
  assert.match(prompt, /activeTrainingReference/);
});

test("record candidates update plan progress through activeTrainingReference without legacy aiCaptureRecords", () => {
  const { api } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan(["深蹲 3组 × 10次", "划船 3组 × 10次"]))
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });

  let result = api.processRecordCandidates([{
    candidateType: "plan_progress",
    intent: "new_fact",
    rawText: "我完成了一组深蹲",
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: "深蹲" },
    amount: 1,
    unit: "set",
    needsConfirmation: false,
    confidence: 0.9
  }], { userText: "我完成了一组深蹲" });

  assert.equal(result.writes.length, 1);
  let log = api.getDailyLogs()[today];
  let squat = log.planProgressItems.find((item) => item.snapshotItemText.includes("深蹲"));
  assert.equal(squat.completedAmount, 1);
  assert.equal((log.aiCaptureRecords || []).length, 0);
  assert.equal(api.getActiveTrainingReference().itemId, squat.itemId);

  result = api.processRecordCandidates([{
    candidateType: "plan_progress",
    intent: "additional_volume",
    rawText: "我又做完一组",
    targetDate: "today",
    exerciseRef: { type: "activeTrainingReference" },
    amount: 1,
    unit: "set",
    needsConfirmation: false,
    confidence: 0.92
  }], { userText: "我又做完一组" });

  assert.equal(result.writes.length, 1);
  log = api.getDailyLogs()[today];
  squat = log.planProgressItems.find((item) => item.snapshotItemText.includes("深蹲"));
  assert.equal(squat.completedAmount, 2);
  assert.equal((log.aiCaptureRecords || []).length, 0);
  assert.equal(api.getActiveTrainingReference().completedAmount, 2);
});

test("record protocol correction updates an existing capture record instead of appending", () => {
  const today = "2026-05-17";
  const existingRecord = {
    id: "capture-walking-30",
    date: today,
    capturedAt: "2026-05-17T10:00:00+08:00",
    sourceType: "record_protocol",
    candidateType: "plan_progress",
    recordType: "training_fact",
    currentValue: {
      exercise: "\u6563\u6b65",
      duration: 30,
      durationUnit: "\u5206\u949f",
      text: "\u5b8c\u6210\u6563\u6b6530\u5206\u949f"
    },
    originalValue: {
      exercise: "\u6563\u6b65",
      duration: 30,
      durationUnit: "\u5206\u949f"
    },
    originalText: "\u5b8c\u6210\u6563\u6b6530\u5206\u949f",
    confidence: "medium",
    userModified: false,
    revoked: false,
    autoCompletedPlanChecks: [],
    structuredWrite: { status: "actual_training_only" },
    writeType: "completion_with_note"
  };
  const { api } = loadApp({
    "gain-daily-logs": JSON.stringify({
      [today]: {
        date: today,
        dayType: "training",
        aiCaptureRecords: [existingRecord]
      }
    })
  }, {
    now: "2026-05-17T12:00:00+08:00"
  });

  const result = api.processRecordCandidates([{
    candidateType: "plan_progress",
    intent: "new_fact",
    rawText: "\u628a\u521a\u624d\u6563\u6b65\u8bb0\u5f55\u6539\u621020\u5206\u949f",
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: "\u6563\u6b65" },
    amount: 20,
    unit: "rep",
    needsConfirmation: false,
    confidence: 0.95
  }], {
    userText: "\u628a\u521a\u624d\u6563\u6b65\u8bb0\u5f55\u6539\u621020\u5206\u949f",
    now: new Date("2026-05-17T12:00:00+08:00")
  });

  assert.equal(result.writes.length, 1);
  assert.equal(result.writes[0].status, "correction");

  const log = api.getDailyLogs()[today];
  assert.equal((log.aiCaptureRecords || []).length, 1);
  const updated = log.aiCaptureRecords[0];
  assert.equal(updated.id, "capture-walking-30");
  assert.equal(updated.userModified, true);
  assert.equal(updated.currentValue.exercise, "\u6563\u6b65");
  assert.equal(updated.currentValue.duration, 20);
  assert.equal(updated.currentValue.durationUnit, "\u5206\u949f");
  assert.match(updated.originalText, /\u5b8c\u6210\u6563\u6b6530\u5206\u949f/);
  assert.match(updated.originalText, /\u6539\u621020\u5206\u949f/);
});

test("record protocol asks before checking a matching plan item when completion has no quantity", () => {
  const fullStretch = "\u5168\u8eab\u62c9\u4f38";
  const { api, localStorage } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan([`${fullStretch} 5\u5206\u949f`]))
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });

  const result = api.processRecordCandidates([{
    candidateType: "extra_training",
    intent: "new_fact",
    rawText: `\u6211\u5b8c\u6210\u4e86${fullStretch}`,
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: fullStretch },
    needsConfirmation: false,
    confidence: 0.9
  }], { userText: `\u6211\u5b8c\u6210\u4e86${fullStretch}` });

  assert.equal(result.writes.length, 0);
  assert.equal(result.pending.length, 1);
  assert.match(result.assistantFollowUp, /\u6309\u4eca\u5929\u8ba1\u5212|\u786e\u8ba4/);
  const log = api.getDailyLogs()[today];
  const stretch = log.planProgressItems.find((item) => item.snapshotItemText.includes(fullStretch));
  assert.ok(stretch, "expected full-body stretch plan item");
  assert.equal(stretch.status, "active");
  assert.equal(stretch.completedAmount, 0);
  assert.notEqual(api.getPlanChecks()[stretch.planCheckKey], true);
  assert.equal((log.extraTrainingEvents || []).length, 0);
  const pending = JSON.parse(localStorage.getItem("gain-plan-reconciliation-pending"));
  assert.equal(pending.mode, "planned_dose_confirmation");
  assert.equal(pending.exerciseKey, stretch.exerciseKey);
});

test("record protocol reconciles AI extra-training candidates with today's plan dose before checking the item", () => {
  const fullStretch = "\u5168\u8eab\u62c9\u4f38";
  const { api } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan([`${fullStretch} 2\u7ec4 \u6bcf\u7ec460\u79d2`]))
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });

  const result = api.processRecordCandidates([{
    candidateType: "extra_training",
    intent: "new_fact",
    rawText: `\u4eca\u5929${fullStretch}\u505a\u4e862\u7ec4\uff0c\u6bcf\u7ec460\u79d2`,
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: fullStretch },
    amount: 2,
    unit: "set",
    duration: 60,
    durationUnit: "second",
    needsConfirmation: false,
    confidence: 0.9
  }], { userText: `\u4eca\u5929${fullStretch}\u505a\u4e862\u7ec4\uff0c\u6bcf\u7ec460\u79d2` });

  assert.equal(result.writes.length, 1);
  assert.equal(result.writes[0].status, "plan_progress");
  const log = api.getDailyLogs()[today];
  const stretch = log.planProgressItems.find((item) => item.snapshotItemText.includes(fullStretch));
  assert.equal(stretch.completedAmount, 2);
  assert.equal(stretch.status, "completed");
  assert.equal(api.getPlanChecks()[stretch.planCheckKey], true);
  assert.equal((log.extraTrainingEvents || []).length, 0);
});

test("record protocol splits surplus volume after completing the planned dose", () => {
  const fullStretch = "\u5168\u8eab\u62c9\u4f38";
  const { api } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan([`${fullStretch} 2\u7ec4 \u6bcf\u7ec460\u79d2`]))
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });

  const result = api.processRecordCandidates([{
    candidateType: "extra_training",
    intent: "new_fact",
    rawText: `\u4eca\u5929${fullStretch}\u5b8c\u6210\u4e863\u7ec4\uff0c\u6bcf\u7ec460\u79d2`,
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: fullStretch },
    amount: 3,
    unit: "set",
    duration: 60,
    durationUnit: "second",
    needsConfirmation: false,
    confidence: 0.9
  }], { userText: `\u4eca\u5929${fullStretch}\u5b8c\u6210\u4e863\u7ec4\uff0c\u6bcf\u7ec460\u79d2` });

  assert.equal(result.writes.length, 1);
  assert.equal(result.writes[0].status, "plan_progress");
  const log = api.getDailyLogs()[today];
  const stretch = log.planProgressItems.find((item) => item.snapshotItemText.includes(fullStretch));
  assert.equal(stretch.completedAmount, 2);
  assert.equal(stretch.status, "completed");
  assert.equal(api.getPlanChecks()[stretch.planCheckKey], true);
  assert.equal((log.extraTrainingEvents || []).length, 1);
  assert.equal(log.extraTrainingEvents[0].amount, 1);
  assert.equal(log.extraTrainingEvents[0].unit, "\u7ec4");
  assert.equal(log.extraTrainingEvents[0].duration, 60);
  assert.equal(log.extraTrainingEvents[0].durationUnit, "\u79d2");
});

test("record protocol keeps same-day dose mismatches pending instead of writing extra training", () => {
  const fullStretch = "\u5168\u8eab\u62c9\u4f38";
  const { api, localStorage } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan([`${fullStretch} 2\u7ec4 \u6bcf\u7ec460\u79d2`]))
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });

  const result = api.processRecordCandidates([{
    candidateType: "extra_training",
    intent: "new_fact",
    rawText: `\u4eca\u5929${fullStretch}\u505a\u4e862\u7ec4\uff0c\u6bcf\u7ec445\u79d2`,
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: fullStretch },
    amount: 2,
    unit: "set",
    duration: 45,
    durationUnit: "second",
    needsConfirmation: false,
    confidence: 0.9
  }], { userText: `\u4eca\u5929${fullStretch}\u505a\u4e862\u7ec4\uff0c\u6bcf\u7ec445\u79d2` });

  assert.equal(result.writes.length, 0);
  assert.equal(result.pending.length, 1);
  assert.equal(result.pending[0].status, "pending_confirmation");
  const log = api.getDailyLogs()[today];
  const stretch = log.planProgressItems.find((item) => item.snapshotItemText.includes(fullStretch));
  assert.equal(stretch.completedAmount, 0);
  assert.equal(stretch.status, "active");
  assert.notEqual(api.getPlanChecks()[stretch.planCheckKey], true);
  assert.equal((log.extraTrainingEvents || []).length, 0);
  const pending = JSON.parse(localStorage.getItem("gain-plan-reconciliation-pending"));
  assert.equal(pending.mode, "dose_revision");
  assert.equal(pending.reportedDose.duration, 45);
});

test("record protocol treats explicit same-day plan progress without quantity as a confirmation question", () => {
  const fullStretch = "\u5168\u8eab\u62c9\u4f38";
  const { api } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan([`${fullStretch} 5\u5206\u949f`]))
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });

  const result = api.processRecordCandidates([{
    candidateType: "plan_progress",
    intent: "new_fact",
    rawText: `\u6211\u5b8c\u6210\u4e86${fullStretch}`,
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: fullStretch },
    needsConfirmation: false,
    confidence: 0.9
  }], { userText: `\u6211\u5b8c\u6210\u4e86${fullStretch}` });

  assert.equal(result.writes.length, 0);
  assert.equal(result.pending.length, 1);
  const log = api.getDailyLogs()[today];
  const stretch = log.planProgressItems.find((item) => item.snapshotItemText.includes(fullStretch));
  assert.ok(stretch, "expected full-body stretch plan item");
  assert.equal(stretch.status, "active");
  assert.equal(stretch.completedAmount, 0);
  assert.notEqual(api.getPlanChecks()[stretch.planCheckKey], true);
});

test("dose revision confirmation updates only the daily snapshot, checks the plan, and records surplus", async () => {
  const fullStretch = "\u5168\u8eab\u62c9\u4f38";
  const { api, element, localStorage } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan([`${fullStretch} 3\u7ec4 \u6bcf\u7ec460\u79d2`])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });

  api.processRecordCandidates([{
    candidateType: "extra_training",
    intent: "new_fact",
    rawText: `\u4eca\u5929${fullStretch}\u5b8c\u6210\u4e864\u7ec4\uff0c\u6bcf\u7ec445\u79d2`,
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: fullStretch },
    amount: 4,
    unit: "set",
    duration: 45,
    durationUnit: "second",
    needsConfirmation: false,
    confidence: 0.9
  }], { userText: `\u4eca\u5929${fullStretch}\u5b8c\u6210\u4e864\u7ec4\uff0c\u6bcf\u7ec445\u79d2` });

  element("characterChatInput").value = "\u786e\u8ba4";
  await api.sendCharacterChat();

  assert.equal(localStorage.getItem("gain-plan-reconciliation-pending"), null);
  const log = api.getDailyLogs()[today];
  const stretch = log.planProgressItems.find((item) => item.snapshotItemText.includes(fullStretch));
  assert.equal(stretch.targetAmount, 3);
  assert.match(stretch.snapshotItemText, /45\u79d2/);
  assert.match(stretch.plannedDurationText, /45\u79d2/);
  assert.equal(stretch.completedAmount, 3);
  assert.equal(stretch.status, "completed");
  assert.equal(api.getPlanChecks()[stretch.planCheckKey], true);
  assert.equal((log.extraTrainingEvents || []).length, 1);
  assert.equal(log.extraTrainingEvents[0].amount, 1);
  assert.equal(log.extraTrainingEvents[0].duration, 45);
  assert.equal(log.extraTrainingEvents[0].durationUnit, "\u79d2");
  const storedTemplate = JSON.parse(localStorage.getItem("gain-plan-template"));
  assert.match(storedTemplate.days[6].items[0], /60\u79d2/);
});

test("dose revision rejection keeps the plan unchecked and saves the reported work as actual training only", async () => {
  const fullStretch = "\u5168\u8eab\u62c9\u4f38";
  const { api, element, localStorage } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan([`${fullStretch} 3\u7ec4 \u6bcf\u7ec460\u79d2`])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });

  api.processRecordCandidates([{
    candidateType: "extra_training",
    intent: "new_fact",
    rawText: `\u4eca\u5929${fullStretch}\u5b8c\u6210\u4e864\u7ec4\uff0c\u6bcf\u7ec445\u79d2`,
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: fullStretch },
    amount: 4,
    unit: "set",
    duration: 45,
    durationUnit: "second",
    needsConfirmation: false,
    confidence: 0.9
  }], { userText: `\u4eca\u5929${fullStretch}\u5b8c\u6210\u4e864\u7ec4\uff0c\u6bcf\u7ec445\u79d2` });

  element("characterChatInput").value = "\u4e0d\u7528\u6539\uff0c\u53ea\u8bb0\u5f55";
  await api.sendCharacterChat();

  assert.equal(localStorage.getItem("gain-plan-reconciliation-pending"), null);
  const log = api.getDailyLogs()[today];
  const stretch = log.planProgressItems.find((item) => item.snapshotItemText.includes(fullStretch));
  assert.match(stretch.snapshotItemText, /60\u79d2/);
  assert.equal(stretch.completedAmount, 0);
  assert.notEqual(api.getPlanChecks()[stretch.planCheckKey], true);
  assert.equal((log.extraTrainingEvents || []).length, 1);
  assert.equal(log.extraTrainingEvents[0].amount, 4);
  assert.equal(log.extraTrainingEvents[0].duration, 45);
});

test("role chat displays only reply while hidden candidates commit through record protocol", async () => {
  const envelope = {
    reply: "收到，深蹲先记 1 组。",
    record_candidates: [{
      candidateType: "plan_progress",
      intent: "new_fact",
      rawText: "我完成了一组深蹲",
      targetDate: "today",
      exerciseRef: { type: "mentioned", displayName: "深蹲" },
      amount: 1,
      unit: "set",
      needsConfirmation: false,
      confidence: 0.9
    }]
  };
  const { api, element } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan(["深蹲 3组 × 10次"])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    fetchJson: { choices: [{ message: { content: JSON.stringify(envelope) } }] }
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });
  element("characterChatInput").value = "我完成了一组深蹲";

  await api.sendCharacterChat();

  const history = api.getCharacterChatHistory();
  const latest = history.at(-1);
  assert.equal(latest.role, "assistant");
  assert.equal(latest.content, "收到，深蹲先记 1 组。");
  assert.doesNotMatch(latest.content, /record_candidates|candidateType/);
  const log = api.getDailyLogs()[today];
  const records = Array.isArray(log.records) ? log.records : [];
  assert.equal(records.length, 1);
  assert.equal(records[0].type, "plan_progress");
  assert.equal(records[0].exerciseName, "深蹲");
  assert.equal(records[0].amount, 1);
  assert.equal(records[0].unit, "set");
  assert.ok(records[0].aiCapture);
  assert.equal((log.aiCaptureRecords || []).length, 0);
  const debug = api.getRecordProtocolLastDebug();
  assert.equal(debug.engineResult.decisions[0].decision, "written");
  assert.equal(debug.deterministicCaptureResult.status, "skipped");
});

test("role chat commits AI candidates through RecordProtocolEngine and skips deterministic fallback", async () => {
  const envelope = {
    reply: "记下了：周六平板支撑 3 组。",
    record_candidates: [{
      candidateType: "plan_progress",
      evidenceText: "\u5468\u516d\u5e73\u677f\u652f\u6491\u5b8c\u6210 3 \u7ec4",
      targetDateText: "\u8fd9\u5468\u516d",
      targetDateIso: "2026-05-10",
      dateSource: "explicit",
      exerciseRef: { type: "mentioned", displayName: "\u5e73\u677f\u652f\u6491" },
      amount: 3,
      unit: "set",
      writeIntent: "auto",
      needsConfirmation: false,
      confidence: 0.93
    }]
  };
  const { api, element } = loadApp({
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    now: new Date(2026, 4, 17, 12, 0, 0),
    fetchJson: { choices: [{ message: { content: JSON.stringify(envelope) } }] }
  });

  element("characterChatInput").value = "\u5468\u516d\u5e73\u677f\u652f\u6491\u5b8c\u6210 3 \u7ec4";

  await api.sendCharacterChat();

  const latest = api.getCharacterChatHistory().at(-1);
  assert.equal(latest.role, "assistant");
  assert.equal(latest.content, "记下了：周六平板支撑 3 组。");
  assert.doesNotMatch(latest.content, /record_candidates|candidateType/);

  const logs = api.getDailyLogs();
  const saturdayRecords = logs["2026-05-16"].records;
  assert.equal(saturdayRecords.length, 1);
  assert.equal(saturdayRecords[0].type, "plan_progress");
  assert.equal(saturdayRecords[0].exerciseName, "\u5e73\u677f\u652f\u6491");
  assert.equal(saturdayRecords[0].amount, 3);
  assert.equal(saturdayRecords[0].unit, "set");
  assert.equal(logs["2026-05-10"], undefined);

  const debug = api.getRecordProtocolLastDebug();
  assert.equal(debug.protocolOutput.protocolVersion, "record-protocol/v1");
  assert.equal(debug.engineResult.decisions[0].decision, "written");
  assert.equal(debug.engineResult.decisions[0].targetDateIso, "2026-05-16");
  assert.equal(debug.deterministicCaptureResult.status, "skipped");
  assert.equal(debug.deterministicCaptureResult.reason, "not_training_or_already_handled");
});

test("role chat preserves deterministic fallback when engine has no write or pending decision", async () => {
  const envelope = {
    reply: "收到，我按你说的记录。",
    record_candidates: []
  };
  const { api, element } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan(["\u6df1\u8e72 3\u7ec4 \u00d7 10\u6b21"])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    fetchJson: { choices: [{ message: { content: JSON.stringify(envelope) } }] }
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });
  element("characterChatInput").value = "\u6211\u5b8c\u6210\u4e86\u4e00\u7ec4\u6df1\u8e72";

  await api.sendCharacterChat();

  const latest = api.getCharacterChatHistory().at(-1);
  assert.equal(latest.role, "assistant");
  assert.equal(latest.content, "收到，我按你说的记录。");
  assert.doesNotMatch(latest.content, /record_candidates|candidateType/);

  const log = api.getDailyLogs()[today];
  const squat = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u6df1\u8e72"));
  assert.equal(squat.completedAmount, 1);
  assert.equal((log.aiCaptureRecords || []).length, 1);

  const debug = api.getRecordProtocolLastDebug();
  assert.equal(debug.protocolOutput.protocolVersion, "record-protocol/v1");
  assert.equal(debug.engineResult.decisions.length, 0);
  assert.equal(debug.deterministicCaptureResult.status, "recorded");
  assert.equal(debug.deterministicCaptureResult.record.structuredWrite.status, "plan_progress");
});

test("role chat protocol fallback reconciles duration-only walking completion with today's plan", async () => {
  const envelopeText = "{ not json";
  const { api, element } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan(["\u6563\u6b65 20\u5206\u949f"])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    fetchJson: { choices: [{ message: { content: envelopeText } }] }
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });
  element("characterChatInput").value = "\u5b8c\u6210\u6563\u6b6520\u5206\u949f";

  await api.sendCharacterChat();

  const latest = api.getCharacterChatHistory().at(-1);
  assert.match(latest.content, /\u672c\u5730\u89c4\u5219|\u8bb0\u5f55/);
  const log = api.getDailyLogs()[today];
  const walking = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u6563\u6b65"));
  assert.equal(walking.completedAmount, 20);
  assert.equal(walking.status, "completed");
  assert.equal(api.getPlanChecks()[walking.planCheckKey], true);
  const debug = api.getRecordProtocolLastDebug();
  assert.equal(debug.appReconciliationResult.writes[0].status, "plan_progress");
});

test("role chat deterministic fallback captures and reconciles multiple duration facts in one message", async () => {
  const ordinaryRoleReply = "\u8be7\uff1f\u6563\u6b6530\u5206\u949f\u3001\u62c9\u4f3815\u5206\u949f\uff1f";
  const { api, element } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan([
      "\u6563\u6b65 20\u5206\u949f",
      "\u62c9\u4f38 5-10\u5206\u949f",
      "\u591a\u5403\uff0c\u591a\u7761"
    ])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    now: "2026-05-17T12:00:00+08:00",
    fetchJson: { choices: [{ message: { content: ordinaryRoleReply } }] }
  });
  const today = "2026-05-17";
  api.ensureDailyLogSnapshot(today, { persist: true });
  element("characterChatInput").value = "\u4eca\u5929\u6563\u6b6530\u5206\u949f\uff0c\u62c9\u4f3815\u5206\u949f";

  await api.sendCharacterChat();

  const latest = api.getCharacterChatHistory().at(-1);
  assert.equal(latest.role, "assistant");
  assert.match(latest.content, /\u6563\u6b65/);

  const log = api.getDailyLogs()[today];
  const walking = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u6563\u6b65"));
  const stretching = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u62c9\u4f38"));
  assert.equal(walking.status, "completed");
  assert.equal(walking.completedAmount, 20);
  assert.equal(api.getPlanChecks()[walking.planCheckKey], true);
  assert.equal(stretching.status, "completed");
  assert.equal(api.getPlanChecks()[stretching.planCheckKey], true);

  const records = log.aiCaptureRecords || [];
  assert.ok(records.some((record) => record.currentValue?.exercise === "\u6563\u6b65" && Number(record.currentValue?.duration) === 30));
  assert.ok(records.some((record) => record.currentValue?.exercise === "\u62c9\u4f38" && Number(record.currentValue?.duration) === 15));
  assert.ok(!records.some((record) => String(record.currentValue?.exercise || "").includes("\u591a\u5403")));

  const extras = log.extraTrainingEvents || [];
  assert.ok(extras.some((event) => event.snapshotDisplayName === "\u6563\u6b65" && Number(event.amount) === 10));
  assert.ok(extras.some((event) => event.snapshotDisplayName === "\u62c9\u4f38" && Number(event.amount) === 5));
});

test("role chat protocol local fallback splits multiple duration facts before deterministic fallback", async () => {
  const { api, element } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan([
      "\u6563\u6b65 20\u5206\u949f",
      "\u62c9\u4f38 5-10\u5206\u949f"
    ])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    now: "2026-05-17T12:00:00+08:00",
    fetchJson: { choices: [{ message: { content: "{ not json" } }] }
  });
  const today = "2026-05-17";
  api.ensureDailyLogSnapshot(today, { persist: true });
  element("characterChatInput").value = "\u5b8c\u6210\u6563\u6b6530\u5206\u949f\uff0c\u62c9\u4f3815\u5206\u949f";

  await api.sendCharacterChat();

  const log = api.getDailyLogs()[today];
  const walking = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u6563\u6b65"));
  const stretching = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u62c9\u4f38"));
  assert.equal(walking.status, "completed");
  assert.equal(stretching.status, "completed");
  assert.equal(api.getPlanChecks()[walking.planCheckKey], true);
  assert.equal(api.getPlanChecks()[stretching.planCheckKey], true);

  const debug = api.getRecordProtocolLastDebug();
  assert.equal(debug.usedProtocolLocalFallback, true);
  assert.equal(debug.appReconciliationResult.writes.length, 2);
  assert.equal(debug.deterministicCaptureResult.status, "skipped");
});

test("role chat per-set duration follow-up after checked plan enters dose revision pending", async () => {
  const { api, element, localStorage } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan([
      "\u5e73\u677f\u652f\u6491 4\u7ec4 \u6bcf\u7ec460\u79d2"
    ])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    now: "2026-05-17T13:31:00+08:00",
    fetchJson: { choices: [{ message: { content: "{ not json" } }] }
  });
  const saturday = "2026-05-16";
  api.ensureDailyLogSnapshot(saturday, { persist: true });

  element("characterChatInput").value = "\u6211\u5468\u516d\u5b8c\u62104\u7ec4\u5e73\u677f\u652f\u6491";
  await api.sendCharacterChat();

  let log = api.getDailyLogs()[saturday];
  let plank = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u5e73\u677f\u652f\u6491"));
  assert.equal(plank.completedAmount, 4);
  assert.equal(plank.status, "completed");
  assert.equal(api.getPlanChecks()[plank.planCheckKey], true);
  assert.equal(api.getActiveTrainingReference()?.targetDate, saturday);
  assert.equal(api.getActiveTrainingReference()?.displayName, "\u5e73\u677f\u652f\u6491");
  const recordCountBeforeDoseFollowUp = (log.aiCaptureRecords || []).length;

  element("characterChatInput").value = "\u6bcf\u7ec4\u7684\u5e73\u677f\u652f\u6491\u65f6\u95f4\u662f45\u79d2";
  await api.sendCharacterChat();

  log = api.getDailyLogs()[saturday];
  plank = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u5e73\u677f\u652f\u6491"));
  assert.equal(plank.completedAmount, 4);
  assert.equal(plank.status, "completed");
  assert.equal((log.aiCaptureRecords || []).length, recordCountBeforeDoseFollowUp);
  const pending = JSON.parse(localStorage.getItem("gain-plan-reconciliation-pending"));
  assert.equal(pending.mode, "dose_revision");
  assert.equal(pending.targetDate, saturday);
  assert.equal(pending.displayName, "\u5e73\u677f\u652f\u6491");
  assert.equal(pending.reportedDose.sets, 4);
  assert.equal(pending.reportedDose.duration, 45);
  assert.equal(pending.reportedDose.durationUnit, "\u79d2");
  assert.match(api.getCharacterChatHistory().at(-1).content, /45\u79d2|\u786e\u8ba4|\u8ba1\u5212/);
});

test("role chat deterministic fallback reconciles multiple duration facts on a recovery day", async () => {
  const { api, element } = loadApp({
    "gain-plan-template": JSON.stringify(makeSundayRecoveryPlan([
      "\u6563\u6b65 20\u5206\u949f",
      "\u62c9\u4f38 5-10\u5206\u949f",
      "\u591a\u5403\uff0c\u591a\u7761"
    ])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    now: "2026-05-17T12:00:00+08:00",
    fetchJson: { choices: [{ message: { content: "\u8be7\uff1f\u4eca\u5929\u8fd8\u6563\u6b65\u548c\u62c9\u4f38\uff1f" } }] }
  });
  const today = "2026-05-17";
  const before = api.ensureDailyLogSnapshot(today, { persist: true });
  assert.equal(before.dayType, "note_only");
  element("characterChatInput").value = "\u4eca\u5929\u6563\u6b6530\u5206\u949f\uff0c\u62c9\u4f3815\u5206\u949f";

  await api.sendCharacterChat();

  const log = api.getDailyLogs()[today];
  const walking = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u6563\u6b65"));
  const stretching = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u62c9\u4f38"));
  assert.equal(log.dayType, "note_only");
  assert.equal(walking.completedAmount, 20);
  assert.equal(walking.status, "completed");
  assert.equal(api.getPlanChecks()[walking.planCheckKey], true);
  assert.equal(stretching.completedAmount, 10);
  assert.equal(stretching.status, "completed");
  assert.equal(api.getPlanChecks()[stretching.planCheckKey], true);

  const extras = log.extraTrainingEvents || [];
  assert.ok(extras.some((event) => event.snapshotDisplayName === "\u6563\u6b65" && Number(event.amount) === 10));
  assert.ok(extras.some((event) => event.snapshotDisplayName === "\u62c9\u4f38" && Number(event.amount) === 5));
  assert.match(log.aiDailySummary?.text || "", /\u8ba1\u5212\u8fdb\u5ea6/);
  assert.match(log.aiDailySummary?.text || "", /\u989d\u5916\u8bad\u7ec3/);
});

test("role chat local fallback can check every exercisable weekly JSON plan item", async () => {
  const cases = getWeeklyPlanChatCompletionCases();
  assert.ok(cases.length > 100, "diagnostic coverage should span the real weekly plan JSON files");
  const failures = [];

  for(const scenario of cases) {
    const { api, element } = loadApp({
      "gain-plan-template": JSON.stringify(scenario.plan),
      "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
      "gain-active-character-card-id": "role-1",
      "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
    }, {
      now: scenario.date,
      fetchJson: { choices: [{ message: { content: "{ not json" } }] }
    });

    api.ensureDailyLogSnapshot(scenario.dateIso, { persist: true });
    const beforeLog = api.getDailyLogs()[scenario.dateIso];
    const beforeItem = (beforeLog?.planProgressItems || [])
      .find((item) => item.snapshotItemText === scenario.item);
    if(!beforeItem) {
      failures.push({
        file:scenario.file,
        day:scenario.dayName,
        item:scenario.item,
        reason:"missing_plan_progress_item_before_chat",
        dayType:beforeLog?.dayType || ""
      });
      continue;
    }

    element("characterChatInput").value = `我完成了${scenario.item}`;
    await api.sendCharacterChat();

    const log = api.getDailyLogs()[scenario.dateIso];
    const progress = (log?.planProgressItems || [])
      .find((item) => item.snapshotItemText === scenario.item);
    const checked = progress ? api.getPlanChecks()[progress.planCheckKey] === true : false;
    if(!progress || progress.status !== "completed" || !checked) {
      const debug = api.getRecordProtocolLastDebug();
      failures.push({
        file:scenario.file,
        day:scenario.dayName,
        item:scenario.item,
        reason:!progress ? "missing_progress_after_chat" : "not_completed_or_unchecked",
        status:progress?.status || "",
        completedAmount:progress?.completedAmount ?? null,
        targetAmount:progress?.targetAmount ?? null,
        unit:progress?.unit || "",
        checked,
        processWrites:debug?.processResult?.writes?.map((write) => write.status || write.reason || write.decision) || [],
        processPending:debug?.processResult?.pending?.map((pending) => pending.reason || pending.status || pending.decision) || [],
        deterministic:debug?.deterministicCaptureResult?.status || "",
        usedProtocolLocalFallback:debug?.usedProtocolLocalFallback,
        candidates:debug?.protocolOutput?.candidates?.map((candidate) => ({
          candidateType:candidate.candidateType,
          rawText:candidate.rawText,
          evidenceText:candidate.evidenceText,
          needsConfirmation:candidate.needsConfirmation,
          reason:candidate.reason,
          exerciseRef:candidate.exerciseRef,
          itemId:candidate.itemId
        })) || []
      });
    }
  }

  assert.deepEqual(failures, []);
});

test("role chat does not let deterministic fallback override model candidates", async () => {
  const envelope = {
    reply: "我先确认一下，不直接写入。",
    record_candidates: [{
      candidateType: "extra_training",
      confidence: 0.96,
      evidenceText: "今天做了30个俯卧撑",
      targetDateText: "today",
      exerciseRef: { type: "mentioned", displayName: "俯卧撑" },
      amount: 30,
      unit: "rep",
      writeIntent: "ignore"
    }]
  };
  const { api, element } = loadApp({
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    fetchJson: { choices: [{ message: { content: JSON.stringify(envelope) } }] }
  });
  element("characterChatInput").value = "今天做了30个俯卧撑";

  await api.sendCharacterChat();

  const writtenFacts = Object.values(api.getDailyLogs()).flatMap((log) => [
    ...(Array.isArray(log.records) ? log.records : []),
    ...(Array.isArray(log.aiCaptureRecords) ? log.aiCaptureRecords : []),
    ...(Array.isArray(log.extraTrainingEvents) ? log.extraTrainingEvents : [])
  ]);
  const debug = api.getRecordProtocolLastDebug();
  assert.equal(writtenFacts.length, 0, JSON.stringify({ writtenFacts, debug }, null, 2));
  assert.equal(debug.aiCandidateCount, 1);
  assert.equal(debug.usedProtocolLocalFallback, false);
  assert.equal(debug.engineResult.decisions[0].decision, "ignored");
  assert.equal(debug.deterministicCaptureResult.status, "skipped");
  assert.equal(debug.deterministicCaptureResult.reason, "model_candidates_already_decided");
});

test("role chat start-training request opens today's session and enters coach mode", async () => {
  const fetchBodies = [];
  const envelope = {
    reply: "开练。我会按今天计划盯节奏。",
    record_candidates: []
  };
  const { api, element, localStorage } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan(["哑铃杯式深蹲 3组 × 10次"])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    fetchJson: { choices: [{ message: { content: JSON.stringify(envelope) } }] },
    onFetch(_url, init) {
      fetchBodies.push(JSON.parse(init.body));
    }
  });
  const today = api.formatDateKey(new Date());
  element("characterChatInput").value = "我要开始今天训练了";

  await api.sendCharacterChat();

  const session = JSON.parse(localStorage.getItem("gain-training-session"));
  assert.equal(session.status, "active");
  assert.equal(session.date, today);
  const systemPrompt = fetchBodies[0].messages[0].content;
  assert.match(systemPrompt, /训练会话教练模式/);
  assert.match(systemPrompt, /训练会话中必须继续遵循角色卡/);
  assert.doesNotMatch(systemPrompt, /角色卡只影响表达风格/);
  assert.match(systemPrompt, /activeTrainingSession/);
  assert.equal(api.getCharacterChatHistory().at(-1).content, "开练。我会按今天计划盯节奏。");
});

test("active training session hides protocol reasoning text from visible role chat", async () => {
  const leakedReasoning = [
    "我们刚刚开始训练，用户说完成了两组下斜俯卧撑。",
    "记录候选：plan_progress，动作名“下斜俯卧撑”，组数2，但每组次数未知，所以可以设置 needsConfirmation=true。",
    "只先记录两组，等问他次数后再补全。"
  ].join("\n");
  const { api, element } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan(["下斜俯卧撑 3组 × 10-15次"])),
    "gain-character-cards": JSON.stringify([{ id: "anna", name: "Anna Yanami", personality: "傲娇、吐槽、第一人称陪练" }]),
    "gain-active-character-card-id": "anna",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    fetchJson: { choices: [{ message: { content: leakedReasoning } }] }
  });

  element("characterChatInput").value = "我要开始今天训练了";
  await api.sendCharacterChat();
  element("characterChatInput").value = "下斜俯卧撑";
  await api.sendCharacterChat();

  const latest = api.getCharacterChatHistory().at(-1);
  assert.equal(latest.role, "assistant");
  assert.doesNotMatch(latest.content, /记录候选|plan_progress|needsConfirmation|record_candidates|candidateType/);
  assert.match(latest.content, /记录格式|本地规则|确认|记录/);
});

test("role chat finish-training request saves the active session", async () => {
  const envelope = { reply: "收到，本次训练结束并保存。", record_candidates: [] };
  const { api, element, localStorage } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan(["哑铃杯式深蹲 3组 × 10次"])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    fetchJson: { choices: [{ message: { content: JSON.stringify(envelope) } }] }
  });

  element("characterChatInput").value = "我要开始今天训练了";
  await api.sendCharacterChat();
  const session = JSON.parse(localStorage.getItem("gain-training-session"));

  element("characterChatInput").value = "结束训练并保存";
  await api.sendCharacterChat();

  assert.equal(localStorage.getItem("gain-training-session"), null);
  const log = api.getDailyLogs()[session.date];
  assert.ok(log.aiCaptureRecords.some((record) => record.sourceType === "training_session"));
});

test("role chat discard-training request abandons the active session without writing facts", async () => {
  const envelope = { reply: "收到，本次训练已放弃。", record_candidates: [] };
  const { api, element, localStorage } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan(["哑铃杯式深蹲 3组 × 10次"])),
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" })
  }, {
    fetchJson: { choices: [{ message: { content: JSON.stringify(envelope) } }] }
  });

  element("characterChatInput").value = "我要开始今天训练了";
  await api.sendCharacterChat();
  assert.ok(localStorage.getItem("gain-training-session"));

  element("characterChatInput").value = "放弃训练";
  await api.sendCharacterChat();

  assert.equal(localStorage.getItem("gain-training-session"), null);
  assert.equal(Object.keys(api.getDailyLogs()).length, 0);
});

test("completed plan progress caps at target and later volume becomes extra training", () => {
  const { api } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan(["深蹲 3组 × 10次"]))
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });

  api.processRecordCandidates([{
    candidateType: "plan_progress",
    rawText: "今天深蹲 3 组",
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: "深蹲" },
    amount: 3,
    unit: "set",
    needsConfirmation: false
  }], { userText: "今天深蹲 3 组" });

  api.processRecordCandidates([{
    candidateType: "plan_progress",
    rawText: "我又做了一组深蹲",
    targetDate: "today",
    exerciseRef: { type: "mentioned", displayName: "深蹲" },
    amount: 1,
    unit: "set",
    needsConfirmation: false
  }], { userText: "我又做了一组深蹲" });

  const log = api.getDailyLogs()[today];
  const squat = log.planProgressItems.find((item) => item.snapshotItemText.includes("深蹲"));
  assert.equal(squat.completedAmount, 3);
  assert.equal(squat.status, "completed");
  assert.equal((log.extraTrainingEvents || []).length, 1);
  assert.equal((log.aiCaptureRecords || []).length, 0);
});

test("ambiguous continuation candidates ask in chat and do not write facts", () => {
  const { api } = loadApp({
    "gain-plan-template": JSON.stringify(makeSevenDayPlan(["深蹲 3组 × 10次", "划船 3组 × 10次"]))
  });
  const today = api.formatDateKey(new Date());
  api.ensureDailyLogSnapshot(today, { persist: true });

  const result = api.processRecordCandidates([{
    candidateType: "plan_progress",
    rawText: "又一组",
    targetDate: "today",
    exerciseRef: { type: "unknown" },
    amount: 1,
    unit: "set",
    needsConfirmation: true,
    reason: "你是指深蹲还是划船？"
  }], { userText: "又一组" });

  const log = api.getDailyLogs()[today];
  assert.equal(result.pending.length, 1);
  assert.equal(result.assistantFollowUp, "你是指深蹲还是划船？");
  assert.equal(log.planProgressItems.reduce((sum, item) => sum + Number(item.completedAmount || 0), 0), 0);
  assert.equal((log.aiCaptureRecords || []).length, 0);
});
