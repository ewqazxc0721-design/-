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

function createFixedDateClass(now = new Date(2026, 4, 17, 12, 0, 0)) {
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
      crypto: { randomUUID: () => "record-protocol-v2-test-id" },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {},
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
                upsert() { return this; },
                eq() { return this; },
                single: async () => ({ data: null, error: null })
              };
            }
          };
        }
      }
    },
    navigator: { standalone: false },
    crypto: { randomUUID: () => "record-protocol-v2-test-id" },
    localStorage,
    alert() {},
    confirm() { return true; },
    requestAnimationFrame(callback) { return callback(); },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    AbortController: class {
      constructor() {
        this.signal = {};
      }
      abort() {}
    },
    fetch: async (url, init = {}) => {
      if(typeof options.onFetch === "function") options.onFetch(url, init);
      return { ok: true, json: async () => options.fetchJson || {} };
    },
    Date: TestDate
  });

  vm.runInContext(html.slice(scriptStart, initStart), context, { filename: "index.html" });
  vm.runInContext(`
    globalThis.__testApi = {
      buildCompactRecordProtocolRequest,
      applyRecordProtocol,
      sendCharacterChat,
      getCharacterChatHistory,
      getRecordProtocolLastDebug,
      normalizeCharacterModelOutputText,
      parseCharacterRecordEnvelope,
      adaptAiRecordEnvelope,
      getExerciseLibrary,
      readExerciseLibraryAction,
      RecordProtocolLiveDiagnostics: window.RecordProtocolLiveDiagnostics
    };
  `, context);
  context.__testApi.__element = (id) => document.getElementById(id);
  context.__testApi.__localStorage = localStorage;
  return context.__testApi;
}

function makeCompactRequest(api, overrides = {}) {
  return api.buildCompactRecordProtocolRequest({
    userText: "\u4eca\u5929\u5fc3\u60c5\u8fd8\u4e0d\u9519\uff0c\u60f3\u804a\u4f1a\u513f",
    protocolId: "record-protocol/v2",
    todayIso: "2026-05-17",
    userTimeZone: "Asia/Shanghai",
    visibleWeekDates: WEEK_DATES,
    ...overrides
  });
}

function applySingleCandidate(api, candidate) {
  return api.applyRecordProtocol({
    protocolOutput: {
      protocolVersion: "record-protocol/v2",
      source: {
        kind: "chat",
        messageId: "v2-risk-test-message",
        capturedAtIso: "2026-05-17T10:00:00+08:00",
        rawTextHash: "v2-risk-hash",
        rawTextPreview: "v2 risk test"
      },
      reply: "ok",
      record_candidates: [candidate]
    },
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "Asia/Shanghai",
      visibleWeekDates: WEEK_DATES
    },
    currentState: {
      dailyLogs: {},
      captureAttempts: [],
      visibleWeekDates: WEEK_DATES
    }
  });
}

function loadCharacterChatApp(options = {}) {
  const fetchBodies = [];
  const api = loadApp({
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-ai-settings": JSON.stringify({ apiMode: "direct", apiKey: "test-key" }),
    ...(options.localStorageValues || {})
  }, {
    fetchJson: options.fetchJson || { choices: [{ message: { content: options.modelText || "\u597d\u7684" } }] },
    onFetch(_url, init) {
      fetchBodies.push(JSON.parse(init.body));
    }
  });
  return { api, fetchBodies };
}

const CUSTOM_BEAR_PRESS_ACTION = {
  exerciseKey: "custom-bear-shoulder-press",
  displayName: "\u718a\u722c\u80a9\u63a8",
  aliases: ["\u718a\u722c\u80a9\u63a8", "\u718a\u5f0f\u80a9\u63a8"],
  status: "confirmed",
  userCreated: true
};

test("compact record protocol request keeps ordinary chat out of record mode", () => {
  const api = loadApp();

  const request = makeCompactRequest(api);

  assert.equal(request.protocolId, "record-protocol/v2");
  assert.equal(request.mode, "ordinary_chat");
  assert.equal(request.recordProtocolPrompt, "");
  assert.equal(request.trainingContextPrompt, "");
  assert.equal(Array.isArray(request.historyTurns), true);
  assert.equal(request.historyTurns.length, 0);
  assert.equal(request.maxOutputTokens, 300);
});

test("compact record protocol request recognizes merged exercise-library actions outside legacy aliases", () => {
  const api = loadApp({
    "gain-exercise-library-custom": JSON.stringify([CUSTOM_BEAR_PRESS_ACTION])
  });

  const request = makeCompactRequest(api, {
    userText: "\u4eca\u5929\u718a\u5f0f\u80a9\u63a8\u505a\u4e861\u7ec4"
  });

  assert.equal(request.mode, "compact_record_extraction");
  assert.match(request.recordProtocolPrompt, /record_candidates/);
  assert.doesNotMatch(JSON.stringify(request.messages), /old training turn/);
});

test("compact record protocol request treats per-set duration facts as training records", () => {
  const api = loadApp();

  const request = makeCompactRequest(api, {
    userText: "\u8fd9\u5468\u516d\u7684\u5e73\u677f\u652f\u6491\uff0c\u6bcf\u7ec4\u7684\u65f6\u95f4\u662f60\u79d2"
  });

  assert.equal(request.mode, "compact_record_extraction");
  assert.match(request.recordProtocolPrompt, /record_candidates/);
  assert.equal(request.messages.at(-1).content, "\u8fd9\u5468\u516d\u7684\u5e73\u677f\u652f\u6491\uff0c\u6bcf\u7ec4\u7684\u65f6\u95f4\u662f60\u79d2");
});

test("compact record protocol request omits chat history for self-contained record facts", () => {
  const api = loadApp();
  const history = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `old training turn ${index + 1}`
  }));

  const request = makeCompactRequest(api, {
    userText: "\u4eca\u5929\u6df1\u8e72\u505a\u4e86 3 \u7ec4",
    characterChatHistory: history,
    activeTrainingReference: {
      exerciseName: "\u6df1\u8e72",
      planItemText: "\u6df1\u8e72 3 \u7ec4"
    }
  });

  assert.equal(request.mode, "compact_record_extraction");
  assert.match(request.recordProtocolPrompt, /record_candidates/);
  assert.match(request.recordProtocolPrompt, /no analysis/i);
  assert.match(request.recordProtocolPrompt, /modify_record_fields/);
  assert.match(request.recordProtocolPrompt, /delete_record/);
  assert.match(request.trainingContextPrompt, /2026-05-17/);
  assert.ok(request.recordProtocolPrompt.length <= 900);
  assert.ok(request.trainingContextPrompt.length <= 700);
  assert.equal(request.historyTurns.length, 0);
  assert.equal(request.messages[0].role, "system");
  assert.equal(request.messages.at(-1).role, "user");
  assert.equal(request.messages.at(-1).content, request.userText);
  assert.doesNotMatch(JSON.stringify(request.messages), /old training turn/);
});

test("compact record protocol request keeps at most three relevant history summaries for corrections", () => {
  const api = loadApp();
  const history = [
    { role: "user", content: "irrelevant weekend chat" },
    { role: "user", content: "\u5e73\u677f\u652f\u6491 related turn 1" },
    { role: "assistant", content: "\u5e73\u677f\u652f\u6491 related turn 2" },
    { role: "user", content: "\u5e73\u677f\u652f\u6491 related turn 3" },
    { role: "assistant", content: "\u5e73\u677f\u652f\u6491 related turn 4" },
    { role: "user", content: "\u5e73\u677f\u652f\u6491 related turn 5" }
  ];

  const request = makeCompactRequest(api, {
    userText: "\u521a\u624d\u90a3\u4e2a\u6539\u5230\u5468\u516d",
    characterChatHistory: history,
    activeTrainingReference: {
      exerciseName: "\u5e73\u677f\u652f\u6491"
    }
  });

  assert.equal(request.mode, "complex_correction");
  assert.equal(request.historyTurns.length, 3);
  assert.equal(request.historyTurns[0].content.includes("related turn 3"), true);
  assert.equal(request.historyTurns[2].content.includes("related turn 5"), true);
  assert.ok(request.historyTurns.every((turn) => turn.content.length <= 180));
  assert.doesNotMatch(JSON.stringify(request.messages), /irrelevant weekend chat/);
});

test("complex record protocol request frames history as context, not chat turns", () => {
  const api = loadApp();
  const history = [
    { role: "user", content: "\u5468\u4e00\u5355\u81c2\u54d1\u94c3\u5212\u8239\u52a0\u7ec33\u7ec4\uff0c\u6bcf\u7ec410\u6b21\uff0c\u665a\u4e0a8\u70b9" },
    { role: "assistant", content: "\u5df2\u8bc6\u522b\u5468\u4e00\u5355\u81c2\u54d1\u94c3\u5212\u8239 3 \u7ec4" }
  ];

  const request = makeCompactRequest(api, {
    userText: "\u521a\u624d\u90a3\u4e2a\u53c8\u8865\u4e86\u4e00\u7ec4\uff0c\u6bcf\u7ec412\u6b21",
    characterChatHistory: history,
    activeTrainingReference: {
      exerciseName: "\u5355\u81c2\u54d1\u94c3\u5212\u8239"
    }
  });

  assert.equal(request.mode, "complex_correction");
  assert.equal(request.messages.length, 2);
  assert.equal(request.messages[0].role, "system");
  assert.equal(request.messages[1].role, "user");
  assert.match(request.messages[0].content, /recent relevant history/i);
  assert.match(request.messages[0].content, /Do not return empty record_candidates/i);
  assert.match(request.messages[0].content, /first character must be \{/i);
  assert.doesNotMatch(JSON.stringify(request.messages.slice(1)), /\u5355\u81c2\u54d1\u94c3\u5212\u8239\u52a0\u7ec33\u7ec4/);
});

test("complex delete requests are prompted to emit pending correction candidates", () => {
  const api = loadApp();
  const request = makeCompactRequest(api, {
    userText: "\u5220\u9664\u521a\u624d\u90a3\u6761\u80f8\u80cc\u62c9\u4f38\u8bb0\u5f55\uff0c\u4e0d\u8981\u8bb0\u4e86",
    activeTrainingReference: {
      exerciseName: "\u80f8\u80cc\u62c9\u4f38"
    }
  });

  assert.equal(request.mode, "complex_correction");
  assert.match(request.messages[0].content, /delete_record/);
  assert.match(request.messages[0].content, /needsConfirmation=true/);
  assert.match(request.messages[0].content, /Do not return empty record_candidates/i);
});

test("compact record protocol request clips long user text and marks truncation", () => {
  const api = loadApp();

  const request = makeCompactRequest(api, {
    userText: "x".repeat(80),
    tokenBudget: {
      maxUserTextChars: 24
    }
  });

  assert.equal(request.userTextTruncated, true);
  assert.equal(request.userText.length, 24);
  assert.match(request.userText, /\[truncated\]$/);
  assert.equal(request.messages.at(-1).content, request.userText);
});

test("character model output normalization reads common API response shapes", () => {
  const api = loadApp();
  const envelope = JSON.stringify({
    reply: "ok",
    record_candidates: []
  });

  assert.equal(api.normalizeCharacterModelOutputText({
    choices: [{
      message: {
        content: [{ type: "text", text: envelope }]
      }
    }]
  }), envelope);
  assert.equal(api.normalizeCharacterModelOutputText({
    choices: [{
      message: {
        reasoning_content: envelope
      }
    }]
  }), envelope);
  assert.equal(api.normalizeCharacterModelOutputText({
    choices: [{
      text: envelope
    }]
  }), envelope);
  assert.equal(api.normalizeCharacterModelOutputText({
    output_text: envelope
  }), envelope);
  assert.equal(api.normalizeCharacterModelOutputText({
    output: [{
      content: [{ type: "output_text", text: envelope }]
    }]
  }), envelope);
});

test("role chat surfaces API error bodies instead of hiding them as empty content", async () => {
  const { api } = loadCharacterChatApp({
    fetchJson: {
      error: {
        message: "model not found",
        type: "invalid_request_error"
      }
    }
  });
  api.__element("characterChatInput").value = "\u804a\u804a\u5929";

  const originalError = console.error;
  console.error = () => {};
  try{
    await api.sendCharacterChat();
  }finally{
    console.error = originalError;
  }
  const history = api.getCharacterChatHistory();

  assert.match(history.at(-1).content, /model not found/);
});

test("role chat hides protocol reasoning text when JSON parsing fails", async () => {
  const rawReasoning = [
    "根据上下文，用户之前说了“今天做了30个俯卧撑”，现在用户说“将该记录改到40个俯卧撑”。",
    "activeTrainingReference为null，但recent history中提到了俯卧撑。",
    "根据指令：如果当前文本说改成，emit candidateType=correction with operation=modify_record_fields and needsConfirmation=true。"
  ].join("\n\n");
  const { api } = loadCharacterChatApp({ modelText: rawReasoning });
  api.__element("characterChatInput").value = "将该记录改到40个俯卧撑";

  await api.sendCharacterChat();

  const reply = api.getCharacterChatHistory().at(-1).content;
  assert.doesNotMatch(reply, /根据上下文|activeTrainingReference|candidateType|operation=modify_record_fields|emit/);
  assert.match(reply, /格式有点乱|需要确认|记录/);
  const debug = api.getRecordProtocolLastDebug();
  assert.match(debug.reply, /根据上下文/);
});

test("role chat fallback records Saturday plank seconds instead of modifying stale latest record", async () => {
  const { api } = loadCharacterChatApp({
    modelText: "好的",
    localStorageValues: {
      "gain-daily-logs": JSON.stringify({
        "2026-05-12": {
          date: "2026-05-12",
          aiCaptureRecords: [{
            id: "old-pushup-record",
            date: "2026-05-12",
            capturedAt: "2026-05-17T04:00:00.000Z",
            recordType: "training_fact",
            currentValue: { exercise: "俯卧撑", reps: 10, text: "俯卧撑 10 个" },
            originalText: "俯卧撑 10 个",
            revoked: false
          }]
        },
        "2026-05-16": {
          date: "2026-05-16",
          aiCaptureRecords: []
        }
      })
    }
  });
  api.__element("characterChatInput").value = "这周六的平板支撑，每组的时间是60秒";

  await api.sendCharacterChat();

  const logs = JSON.parse(api.__localStorage.getItem("gain-daily-logs"));
  assert.equal(logs["2026-05-12"].aiCaptureRecords[0].currentValue.reps, 10);
  const saturdayRecord = logs["2026-05-16"].aiCaptureRecords.at(-1);
  assert.equal(saturdayRecord.currentValue.exercise, "平板支撑");
  assert.equal(saturdayRecord.currentValue.duration, 60);
  assert.equal(saturdayRecord.currentValue.durationUnit, "秒");
  assert.equal(saturdayRecord.currentValue.reps, undefined);
  assert.equal(api.getRecordProtocolLastDebug().deterministicCaptureResult.status, "recorded");
});

test("applyRecordProtocol keeps high-risk v2 candidates pending", () => {
  const api = loadApp();

  const result = applySingleCandidate(api, {
    candidateId: "candidate-v2-high-risk",
    candidateType: "plan_progress",
    confidence: 0.96,
    evidenceText: "\u4eca\u5929\u6df1\u8e72\u505a\u4e86 3 \u7ec4",
    targetDateText: "today",
    dateSource: "explicit",
    exerciseRef: { type: "mentioned", displayName: "\u6df1\u8e72" },
    amount: 3,
    unit: "set",
    writeIntent: "auto",
    evidenceSource: "current_user_message",
    riskLevel: "high",
    scope: "single_record"
  });

  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "high_risk_candidate");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
  assert.equal(result.nextState.captureAttempts.length, 1);
});

test("applyRecordProtocol keeps non-current-message v2 evidence pending", () => {
  const api = loadApp();

  const result = applySingleCandidate(api, {
    candidateId: "candidate-v2-history-evidence",
    candidateType: "plan_progress",
    confidence: 0.96,
    evidenceText: "\u5386\u53f2\u91cc\u63d0\u5230\u6df1\u8e72 3 \u7ec4",
    targetDateText: "today",
    dateSource: "explicit",
    exerciseRef: { type: "mentioned", displayName: "\u6df1\u8e72" },
    amount: 3,
    unit: "set",
    writeIntent: "auto",
    evidenceSource: "recent_history",
    riskLevel: "low",
    scope: "single_record"
  });

  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "non_current_user_evidence");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
  assert.equal(result.nextState.captureAttempts.length, 1);
});

test("applyRecordProtocol keeps non-single-record v2 scope pending", () => {
  const api = loadApp();

  const result = applySingleCandidate(api, {
    candidateId: "candidate-v2-bulk-scope",
    candidateType: "plan_progress",
    confidence: 0.96,
    evidenceText: "\u4eca\u5929\u8bad\u7ec3\u90fd\u505a\u5b8c\u4e86",
    targetDateText: "today",
    dateSource: "explicit",
    exerciseRef: { type: "mentioned", displayName: "\u5168\u90e8\u8bad\u7ec3" },
    amount: 1,
    unit: "day",
    writeIntent: "auto",
    evidenceSource: "current_user_message",
    riskLevel: "low",
    scope: "bulk_day"
  });

  assert.equal(result.decisions[0].decision, "pending");
  assert.equal(result.decisions[0].reason, "non_single_record_scope");
  assert.equal(Object.keys(result.nextState.dailyLogs).length, 0);
  assert.equal(result.nextState.captureAttempts.length, 1);
});

test("applyRecordProtocol preserves per-set reps and seconds on written records", () => {
  const api = loadApp();

  const result = applySingleCandidate(api, {
    candidateId: "candidate-v2-dose-detail",
    candidateType: "plan_progress",
    confidence: 0.96,
    evidenceText: "\u4eca\u5929\u5e73\u677f\u652f\u6491 3 \u7ec4\uff0c\u6bcf\u7ec4 60 \u79d2",
    targetDateText: "today",
    dateSource: "explicit",
    exerciseRef: { type: "mentioned", displayName: "\u5e73\u677f\u652f\u6491" },
    amount: 3,
    unit: "set",
    sets: 3,
    duration: 60,
    durationUnit: "second",
    repsPerSet: 12,
    writeIntent: "auto",
    evidenceSource: "current_user_message",
    riskLevel: "low",
    scope: "single_record"
  });

  const record = result.nextState.dailyLogs["2026-05-17"].records[0];
  assert.equal(record.sets, 3);
  assert.equal(record.duration, 60);
  assert.equal(record.durationUnit, "second");
  assert.equal(record.repsPerSet, 12);
});

test("JSON-mode candidate aliases flow through adapter and applyRecordProtocol", () => {
  const api = loadApp();
  const parsed = api.parseCharacterRecordEnvelope(JSON.stringify({
    reply: "",
    record_candidates: [{
      candidateType: "extra_training",
      date: "2026-05-17",
      time: "07:00",
      durationSeconds: 90,
      movement: "\u5e73\u677f\u652f\u6491",
      sets: 2,
      reps: 1,
      evidenceText: "\u4eca\u5929\u5e73\u677f\u652f\u6491\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec445\u79d2\uff0c\u65e9\u4e0a7\u70b9",
      evidenceSource: "current_user_message",
      riskLevel: "low",
      scope: "single_record"
    }]
  }));
  const protocolOutput = api.adaptAiRecordEnvelope({
    envelope: {
      reply: parsed.reply,
      record_candidates: parsed.record_candidates
    },
    source: {
      kind: "live_scenario",
      messageId: "json-mode-alias-test",
      capturedAtIso: "2026-05-17T07:00:00+08:00",
      rawTextHash: "json-mode-alias-hash",
      rawTextPreview: "\u4eca\u5929\u5e73\u677f\u652f\u6491\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec445\u79d2\uff0c\u65e9\u4e0a7\u70b9"
    }
  });

  const result = api.applyRecordProtocol({
    protocolOutput,
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "Asia/Shanghai",
      visibleWeekDates: WEEK_DATES
    },
    currentState: {
      dailyLogs: {},
      captureAttempts: [],
      visibleWeekDates: WEEK_DATES
    }
  });

  const record = result.nextState.dailyLogs["2026-05-17"]?.records?.[0];
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(record.exerciseName, "\u5e73\u677f\u652f\u6491");
  assert.equal(record.amount, 2);
  assert.equal(record.unit, "set");
  assert.equal(record.sets, 2);
  assert.equal(record.duration, 90);
  assert.equal(record.durationUnit, "second");
  assert.ok(record.aiCapture.confidence >= 0.85);
});

test("JSON-mode sparse candidates derive record fields from evidenceText", () => {
  const api = loadApp();
  const parsed = api.parseCharacterRecordEnvelope(JSON.stringify({
    reply: "",
    record_candidates: [{
      candidateType: "extra_training",
      evidenceText: "\u4eca\u5929\u5e73\u677f\u652f\u6491\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec445\u79d2\uff0c\u65e9\u4e0a7\u70b9",
      evidenceSource: "current_user_message",
      riskLevel: "low",
      scope: "single_record"
    }]
  }));
  const protocolOutput = api.adaptAiRecordEnvelope({
    envelope: {
      reply: parsed.reply,
      record_candidates: parsed.record_candidates
    },
    source: {
      kind: "live_scenario",
      messageId: "json-mode-sparse-test",
      capturedAtIso: "2026-05-17T07:00:00+08:00",
      rawTextHash: "json-mode-sparse-hash",
      rawTextPreview: "\u4eca\u5929\u5e73\u677f\u652f\u6491\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec445\u79d2\uff0c\u65e9\u4e0a7\u70b9"
    }
  });

  const result = api.applyRecordProtocol({
    protocolOutput,
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "Asia/Shanghai",
      visibleWeekDates: WEEK_DATES
    },
    currentState: {
      dailyLogs: {},
      captureAttempts: [],
      visibleWeekDates: WEEK_DATES
    }
  });

  const record = result.nextState.dailyLogs["2026-05-17"]?.records?.[0];
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(record.exerciseName, "\u5e73\u677f\u652f\u6491");
  assert.equal(record.amount, 2);
  assert.equal(record.unit, "set");
  assert.equal(record.sets, 2);
  assert.equal(record.duration, 45);
  assert.equal(record.durationUnit, "second");
});

test("JSON-mode nested guard and record fields are normalized before applyRecordProtocol", () => {
  const api = loadApp();
  const parsed = api.parseCharacterRecordEnvelope(JSON.stringify({
    reply: "",
    record_candidates: [
      {
        candidateType: "extra_training",
        evidenceText: "\u4eca\u5929\u5e73\u677f\u652f\u6491\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec445\u79d2\uff0c\u65e9\u4e0a7\u70b9",
        date: "2026-05-17",
        time: "07:00",
        description: "\u5e73\u677f\u652f\u6491\u52a0\u7ec3",
        sets: 2,
        duration: "45\u79d2",
        v2: {
          evidenceSource: "current_user_message",
          riskLevel: "low",
          scope: "single_record"
        }
      },
      {
        candidateType: "extra_training",
        evidenceText: "\u6628\u5929\u6df1\u8e72\u52a0\u7ec34\u7ec4\uff0c\u6bcf\u7ec412\u6b21\uff0c\u4e2d\u534812\u70b9\u534a",
        record: {
          exerciseName: "\u6df1\u8e72",
          date: "2026-05-16",
          time: "12:30",
          sets: 4,
          reps: 12
        },
        guard: {
          evidenceSource: "current_user_message",
          riskLevel: "low",
          scope: "single_record"
        }
      },
      {
        candidateType: "extra_training",
        evidenceText: "\u5468\u4e00\u5355\u81c2\u54d1\u94c3\u5212\u8239\u52a0\u7ec33\u7ec4\uff0c\u6bcf\u7ec410\u6b21\uff0c\u665a\u4e0a8\u70b9",
        record_date: "2026-05-11",
        exerciseTemplateDraft: {
          exerciseName: "\u5355\u81c2\u54d1\u94c3\u5212\u8239",
          sets: 3,
          reps: 10
        },
        guard: {
          evidenceSource: "current_user_message",
          riskLevel: "low",
          scope: "single_record"
        }
      }
    ]
  }));
  const protocolOutput = api.adaptAiRecordEnvelope({
    envelope: {
      reply: parsed.reply,
      record_candidates: parsed.record_candidates
    },
    source: {
      kind: "live_scenario",
      messageId: "json-mode-nested-test",
      capturedAtIso: "2026-05-17T07:00:00+08:00",
      rawTextHash: "json-mode-nested-hash",
      rawTextPreview: "\u5d4c\u5957\u5b57\u6bb5\u6d4b\u8bd5"
    }
  });

  const result = api.applyRecordProtocol({
    protocolOutput,
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "Asia/Shanghai",
      visibleWeekDates: WEEK_DATES
    },
    currentState: {
      dailyLogs: {},
      captureAttempts: [],
      visibleWeekDates: WEEK_DATES
    }
  });

  assert.equal(result.decisions.map((decision) => decision.decision).join(","), "written,written,written");
  const plank = result.nextState.dailyLogs["2026-05-17"].records[0];
  const squat = result.nextState.dailyLogs["2026-05-16"].records[0];
  const row = result.nextState.dailyLogs["2026-05-11"].records[0];
  assert.equal(plank.exerciseName, "\u5e73\u677f\u652f\u6491");
  assert.equal(plank.duration, 45);
  assert.equal(plank.durationUnit, "second");
  assert.match(squat.exerciseName, /\u6df1\u8e72/);
  assert.equal(squat.repsPerSet, 12);
  assert.equal(row.exerciseName, "\u5355\u81c2\u54d1\u94c3\u5212\u8239");
  assert.equal(row.repsPerSet, 10);
});

test("JSON-mode live API field variants write through adapter and applyRecordProtocol", () => {
  const api = loadApp();
  const parsed = api.parseCharacterRecordEnvelope(JSON.stringify({
    reply: "",
    record_candidates: [
      {
        candidateType: "extra_training",
        evidenceText: "\u4eca\u5929\u5e73\u677f\u652f\u6491\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec445\u79d2\uff0c\u65e9\u4e0a7\u70b9",
        date: "2026-05-17",
        startTime: "07:00",
        exerciseTemplate: {
          exerciseType: "\u5e73\u677f\u652f\u6491",
          sets: 2,
          duration: "PT45S"
        },
        v2Guard: {
          evidenceSource: "current_user_message",
          riskLevel: "low",
          scope: "single_record"
        }
      },
      {
        candidateType: "extra_training",
        evidenceText: "\u5468\u4e00\u5355\u81c2\u54d1\u94c3\u5212\u8239\u52a0\u7ec33\u7ec4\uff0c\u6bcf\u7ec410\u6b21\uff0c\u665a\u4e0a8\u70b9",
        targetDate: { iso: "2026-05-11", text: "\u5468\u4e00" },
        trainingData: {
          exerciseName: "\u5355\u81c2\u54d1\u94c3\u5212\u8239",
          sets: 3,
          reps: 10
        },
        guardFields: {
          evidenceSource: "current_user_message",
          riskLevel: "low",
          scope: "single_record"
        }
      },
      {
        candidateType: "extra_training",
        evidenceText: "\u5468\u4e8c\u62c9\u4f38\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec48\u5206\u949f\uff0c\u7761\u524d",
        v2Guard: {
          evidenceSource: "current_user_message",
          riskLevel: "low",
          scope: "single_record"
        },
        recordFields: {
          dateIso: "2026-05-12",
          exerciseName: "\u62c9\u4f38",
          sets: 2,
          durationMinutes: 16,
          timeOfDay: "\u7761\u524d"
        }
      }
    ]
  }));
  const protocolOutput = api.adaptAiRecordEnvelope({
    envelope: {
      reply: parsed.reply,
      record_candidates: parsed.record_candidates
    },
    source: {
      kind: "live_scenario",
      messageId: "json-mode-live-variants-test",
      capturedAtIso: "2026-05-17T07:00:00+08:00",
      rawTextHash: "json-mode-live-variants-hash",
      rawTextPreview: "\u5b9e\u65f6 API \u5b57\u6bb5\u53d8\u4f53\u6d4b\u8bd5"
    }
  });

  const result = api.applyRecordProtocol({
    protocolOutput,
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "Asia/Shanghai",
      visibleWeekDates: WEEK_DATES
    },
    currentState: {
      dailyLogs: {},
      captureAttempts: [],
      visibleWeekDates: WEEK_DATES
    }
  });

  assert.equal(result.decisions.map((decision) => decision.decision).join(","), "written,written,written");
  const plank = result.nextState.dailyLogs["2026-05-17"].records[0];
  const row = result.nextState.dailyLogs["2026-05-11"].records[0];
  const stretch = result.nextState.dailyLogs["2026-05-12"].records[0];
  assert.equal(plank.exerciseName, "\u5e73\u677f\u652f\u6491");
  assert.equal(plank.duration, 45);
  assert.equal(plank.durationUnit, "second");
  assert.equal(row.exerciseName, "\u5355\u81c2\u54d1\u94c3\u5212\u8239");
  assert.equal(row.repsPerSet, 10);
  assert.equal(stretch.exerciseName, "\u62c9\u4f38");
  assert.equal(stretch.duration, 8);
  assert.equal(stretch.durationUnit, "minute");
});

test("JSON-mode complete nested fields without guard infer confidence and write", () => {
  const api = loadApp();
  const parsed = api.parseCharacterRecordEnvelope(JSON.stringify({
    reply: "",
    record_candidates: [{
      candidateType: "extra_training",
      evidenceText: "\u4eca\u5929\u5e73\u677f\u652f\u6491\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec445\u79d2\uff0c\u65e9\u4e0a7\u70b9",
      fields: {
        exercise: "\u5e73\u677f\u652f\u6491",
        sets: 2,
        durationPerSet: 45,
        durationUnit: "\u79d2",
        time: "07:00",
        date: "2026-05-17"
      }
    }]
  }));
  const protocolOutput = api.adaptAiRecordEnvelope({
    envelope: {
      reply: parsed.reply,
      record_candidates: parsed.record_candidates
    },
    source: {
      kind: "live_scenario",
      messageId: "live-session-1-add",
      capturedAtIso: "2026-05-17T04:58:54.740Z",
      rawTextHash: "json-mode-fields-no-guard-hash",
      rawTextPreview: "\u4eca\u5929\u5e73\u677f\u652f\u6491\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec445\u79d2\uff0c\u65e9\u4e0a7\u70b9"
    }
  });

  const result = api.applyRecordProtocol({
    protocolOutput,
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "Asia/Shanghai",
      visibleWeekDates: WEEK_DATES
    },
    currentState: {
      dailyLogs: {},
      captureAttempts: [],
      visibleWeekDates: WEEK_DATES
    }
  });

  const record = result.nextState.dailyLogs["2026-05-17"]?.records?.[0];
  assert.equal(protocolOutput.candidates[0].confidence, 0.9);
  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].reason, "eligible_for_write");
  assert.equal(record.exerciseName, "\u5e73\u677f\u652f\u6491");
  assert.equal(record.amount, 2);
  assert.equal(record.unit, "set");
  assert.equal(record.sets, 2);
  assert.equal(record.duration, 45);
  assert.equal(record.durationUnit, "second");
  assert.ok(record.aiCapture.confidence >= 0.85);
});

test("record protocol samples merged action-library exercises across sets, reps, and seconds", () => {
  const api = loadApp();
  const action = api.readExerciseLibraryAction("\u54d1\u94c3\u63d0\u8e35");
  assert.ok(action, "test fixture should exist in the merged exercise library");
  assert.ok(api.getExerciseLibrary().some((entry) => entry.exerciseKey === action.exerciseKey));

  const compact = makeCompactRequest(api, {
    userText: `\u4eca\u5929${action.displayName}\u505a\u4e861\u7ec4`
  });
  assert.equal(compact.mode, "compact_record_extraction");

  const repsProtocolOutput = api.adaptAiRecordEnvelope({
    envelope: {
      reply: "",
      record_candidates: [{
        candidateType: "extra_training",
        evidenceText: `\u4eca\u5929${action.displayName}\u505a\u4e8630\u4e2a`,
        evidenceSource: "current_user_message",
        riskLevel: "low",
        scope: "single_record"
      }]
    },
    source: {
      kind: "live_scenario",
      messageId: "library-reps-coverage",
      capturedAtIso: "2026-05-17T10:00:00+08:00",
      rawTextHash: "library-reps-hash",
      rawTextPreview: `\u4eca\u5929${action.displayName}\u505a\u4e8630\u4e2a`
    }
  });
  const repsResult = api.applyRecordProtocol({
    protocolOutput: repsProtocolOutput,
    context: { todayIso: "2026-05-17", visibleWeekDates: WEEK_DATES },
    currentState: { dailyLogs: {}, captureAttempts: [], visibleWeekDates: WEEK_DATES }
  });
  const repsRecord = repsResult.nextState.dailyLogs["2026-05-17"].records[0];
  assert.equal(repsResult.decisions[0].decision, "written");
  assert.equal(repsRecord.exerciseName, action.displayName);
  assert.equal(repsRecord.exerciseKey, action.exerciseKey);
  assert.equal(repsRecord.amount, 30);
  assert.equal(repsRecord.unit, "rep");

  const secondsProtocolOutput = api.adaptAiRecordEnvelope({
    envelope: {
      reply: "",
      record_candidates: [{
        candidateType: "extra_training",
        evidenceText: `\u4eca\u5929${action.displayName}\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec460\u79d2`,
        evidenceSource: "current_user_message",
        riskLevel: "low",
        scope: "single_record"
      }]
    },
    source: {
      kind: "live_scenario",
      messageId: "library-seconds-coverage",
      capturedAtIso: "2026-05-17T10:02:00+08:00",
      rawTextHash: "library-seconds-hash",
      rawTextPreview: `\u4eca\u5929${action.displayName}\u52a0\u7ec32\u7ec4\uff0c\u6bcf\u7ec460\u79d2`
    }
  });
  const secondsResult = api.applyRecordProtocol({
    protocolOutput: secondsProtocolOutput,
    context: { todayIso: "2026-05-17", visibleWeekDates: WEEK_DATES },
    currentState: { dailyLogs: {}, captureAttempts: [], visibleWeekDates: WEEK_DATES }
  });
  const secondsRecord = secondsResult.nextState.dailyLogs["2026-05-17"].records[0];
  assert.equal(secondsResult.decisions[0].decision, "written");
  assert.equal(secondsRecord.exerciseName, action.displayName);
  assert.equal(secondsRecord.exerciseKey, action.exerciseKey);
  assert.equal(secondsRecord.sets, 2);
  assert.equal(secondsRecord.duration, 60);
  assert.equal(secondsRecord.durationUnit, "second");
  assert.equal(secondsRecord.reps, undefined);
  assert.equal(secondsRecord.repsPerSet, undefined);
});

test("applyRecordProtocol resolves Chinese relative dates from todayIso", () => {
  const api = loadApp();

  const result = api.applyRecordProtocol({
    protocolOutput: {
      protocolVersion: "record-protocol/v2",
      source: {
        kind: "chat",
        messageId: "v2-relative-date-message",
        capturedAtIso: "2026-05-17T10:00:00+08:00",
        rawTextHash: "v2-relative-date-hash",
        rawTextPreview: "\u6628\u5929\u5e73\u677f\u652f\u6491 3 \u7ec4"
      },
      reply: "ok",
      record_candidates: [{
        candidateId: "candidate-v2-yesterday",
        candidateType: "plan_progress",
        confidence: 0.96,
        evidenceText: "\u6628\u5929\u5e73\u677f\u652f\u6491 3 \u7ec4",
        targetDateText: "\u6628\u5929",
        dateSource: "explicit",
        exerciseRef: { type: "mentioned", displayName: "\u5e73\u677f\u652f\u6491" },
        amount: 3,
        unit: "set",
        writeIntent: "auto",
        evidenceSource: "current_user_message",
        riskLevel: "low",
        scope: "single_record"
      }]
    },
    context: {
      todayIso: "2026-05-17",
      userTimeZone: "Asia/Shanghai",
      visibleWeekDates: WEEK_DATES
    },
    currentState: {
      dailyLogs: {},
      captureAttempts: [],
      visibleWeekDates: WEEK_DATES
    }
  });

  assert.equal(result.decisions[0].decision, "written");
  assert.equal(result.decisions[0].targetDateIso, "2026-05-16");
  assert.equal(result.nextState.dailyLogs["2026-05-16"].records.length, 1);
});

test("role chat ordinary messages do not attach record protocol or training context", async () => {
  const { api, fetchBodies } = loadCharacterChatApp({
    modelText: "\u6211\u5728\uff0c\u4f60\u8bf4\u3002"
  });
  api.__element("characterChatInput").value = "\u4eca\u5929\u5fc3\u60c5\u8fd8\u4e0d\u9519\uff0c\u60f3\u804a\u4f1a\u513f";

  await api.sendCharacterChat();

  assert.equal(fetchBodies.length, 1);
  const body = fetchBodies[0];
  const systemPrompt = body.messages[0].content;
  assert.doesNotMatch(systemPrompt, /record_candidates/);
  assert.doesNotMatch(systemPrompt, /compact training context JSON/);
  assert.doesNotMatch(systemPrompt, /activeTrainingReference/);
  assert.equal(body.messages.at(-1).role, "user");
  assert.equal(body.temperature, 0.7);
  assert.equal(body.response_format, undefined);
});

test("role chat self-contained record messages use compact protocol without chat history", async () => {
  const envelope = {
    reply: "\u8bb0\u4e0b\u4e86\uff1a\u4eca\u5929\u6df1\u8e72 3 \u7ec4\u3002",
    record_candidates: []
  };
  const { api, fetchBodies } = loadCharacterChatApp({
    fetchJson: { choices: [{ message: { content: JSON.stringify(envelope) } }] },
    localStorageValues: {
      "gain-character-chat-history": JSON.stringify(Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 ? "assistant" : "user",
        content: `old role chat turn ${index + 1}`
      })))
    }
  });
  api.__element("characterChatInput").value = "\u4eca\u5929\u6df1\u8e72\u505a\u4e86 3 \u7ec4";

  await api.sendCharacterChat();

  assert.equal(fetchBodies.length, 1);
  const body = fetchBodies[0];
  const serializedMessages = JSON.stringify(body.messages);
  assert.match(body.messages[0].content, /record-protocol\/v2 compact extraction/);
  assert.match(body.messages[0].content, /compact training context JSON/);
  assert.doesNotMatch(serializedMessages, /old role chat turn/);
  assert.equal(body.temperature, 0);
  assert.equal(body.max_tokens, 300);
  assert.deepEqual(body.response_format, { type: "json_object" });
});

test("role chat debug stores a bounded raw model output preview", async () => {
  const envelope = {
    reply: "x".repeat(2000),
    record_candidates: []
  };
  const { api } = loadCharacterChatApp({
    fetchJson: { choices: [{ message: { content: JSON.stringify(envelope) } }] }
  });
  api.__element("characterChatInput").value = "\u4eca\u5929\u6df1\u8e72\u505a\u4e86 3 \u7ec4";

  await api.sendCharacterChat();

  const debug = api.getRecordProtocolLastDebug();
  assert.equal(debug.rawModelOutputTruncated, true);
  assert.ok(debug.rawModelOutputOriginalLength > debug.rawModelOutput.length);
  assert.ok(debug.rawModelOutput.length <= 1200);
  assert.match(debug.rawModelOutput, /\[truncated\]$/);
});

test("role chat records a clear training fact when the AI returns empty content", async () => {
  const { api } = loadCharacterChatApp({
    fetchJson: { choices: [{ message: { content: "" } }] }
  });
  api.__element("characterChatInput").value = "\u5e73\u677f\u652f\u6491\u52a0\u7ec3\u4e09\u7ec4\uff0c\u4e00\u7ec460s";

  await api.sendCharacterChat();

  const latest = api.getCharacterChatHistory().at(-1);
  assert.equal(latest.role, "assistant");
  assert.match(latest.content, /\u672c\u5730\u89c4\u5219\u5148\u8bb0\u5f55/);
  assert.doesNotMatch(latest.content, /^\u53d1\u9001\u5931\u8d25/);
});

test("role chat asks for confirmation on date correction when the AI returns empty content", async () => {
  const { api } = loadCharacterChatApp({
    fetchJson: { choices: [{ message: { content: "" } }] }
  });
  api.__element("characterChatInput").value = "\u4eca\u5929\u8bb0\u5f55\u7684\u5e73\u677f\u652f\u6491\u6539\u5230\u6628\u5929";

  await api.sendCharacterChat();

  const latest = api.getCharacterChatHistory().at(-1);
  assert.equal(latest.role, "assistant");
  assert.match(latest.content, /\u9700\u8981\u786e\u8ba4/);
  assert.match(latest.content, /\u6628\u5929/);
  assert.doesNotMatch(latest.content, /^\u53d1\u9001\u5931\u8d25/);
});

test("role chat protocol fallback records context add when model returns analysis text", async () => {
  const { api } = loadCharacterChatApp({
    fetchJson: {
      choices: [{
        message: {
          content: "\u6211\u4eec\u88ab\u95ee\u5230\uff1a\"\u521a\u624d\u90a3\u4e2a\u53c8\u8865\u4e86\u4e00\u7ec4\uff0c\u6bcf\u7ec412\u6b21\"\u3002\u9700\u8981\u89e3\u6790\u7528\u6237\u610f\u56fe\uff0c\u4f46\u6211\u6ca1\u6709\u8fd4\u56de JSON\u3002"
        }
      }]
    },
    localStorageValues: {
      "gain-active-training-reference": JSON.stringify({
        exerciseName: "\u5355\u81c2\u54d1\u94c3\u5212\u8239",
        subjectText: "\u5355\u81c2\u54d1\u94c3\u5212\u8239",
        targetDateText: "today",
        lastUpdatedAt: new Date().toISOString()
      })
    }
  });
  api.__element("characterChatInput").value = "\u521a\u624d\u90a3\u4e2a\u53c8\u8865\u4e86\u4e00\u7ec4\uff0c\u6bcf\u7ec412\u6b21";

  await api.sendCharacterChat();

  const debug = api.getRecordProtocolLastDebug();
  assert.equal(debug.protocolOutput.candidates.length, 1);
  assert.equal(debug.protocolOutput.candidates[0].exerciseRef.displayName, "\u5355\u81c2\u54d1\u94c3\u5212\u8239");
  assert.equal(debug.engineDecisions[0].decision, "written");
});

test("role chat protocol fallback recognizes the same merged exercise-library alias as compact gate", async () => {
  const { api } = loadCharacterChatApp({
    fetchJson: { choices: [{ message: { content: "" } }] },
    localStorageValues: {
      "gain-exercise-library-custom": JSON.stringify([CUSTOM_BEAR_PRESS_ACTION])
    }
  });
  api.__element("characterChatInput").value = "\u4eca\u5929\u718a\u5f0f\u80a9\u63a8\u505a\u4e8630\u4e2a";

  await api.sendCharacterChat();

  const debug = api.getRecordProtocolLastDebug();
  assert.equal(debug.protocolOutput.candidates.length, 1);
  assert.equal(debug.protocolOutput.candidates[0].exerciseRef.displayName, "\u718a\u722c\u80a9\u63a8");
  assert.equal(debug.protocolOutput.candidates[0].exerciseRef.exerciseKey, "custom-bear-shoulder-press");
  assert.equal(debug.engineDecisions[0].decision, "written");
  const logs = JSON.parse(api.__localStorage.getItem("gain-daily-logs"));
  const record = logs["2026-05-17"].records[0];
  assert.equal(record.exerciseName, "\u718a\u722c\u80a9\u63a8");
  assert.equal(record.exerciseKey, "custom-bear-shoulder-press");
  assert.equal(record.amount, 30);
  assert.equal(record.unit, "rep");
});

test("role chat protocol fallback keeps explicit delete as pending correction when model returns empty candidates", async () => {
  const { api } = loadCharacterChatApp({
    fetchJson: {
      choices: [{
        message: {
          content: JSON.stringify({ reply: "", record_candidates: [] })
        }
      }]
    },
    localStorageValues: {
      "gain-active-training-reference": JSON.stringify({
        exerciseName: "\u80f8\u80cc\u62c9\u4f38",
        subjectText: "\u80f8\u80cc\u62c9\u4f38",
        targetDateText: "today",
        lastUpdatedAt: new Date().toISOString()
      })
    }
  });
  api.__element("characterChatInput").value = "\u5220\u9664\u521a\u624d\u90a3\u6761\u80f8\u80cc\u62c9\u4f38\u8bb0\u5f55\uff0c\u4e0d\u8981\u8bb0\u4e86";

  await api.sendCharacterChat();

  const debug = api.getRecordProtocolLastDebug();
  assert.equal(debug.protocolOutput.candidates.length, 1);
  assert.equal(debug.protocolOutput.candidates[0].candidateType, "correction");
  assert.equal(debug.protocolOutput.candidates[0].correction.operation, "delete_record");
  assert.equal(debug.engineDecisions[0].decision, "pending");
});
