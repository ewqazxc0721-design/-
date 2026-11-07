const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const INDEX_HTML = path.join(ROOT, "index.html");

function createElement(id, value = "") {
  return {
    id,
    value,
    textContent: "",
    innerHTML: "",
    style: {},
    dataset: {},
    className: "",
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
    closest() { return null; },
    focus() {},
    setAttribute() {},
    getAttribute() { return ""; }
  };
}

function createLocalStorage(initial = {}, options = {}) {
  const store = { ...initial };
  const throwOnSetKeys = new Set(options.throwOnSetKeys || []);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      if(throwOnSetKeys.has(String(key))){
        const err = new Error(`simulated storage failure for ${key}`);
        err.name = "QuotaExceededError";
        throw err;
      }
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

function createFixedDateClass(now) {
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

function makeSevenDayPlan(items) {
  const names = ["\u5468\u4e00", "\u5468\u4e8c", "\u5468\u4e09", "\u5468\u56db", "\u5468\u4e94", "\u5468\u516d", "\u5468\u65e5"];
  return {
    version: 1,
    days: names.map((day) => ({
      day,
      focus: "\u8bad\u7ec3",
      items,
      protein: ""
    }))
  };
}

function loadApp({ formValues = {}, localStorageValues = {}, localStorageOptions = {}, now = new Date(2026, 4, 12, 12, 0, 0), viewportWidth = 1024 } = {}) {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const scriptStart = html.indexOf("const APP_VERSION");
  const initStart = html.indexOf('document.querySelectorAll(".tab").forEach((btn) => {\n      btn.addEventListener("click"', scriptStart);
  assert.notEqual(scriptStart, -1, "index.html should contain the main inline script");
  assert.notEqual(initStart, -1, "test harness should stop before DOM boot code");

  const elements = new Map();
  const body = createElement("body");
  body.clientWidth = viewportWidth;
  const document = {
    body,
    documentElement: { dataset: {}, style: {}, clientWidth: viewportWidth, classList: { add() {}, remove() {}, toggle() {} } },
    getElementById(id) {
      if(!elements.has(id)){
        elements.set(id, createElement(id, formValues[id] || ""));
      }
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) { return createElement(tag); }
  };
  const localStorage = createLocalStorage(localStorageValues, localStorageOptions);
  const TestDate = createFixedDateClass(now);
  const window = {
    document,
    localStorage,
    innerWidth: viewportWidth,
    navigator: { standalone: false },
    crypto: { randomUUID: () => "capture-test-id" },
    addEventListener() {},
    removeEventListener() {},
    AudioContext: undefined,
    webkitAudioContext: undefined,
    matchMedia(query) {
      return {
        matches: /max-width:\s*480px/.test(String(query)) ? viewportWidth <= 480 : false,
        addEventListener() {},
        removeEventListener() {}
      };
    },
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
  };

  const context = vm.createContext({
    console,
    document,
    window,
    navigator: window.navigator,
    crypto: window.crypto,
    localStorage,
    alert() {},
    confirm() { return true; },
    requestAnimationFrame(callback) { return callback(); },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    AbortController,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    Date: TestDate
  });

  vm.runInContext(html.slice(scriptStart, initStart), context, { filename: "index.html" });
  vm.runInContext(`
    globalThis.__testApi = {
      classifyCharacterTrainingIntent,
      extractLocalTrainingCaptureIntent,
      handleCharacterTrainingCapture,
      writeTrainingCaptureIntent,
      undoTrainingCaptureRecord,
      getDailyLogs,
      getPlanChecks,
      setPlanChecks,
      getAiSettings,
      getCharacterChatHistory,
      setCharacterChatHistory,
      buildCharacterTrainingContext,
      shouldAttachTrainingContextToCharacterChat,
      generateAiDailySummaryForLog,
      generateAiWeeklySummaryDraft,
      summarizeTrainingCaptureRecord,
      getLocalSnapshot,
      formatDateKey,
      getTrainingCaptureCards,
      clearTrainingCaptureCards,
      expireTrainingCaptureToasts,
      dismissTrainingCaptureToast,
      startTrainingSession,
      continueTrainingSession,
      finishTrainingSession,
      getTrainingSession,
      setTrainingSession,
      setDailyLogs,
      getDomainPersistenceWriteLog: () => domainPersistence.getWriteLog(),
      clearDomainPersistenceWriteLog: () => domainPersistence.clearWriteLog(),
      exportAppStateSnapshot: () => appState.exportSnapshot(),
      importAppStateSnapshot: (snapshot) => appState.importSnapshot(snapshot || {}, { source:"cloud sync test import" }),
      createCloudSyncForTest: (cloudAdapter, stamps = ["2026-05-19T10:05:00.000Z"], cloudOptions = {}) => {
        let tick = 0;
        return createCloudSync({
          appState,
          cloudAdapter,
          now: () => new Date(stamps[Math.min(tick++, stamps.length - 1)]),
          ...cloudOptions
        });
      },
      getLocalUpdatedAt,
      chooseAutoSyncDirection,
      hasLocalPlanCheckProgress,
      shouldPreferLocalAutoSyncUpload,
      getAutoSyncDirectionForCurrentState,
      inferSnapshotContentUpdatedAt,
      togglePlanCheckForTest: (key) => {
        togglePlanCheck(key);
        return getPlanChecks();
      },
      getArchitectureSeamStatus: () => ({
        planReconciliationWriter:
          typeof planReconciliationWriter.applyTrainingFact === "function" &&
          typeof planReconciliationWriter.reconcile === "function",
        characterChatCaptureOrchestrator:
          typeof characterChatCaptureOrchestrator.runSuccess === "function" &&
          typeof characterChatCaptureOrchestrator.runFailure === "function",
        domainPersistence:
          typeof domainPersistence.setJson === "function" &&
          typeof domainPersistence.getWriteLog === "function",
        testEntryPublicApi:true
      }),
      saveWeek,
      getHistory,
      entryToSummaryText
    };
  `, context);
  return { api: context.__testApi, localStorage };
}

test("character chat intent classifier keeps ordinary chat out of training capture", () => {
  const { api } = loadApp();

  assert.equal(api.classifyCharacterTrainingIntent("我想吃火锅").action, "none");
  assert.equal(api.classifyCharacterTrainingIntent("今天好累啊").action, "none");
  assert.equal(api.classifyCharacterTrainingIntent("比如我今天做了 15 个引体向上，你会怎么记？").action, "none");
  assert.equal(api.classifyCharacterTrainingIntent("今天做了 15 个引体向上").action, "capture");
  assert.equal(api.classifyCharacterTrainingIntent("今天练完腿特别酸").action, "capture");
  assert.equal(api.classifyCharacterTrainingIntent("胸闷头晕还要不要硬练").action, "safety");
  assert.equal(api.classifyCharacterTrainingIntent("我要开始今天训练了").action, "start_training_session");
  assert.equal(api.classifyCharacterTrainingIntent("我今天该练什么").action, "none");
  assert.equal(api.classifyCharacterTrainingIntent("怎么开始训练").action, "none");
  assert.equal(api.classifyCharacterTrainingIntent("结束训练并保存").action, "finish_training_session");
  assert.equal(api.classifyCharacterTrainingIntent("放弃训练").action, "discard_training_session");
  assert.equal(api.classifyCharacterTrainingIntent("怎么结束训练").action, "none");
});

test("clear training facts write AI capture records without overwriting user notes", () => {
  const { api } = loadApp({
    localStorageValues: {
      "gain-daily-logs": JSON.stringify({
        "2026-05-12": { date: "2026-05-12", note: "用户手写备注", completedItems: [], totalItems: 0 }
      }),
      "gain-character-cards": JSON.stringify([{ id: "role-1", name: "教练搭子" }]),
      "gain-active-character-card-id": "role-1"
    }
  });

  const result = api.handleCharacterTrainingCapture("今天做了 15 个引体向上", {
    now: new Date(2026, 4, 12, 12, 0, 0)
  });

  const log = api.getDailyLogs()["2026-05-12"];
  assert.equal(result.status, "recorded");
  assert.equal(log.note, "用户手写备注");
  assert.equal(log.aiCaptureRecords.length, 1);
  assert.equal(log.aiCaptureRecords[0].sourceType, "character_chat");
  assert.equal(log.aiCaptureRecords[0].capturedRoleName, "教练搭子");
  assert.equal(log.aiCaptureRecords[0].recordType, "training_fact");
  assert.equal(log.aiCaptureRecords[0].currentValue.exercise, "引体向上");
  assert.equal(log.aiCaptureRecords[0].currentValue.reps, 15);
  assert.match(log.aiDailySummary.text, /引体向上/);
});

test("duration phrasing with 是 does not modify the latest record into reps", () => {
  const { api } = loadApp({
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
      }),
      "gain-character-cards": JSON.stringify([{ id: "role-1", name: "教练搭子" }]),
      "gain-active-character-card-id": "role-1"
    },
    now: new Date(2026, 4, 17, 13, 31, 0)
  });

  const result = api.handleCharacterTrainingCapture("这周六的平板支撑，每组的时间是60秒", {
    now: new Date(2026, 4, 17, 13, 31, 0)
  });

  assert.equal(result.status, "recorded");
  const logs = api.getDailyLogs();
  const oldRecord = logs["2026-05-12"].aiCaptureRecords[0];
  assert.equal(oldRecord.currentValue.reps, 10);
  assert.equal(oldRecord.userModified, undefined);

  const saturdayRecord = logs["2026-05-16"].aiCaptureRecords.at(-1);
  assert.equal(saturdayRecord.currentValue.exercise, "平板支撑");
  assert.equal(saturdayRecord.currentValue.duration, 60);
  assert.equal(saturdayRecord.currentValue.durationUnit, "秒");
  assert.equal(saturdayRecord.currentValue.reps, undefined);
  assert.match(api.summarizeTrainingCaptureRecord(saturdayRecord), /60秒/);
  assert.doesNotMatch(api.summarizeTrainingCaptureRecord(saturdayRecord), /60次/);
});

test("safety feedback is recorded but does not auto-complete a matching plan item", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 16, 12, 0, 0) });

  const result = api.handleCharacterTrainingCapture("深蹲膝盖痛", {
    now: new Date(2026, 4, 16, 12, 0, 0)
  });

  const log = api.getDailyLogs()["2026-05-16"];
  const checks = api.getPlanChecks();
  assert.equal(result.status, "recorded");
  assert.equal(log.aiCaptureRecords[0].recordType, "safety_feedback");
  assert.equal(log.aiCaptureRecords[0].autoCompletedPlanChecks.length, 0);
  assert.equal(Object.values(checks).some(Boolean), false);
});

test("quantified completion can auto-complete a matching item, and undo only rolls back that automatic check", () => {
  const { api } = loadApp({
    now: new Date(2026, 4, 14, 12, 0, 0),
    localStorageValues: {
      "gain-plan-checks": JSON.stringify({ d3_i0: true })
    }
  });

  const result = api.handleCharacterTrainingCapture("我做完了4组侧平举，每组15次", {
    now: new Date(2026, 4, 14, 12, 0, 0)
  });
  let checks = api.getPlanChecks();
  assert.equal(checks.d3_i0, true, "existing manual check remains true");
  assert.equal(checks.d3_i4, true, "matching side raise item is auto-completed");

  api.undoTrainingCaptureRecord(result.recordId);
  checks = api.getPlanChecks();
  assert.equal(checks.d3_i0, true, "manual check is not removed by undo");
  assert.equal(checks.d3_i4, undefined, "auto-completed check is rolled back");
});

test("structured training capture keeps per-set duration mismatch pending before writing", () => {
  const fullStretch = "\u5168\u8eab\u62c9\u4f38";
  const today = "2026-05-17";
  const { api, localStorage } = loadApp({
    now: new Date(2026, 4, 17, 12, 0, 0),
    localStorageValues: {
      "gain-plan-template": JSON.stringify(makeSevenDayPlan([`${fullStretch} 2\u7ec4 \u6bcf\u7ec460\u79d2`]))
    }
  });
  const result = api.writeTrainingCaptureIntent({
    action: "write",
    date: today,
    recordType: "training_fact",
    completedExplicit: true,
    originalText: `\u4eca\u5929${fullStretch}\u505a\u4e862\u7ec4\uff0c\u6bcf\u7ec445\u79d2`,
    currentValue: {
      exercise: fullStretch,
      sets: 2,
      duration: 45,
      durationUnit: "second",
      text: `\u4eca\u5929${fullStretch}\u505a\u4e862\u7ec4\uff0c\u6bcf\u7ec445\u79d2`
    }
  });

  const log = api.getDailyLogs()[today];
  const stretch = log.planProgressItems.find((item) => item.snapshotItemText.includes(fullStretch));
  assert.equal(result.status, "pending_confirmation");
  assert.equal(stretch.completedAmount, 0);
  assert.equal(stretch.status, "active");
  assert.notEqual(api.getPlanChecks()[stretch.planCheckKey], true);
  assert.equal(log.extraTrainingEvents.length, 0);
  assert.equal((log.aiCaptureRecords || []).length, 0);
  const pending = JSON.parse(localStorage.getItem("gain-plan-reconciliation-pending"));
  assert.equal(pending.mode, "dose_revision");
  assert.equal(pending.reportedDose.duration, 45);
});

test("structured training capture asks before checking a matching plan item without quantity", () => {
  const fullStretch = "\u5168\u8eab\u62c9\u4f38";
  const today = "2026-05-17";
  const { api, localStorage } = loadApp({
    now: new Date(2026, 4, 17, 12, 0, 0),
    localStorageValues: {
      "gain-plan-template": JSON.stringify(makeSevenDayPlan([`${fullStretch} 2\u7ec4 \u6bcf\u7ec460\u79d2`]))
    }
  });

  const result = api.handleCharacterTrainingCapture(`\u6211\u5b8c\u6210\u4e86${fullStretch}`, {
    now: new Date(2026, 4, 17, 12, 0, 0)
  });

  const log = api.getDailyLogs()[today];
  const stretch = log.planProgressItems.find((item) => item.snapshotItemText.includes(fullStretch));
  assert.equal(result.status, "pending_confirmation");
  assert.equal(stretch.completedAmount, 0);
  assert.notEqual(api.getPlanChecks()[stretch.planCheckKey], true);
  assert.equal((log.aiCaptureRecords || []).length, 0);
  assert.equal((log.extraTrainingEvents || []).length, 0);
  const pending = JSON.parse(localStorage.getItem("gain-plan-reconciliation-pending"));
  assert.equal(pending.mode, "planned_dose_confirmation");
});

test("structured training capture splits surplus same-dose work into plan progress plus extra training", () => {
  const fullStretch = "\u5168\u8eab\u62c9\u4f38";
  const today = "2026-05-17";
  const { api } = loadApp({
    now: new Date(2026, 4, 17, 12, 0, 0),
    localStorageValues: {
      "gain-plan-template": JSON.stringify(makeSevenDayPlan([`${fullStretch} 2\u7ec4 \u6bcf\u7ec460\u79d2`]))
    }
  });

  const result = api.writeTrainingCaptureIntent({
    action: "write",
    date: today,
    recordType: "training_fact",
    completedExplicit: true,
    originalText: `\u4eca\u5929${fullStretch}\u5b8c\u6210\u4e863\u7ec4\uff0c\u6bcf\u7ec460\u79d2`,
    currentValue: {
      exercise: fullStretch,
      sets: 3,
      duration: 60,
      durationUnit: "second",
      text: `\u4eca\u5929${fullStretch}\u5b8c\u6210\u4e863\u7ec4\uff0c\u6bcf\u7ec460\u79d2`
    }
  });

  const log = api.getDailyLogs()[today];
  const stretch = log.planProgressItems.find((item) => item.snapshotItemText.includes(fullStretch));
  assert.equal(result.status, "recorded");
  assert.equal(stretch.completedAmount, 2);
  assert.equal(stretch.status, "completed");
  assert.equal(api.getPlanChecks()[stretch.planCheckKey], true);
  assert.equal(log.extraTrainingEvents.length, 1);
  assert.equal(log.extraTrainingEvents[0].amount, 1);
  assert.equal(log.extraTrainingEvents[0].duration, 60);
});

test("capture settings prevent writes and prevent hidden training context", () => {
  const disabledAuto = loadApp({
    localStorageValues: {
      "gain-ai-settings": JSON.stringify({ autoTrainingCapture: false })
    }
  }).api;
  assert.equal(disabledAuto.handleCharacterTrainingCapture("今天做了 15 个引体向上").status, "disabled");
  assert.equal(Object.keys(disabledAuto.getDailyLogs()).length, 0);

  const disabledIntent = loadApp({
    localStorageValues: {
      "gain-ai-settings": JSON.stringify({ trainingIntentTrigger: false })
    }
  }).api;
  assert.equal(disabledIntent.shouldAttachTrainingContextToCharacterChat("今天做了 15 个引体向上"), false);
  assert.equal(disabledIntent.handleCharacterTrainingCapture("今天做了 15 个引体向上").status, "disabled");
});

test("daily and weekly summaries are derived from daily facts and exported with the app snapshot", () => {
  const { api } = loadApp();

  api.handleCharacterTrainingCapture("今天做了 15 个引体向上", {
    now: new Date(2026, 4, 12, 12, 0, 0)
  });
  api.handleCharacterTrainingCapture("昨天跑了 10 分钟", {
    now: new Date(2026, 4, 12, 12, 0, 0)
  });

  const logs = api.getDailyLogs();
  assert.match(api.generateAiDailySummaryForLog(logs["2026-05-12"]).text, /引体向上/);
  assert.match(api.generateAiWeeklySummaryDraft(new Date(2026, 4, 12)).text, /2 天/);

  const snapshot = api.getLocalSnapshot();
  assert.ok(snapshot.dailyLogs["2026-05-12"].aiCaptureRecords.length);
  assert.ok(snapshot.aiWeeklySummaries["2026-05-11"]);
});

test("training session capture notifications are transient toasts without affecting the session", () => {
  const now = new Date(2026, 4, 12, 12, 0, 0);
  const api = loadApp({ now, viewportWidth: 390 }).api;
  const session = api.startTrainingSession(1);
  const card = api.getTrainingCaptureCards()[0];

  assert.equal(card.trainingSessionActions, true);
  assert.ok(card.expiresAt >= now.getTime() + 5000);
  assert.equal(card.expandedUntil, undefined);
  assert.equal(card.collapsed, undefined);

  api.expireTrainingCaptureToasts(now.getTime() + 5001);

  assert.equal(api.getTrainingCaptureCards().length, 0);
  assert.equal(api.getTrainingSession().id, session.id);
});

test("legacy capture notifications without expiry are upgraded and can be dismissed", () => {
  const now = new Date(2026, 4, 12, 12, 0, 0);
  const { api } = loadApp({
    now,
    viewportWidth: 390,
    localStorageValues: {
      "gain-training-capture-cards": JSON.stringify([
        { id: "legacy-toast", kind: "success", title: "训练会话已开始", message: "旧版通知" }
      ])
    }
  });

  let cards = api.getTrainingCaptureCards();
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, "legacy-toast");
  assert.equal(cards[0].expiresAt, now.getTime() + 5000);

  api.expireTrainingCaptureToasts(now.getTime() + 5001);
  assert.equal(api.getTrainingCaptureCards().length, 0);

  api.startTrainingSession(1);
  cards = api.getTrainingCaptureCards();
  assert.ok(cards.length);
  api.dismissTrainingCaptureToast(cards[0].id);
  assert.equal(api.getTrainingCaptureCards().some((card) => card.id === cards[0].id), false);
});

test("training sessions expose continue, finish-save, and discard exits", () => {
  const first = loadApp().api;
  const session = first.startTrainingSession(1);
  assert.equal(session.status, "active");
  assert.equal(first.getTrainingSession().dayIndex, 1);
  assert.ok(first.getTrainingCaptureCards().some((card) => card.trainingSessionActions));
  assert.equal(first.continueTrainingSession().status, "continued");

  const saved = first.finishTrainingSession({ save: true });
  assert.equal(saved.status, "finished");
  assert.equal(first.getTrainingSession(), null);
  assert.ok(first.getDailyLogs()[session.date].aiCaptureRecords.some((record) => record.sourceType === "training_session"));

  const second = loadApp().api;
  second.startTrainingSession(2);
  const discarded = second.finishTrainingSession({ save: false });
  assert.equal(discarded.status, "discarded");
  assert.equal(second.getTrainingSession(), null);
  assert.equal(Object.keys(second.getDailyLogs()).length, 0);
});

test("active training session chat records quantified completion against the selected plan day and auto-checks that page", () => {
  const { api, localStorage } = loadApp({ now: new Date(2026, 4, 12, 12, 0, 0) });
  const session = api.startTrainingSession(3);

  const result = api.handleCharacterTrainingCapture("我做完了4组侧平举，每组15次", {
    now: new Date(2026, 4, 12, 12, 0, 0)
  });

  const logs = api.getDailyLogs();
  const checks = api.getPlanChecks();
  assert.equal(result.status, "checked");
  assert.equal(result.date, session.date);
  assert.equal(checks.d3_i4, true, "the selected training page item should be checked");
  assert.equal(logs[session.date].completedItems.includes("侧平举 4组 × 15–20次"), true);
  assert.equal(logs[session.date].aiCaptureRecords.length, 0, "full planned-item completion should not create an AI capture record");

  const summaries = JSON.parse(localStorage.getItem("gain-ai-weekly-summaries") || "{}");
  assert.match(summaries["2026-05-11"].text, /侧平举/, "weekly summary draft should include completed calendar items even without AI capture records");
});

test("active training session records one completed set with planned reps from the matched item", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 12, 12, 0, 0) });
  const session = api.startTrainingSession(1);

  const result = api.handleCharacterTrainingCapture("我完成了一组单臂哑铃划船", {
    now: new Date(2026, 4, 12, 12, 0, 0)
  });

  const record = api.getDailyLogs()[session.date].aiCaptureRecords[0];
  assert.equal(result.status, "recorded");
  assert.equal(record.currentValue.exercise, "单臂哑铃划船");
  assert.equal(record.currentValue.sets, 1);
  assert.equal(record.currentValue.plannedRepsText, "每侧12–15次");
  assert.equal(api.getPlanChecks().d1_i2, undefined, "one set should not complete the full 4-set plan item");
  assert.match(api.summarizeTrainingCaptureRecord(record), /1组/);
  assert.match(api.summarizeTrainingCaptureRecord(record), /每侧12–15次/);
});

test("active training session records extra completed work instead of only checking the plan item", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 12, 12, 0, 0) });
  const session = api.startTrainingSession(3);

  const result = api.handleCharacterTrainingCapture("我额外多做了一组侧平举", {
    now: new Date(2026, 4, 12, 12, 0, 0)
  });

  const log = api.getDailyLogs()[session.date];
  assert.equal(result.status, "recorded");
  assert.equal(api.getPlanChecks().d3_i4, undefined, "extra work alone should not mark the whole planned item complete");
  assert.equal(log.aiCaptureRecords[0].currentValue.exercise, "侧平举");
  assert.equal(log.aiCaptureRecords[0].currentValue.sets, 1);
});

test("saving the weekly record carries the AI weekly summary draft into history", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 12, 12, 0, 0) });
  api.startTrainingSession(3);
  api.handleCharacterTrainingCapture("我做完了4组侧平举，每组15次", {
    now: new Date(2026, 4, 12, 12, 0, 0)
  });

  api.saveWeek();

  const entry = api.getHistory()[0];
  assert.match(entry.aiWeeklySummaryDraft.text, /侧平举/);
  assert.match(api.entryToSummaryText(entry), /AI 周总结草稿/);
});

test("high-risk persistence setters write once per domain and hydrate cleanly after reload", () => {
  const { api, localStorage } = loadApp();

  api.clearDomainPersistenceWriteLog();
  api.setDailyLogs({ "2026-05-12": { date: "2026-05-12", aiCaptureRecords: [] } });
  api.setPlanChecks({ d1_i0: true });
  api.setCharacterChatHistory([{ role: "user", content: "persistence check", at: "2026-05-12T00:00:00.000Z" }]);
  api.setTrainingSession({ id: "session-check", status: "active", date: "2026-05-12", dayIndex: 1 });

  const writes = api.getDomainPersistenceWriteLog().map((entry) => entry.key);
  assert.equal(JSON.stringify(writes), JSON.stringify([
    "gain-daily-logs",
    "gain-plan-checks",
    "gain-character-chat-history",
    "gain-training-session"
  ]));

  const reloaded = loadApp({ localStorageValues: localStorage._store }).api;
  assert.equal(reloaded.getDailyLogs()["2026-05-12"].date, "2026-05-12");
  assert.equal(reloaded.getPlanChecks().d1_i0, true);
  assert.equal(reloaded.getCharacterChatHistory()[0].content, "persistence check");
  assert.equal(reloaded.getTrainingSession().id, "session-check");
});

test("manual plan check toggles exactly one key and survives reload", () => {
  const { api, localStorage } = loadApp({
    localStorageValues: {
      "gain-plan-template": JSON.stringify({
        version: 1,
        days: [
          { day:"周一", weekday:1, focus:"训练", items:["动作 A", "动作 B"], protein:"" },
          { day:"周二", weekday:2, focus:"训练", items:["动作 C", "动作 D"], protein:"" }
        ]
      })
    }
  });

  const checks = api.togglePlanCheckForTest("d0_i0");
  assert.deepEqual(Object.keys(checks), ["d0_i0"]);
  assert.equal(JSON.parse(localStorage.getItem("gain-plan-checks")).d0_i0, true);

  const reloaded = loadApp({ localStorageValues: localStorage._store }).api;
  assert.deepEqual(Object.keys(reloaded.getPlanChecks()), ["d0_i0"]);
});

test("plan check save survives non-critical local sync metadata write failure", () => {
  const { api, localStorage } = loadApp({
    localStorageOptions: {
      throwOnSetKeys: ["gain-local-state-meta"]
    }
  });

  const originalWarn = console.warn;
  console.warn = () => {};
  try{
    assert.doesNotThrow(() => api.setPlanChecks({ d1_i0: true }));
  }finally{
    console.warn = originalWarn;
  }

  assert.equal(JSON.parse(localStorage.getItem("gain-plan-checks")).d1_i0, true);
  assert.equal(localStorage.getItem("gain-local-state-meta"), null);
  assert.ok(Date.parse(api.getLocalUpdatedAt()), "volatile local timestamp should still protect this session");
});

test("local version falls back to persisted plan check metadata", () => {
  const { api } = loadApp({
    localStorageValues: {
      "gain-plan-check-meta": JSON.stringify({
        d1_i0: { source:"manual", updatedAt:"2026-05-20T10:00:00.000Z" }
      })
    }
  });

  assert.equal(api.getLocalUpdatedAt(), "2026-05-20T10:00:00.000Z");
  assert.equal(api.chooseAutoSyncDirection({
    localUpdatedAt:"",
    cloudUpdatedAt:"2026-05-20T09:00:00.000Z",
    preferUploadLocalChanges:true
  }), "upload");
  assert.equal(api.chooseAutoSyncDirection({
    localUpdatedAt:"",
    cloudUpdatedAt:"2026-05-20T09:00:00.000Z",
    preferUploadLocalChanges:false
  }), "restore");
});

test("auto sync treats existing local plan checks as upload-before-restore progress", () => {
  const { api } = loadApp({
    localStorageValues: {
      "gain-plan-checks": JSON.stringify({ d2_i1:true })
    }
  });
  const empty = loadApp().api;

  assert.equal(api.hasLocalPlanCheckProgress(), true);
  assert.equal(api.shouldPreferLocalAutoSyncUpload(), true);
  assert.equal(api.getAutoSyncDirectionForCurrentState("2026-05-21T10:00:00.000Z"), "upload");
  assert.equal(empty.getAutoSyncDirectionForCurrentState("2026-05-21T10:00:00.000Z"), "restore");
});

test("cloud sync timeout aborts the underlying upload", async () => {
  const { api } = loadApp();
  let aborted = false;
  let completedAfterTimeout = false;
  const hangingPush = api.createCloudSyncForTest({
    async pullSnapshot(){
      return null;
    },
    pushSnapshot({ signal } = {}){
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          completedAfterTimeout = true;
          resolve({ ok:true });
        }, 80);
        if(signal){
          signal.addEventListener("abort", () => {
            aborted = true;
            clearTimeout(timer);
            reject(new Error("aborted"));
          }, { once:true });
        }
      });
    },
    toAppSnapshot(record){
      return record && record.snapshot;
    }
  }, ["2026-05-12T10:00:00.000Z"], { operationTimeoutMs:20 });

  await assert.rejects(
    () => hangingPush.pushSnapshot({ userId:"sync-user", reason:"timeout check", skipVersionCheck:true }),
    /Cloud push timed out/
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(aborted, true, "timeout should abort the adapter request");
  assert.equal(completedAfterTimeout, false, "aborted upload must not complete later");
});

test("cloud sync upload reloads direct plan check writes before snapshotting", async () => {
  const { api } = loadApp();
  const base = api.exportAppStateSnapshot();
  let remoteRecord = {
    snapshot: {
      ...base,
      planChecks: { d0_i0:true },
      planCheckMeta: { d0_i0:{ source:"mobile" } },
      updatedAt: "2026-05-10T10:00:00.000Z"
    },
    updated_at: "2026-05-10T10:00:00.000Z"
  };
  const cloudSync = api.createCloudSyncForTest({
    async pullSnapshot(){
      return remoteRecord;
    },
    async pushSnapshot({ snapshot, updatedAt } = {}){
      remoteRecord = { snapshot, updated_at:updatedAt };
      return { ok:true, updatedAt };
    },
    toAppSnapshot(record){
      return record && record.snapshot;
    }
  }, ["2026-05-12T10:05:00.000Z"]);

  api.setPlanChecks({ d1_i0:true });
  const result = await cloudSync.pushSnapshot({
    userId:"sync-user",
    reason:"auto plan check sync",
    skipVersionCheck:true
  });

  assert.equal(result.ok, true);
  assert.equal(result.needsResync, false, "unchanged local state should finish in one upload");
  assert.equal(remoteRecord.snapshot.planChecks.d0_i0, true, "remote check should survive merge");
  assert.equal(remoteRecord.snapshot.planChecks.d1_i0, true, "local direct check should upload");
  const localAfterPush = api.exportAppStateSnapshot();
  assert.equal(localAfterPush.planChecks.d0_i0, true);
  assert.equal(localAfterPush.planChecks.d1_i0, true);
});

test("cloud sync upload preserves local changes made while the request is in flight", async () => {
  const { api } = loadApp();
  let releasePush;
  let signalPushStarted;
  const pushStarted = new Promise((resolve) => { signalPushStarted = resolve; });
  const cloudSync = api.createCloudSyncForTest({
    async pullSnapshot(){
      return null;
    },
    pushSnapshot(){
      signalPushStarted();
      return new Promise((resolve) => { releasePush = resolve; });
    },
    toAppSnapshot(record){
      return record && record.snapshot;
    }
  }, ["2026-05-12T10:05:00.000Z"]);

  api.setPlanChecks({ before_upload:true });
  const inFlight = cloudSync.pushSnapshot({
    userId:"sync-user",
    reason:"concurrent edit check",
    skipVersionCheck:true
  });

  await pushStarted;
  api.setPlanChecks({ before_upload:true, changed_during_upload:true });
  releasePush({ ok:true });
  const result = await inFlight;

  const localAfterPush = api.exportAppStateSnapshot();
  assert.equal(localAfterPush.planChecks.changed_during_upload, true);
  assert.equal(result.needsResync, true, "concurrent local changes should request a follow-up upload");
});

test("auto sync local plan-check upload does not resurrect stale remote checks", async () => {
  const { api } = loadApp();
  const base = api.exportAppStateSnapshot();
  let remoteRecord = {
    snapshot: {
      ...base,
      planChecks: { d0_i0:true, d4_i3:true },
      planCheckMeta: {
        d0_i0:{ source:"old-remote", updatedAt:"2026-05-10T09:00:00.000Z" },
        d4_i3:{ source:"old-remote", updatedAt:"2026-05-10T09:00:00.000Z" }
      },
      updatedAt: "2026-05-10T10:00:00.000Z"
    },
    updated_at: "2026-05-10T10:00:00.000Z"
  };
  const cloudSync = api.createCloudSyncForTest({
    async pullSnapshot(){
      return remoteRecord;
    },
    async pushSnapshot({ snapshot, updatedAt } = {}){
      remoteRecord = { snapshot, updated_at:updatedAt };
      return { ok:true, updatedAt };
    },
    toAppSnapshot(record){
      return record && record.snapshot;
    }
  }, ["2026-05-12T10:10:00.000Z"]);

  api.togglePlanCheckForTest("d1_i0");
  const result = await cloudSync.pushSnapshot({
    userId:"sync-user",
    reason:"auto plan check sync",
    skipVersionCheck:true,
    preferLocalPlanChecks:true
  });

  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(remoteRecord.snapshot.planChecks), ["d1_i0"]);
  const localAfterPush = api.exportAppStateSnapshot();
  assert.deepEqual(Object.keys(localAfterPush.planChecks), ["d1_i0"]);
});

test("cloud sync upload preserves remote daily logs when the local snapshot is newer", async () => {
  const { api } = loadApp();
  const base = api.exportAppStateSnapshot();
  const remoteMondayLog = {
    date: "2026-05-18",
    records: [{ recordId:"mobile-monday-walk", exerciseName:"walking", amount:20, unit:"minute" }],
    aiCaptureRecords: [{ id:"mobile-monday-capture", recordType:"training_fact" }],
    planProgressItems: [{ id:"monday-plan-walk", itemId:"d0_i0", snapshotItemText:"walking 20 min", completedAmount:20, targetAmount:20, unit:"minute", checked:true }],
    completedCount: 1,
    totalItems: 1
  };
  const localTuesdayLog = {
    date: "2026-05-19",
    records: [{ recordId:"desktop-tuesday-stretch", exerciseName:"stretch", amount:10, unit:"minute" }],
    aiCaptureRecords: [{ id:"desktop-tuesday-capture", recordType:"training_fact" }],
    completedCount: 1,
    totalItems: 1
  };
  let remoteRecord = {
    snapshot: {
      ...base,
      dailyLogs: { "2026-05-18": remoteMondayLog },
      planChecks: { d0_i0:true },
      planCheckMeta: { d0_i0:{ source:"mobile" } },
      updatedAt: "2026-05-18T10:00:00.000Z"
    },
    updated_at: "2026-05-18T10:00:00.000Z"
  };
  const cloudSync = api.createCloudSyncForTest({
    async pullSnapshot(){
      return remoteRecord;
    },
    async pushSnapshot({ snapshot, updatedAt } = {}){
      remoteRecord = { snapshot, updated_at:updatedAt };
      return { ok:true, updatedAt };
    },
    toAppSnapshot(record){
      return record && record.snapshot;
    }
  });

  api.importAppStateSnapshot({
    ...base,
    dailyLogs: { "2026-05-19": localTuesdayLog },
    planChecks: { d1_i0:true },
    planCheckMeta: { d1_i0:{ source:"desktop" } },
    updatedAt: "2026-05-19T10:00:00.000Z"
  });

  const result = await cloudSync.pushSnapshot({ userId:"sync-user", reason:"manual desktop sync" });

  assert.equal(result.ok, true);
  assert.ok(remoteRecord.snapshot.dailyLogs["2026-05-18"], "remote mobile Monday log must survive desktop upload");
  assert.ok(remoteRecord.snapshot.dailyLogs["2026-05-19"], "local desktop Tuesday log should still upload");
  assert.equal(remoteRecord.snapshot.planChecks.d0_i0, true);
  assert.equal(remoteRecord.snapshot.planChecks.d1_i0, true);
  const localAfterPush = api.exportAppStateSnapshot();
  assert.ok(localAfterPush.dailyLogs["2026-05-18"], "desktop local state should also receive the merged cloud log");
});

test("architecture seam status exposes stable deep-module harness capabilities", () => {
  const { api } = loadApp();
  const status = api.getArchitectureSeamStatus();

  assert.equal(status.planReconciliationWriter, true);
  assert.equal(status.characterChatCaptureOrchestrator, true);
  assert.equal(status.domainPersistence, true);
  assert.equal(status.testEntryPublicApi, true);
});
