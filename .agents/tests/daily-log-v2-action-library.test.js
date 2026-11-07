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

function loadApp({ localStorageValues = {}, now = new Date(2026, 4, 11, 12, 0, 0) } = {}) {
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
  const window = {
    document,
    localStorage,
    navigator: { standalone: false },
    crypto: { randomUUID: () => "daily-log-v2-test-id" },
    addEventListener() {},
    removeEventListener() {},
    AudioContext: undefined,
    webkitAudioContext: undefined,
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
    fetch: async () => ({ ok: false, json: async () => ({ actions: [] }) }),
    Date
  });

  vm.runInContext(html.slice(scriptStart, initStart), context, { filename: "index.html" });
  vm.runInContext(`
    globalThis.__testApi = {
      ensureDailyLogSnapshot,
      getDailyLogs,
      getExerciseLibrary,
      getExerciseLibraryMediaKeys,
      readExerciseLibraryAction,
      renderExerciseLibrary,
      openExerciseLibraryGuideModal,
      getPlanGuideModalState: () => ({
        display: document.getElementById("planGuideModal").style.display,
        html: document.getElementById("planGuideModalContent").innerHTML,
        detailHtml: document.getElementById("exerciseLibraryDetail").innerHTML
      }),
      createExerciseTemplateDraft,
      confirmExerciseTemplateDraft,
      getExerciseTemplateDrafts,
      handleCharacterTrainingCapture,
      undoTrainingCaptureRecord,
      collectDailyFacts,
      renderCalendarDetailForDate: (dateKey) => {
        selectedCalendarDate = dateKey;
        renderCalendarDetail();
        return document.getElementById("calendarDetail").innerHTML;
      },
      formatDateKey
    };
  `, context);
  vm.runInContext(`Date.now = () => ${now.getTime()};`, context);
  return { api: context.__testApi, localStorage };
}

test("DailyLog v2 snapshots separate training days from note-only recovery days", () => {
  const { api } = loadApp();

  const monday = api.ensureDailyLogSnapshot("2026-05-11");
  assert.equal(monday.schemaVersion, 2);
  assert.equal(monday.dayType, "training");
  assert.ok(monday.planProgressItems.length > 0);
  assert.equal(monday.planProgressItems[0].completedAmount, 0);
  assert.ok(monday.planProgressItems[0].exerciseKey);

  const sunday = api.ensureDailyLogSnapshot("2026-05-17");
  assert.equal(sunday.schemaVersion, 2);
  assert.equal(sunday.dayType, "note_only");
  assert.equal(Array.isArray(sunday.planProgressItems), true);
  assert.ok(sunday.planProgressItems.some((item) => item.snapshotItemText.includes("散步")));
  assert.ok(sunday.planProgressItems.some((item) => item.snapshotItemText.includes("拉伸")));
  assert.equal(sunday.planProgressItems.some((item) => /体重|睡眠|多吃|多睡/.test(item.snapshotItemText)), false);
});

test("recovery-day capture updates visible plan progress and surplus extras", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 17, 12, 0, 0) });
  const dateKey = "2026-05-17";
  const before = api.ensureDailyLogSnapshot(dateKey, { persist: true });
  assert.equal(before.dayType, "note_only");

  const result = api.handleCharacterTrainingCapture("\u4eca\u5929\u6563\u6b6530\u5206\u949f\uff0c\u62c9\u4f3815\u5206\u949f", {
    now: new Date(2026, 4, 17, 12, 0, 0),
    sourceType: "character_chat",
    createCard: false
  });

  assert.equal(result.status, "recorded");
  const log = api.getDailyLogs()[dateKey];
  const walking = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u6563\u6b65"));
  const stretching = log.planProgressItems.find((item) => item.snapshotItemText.includes("\u62c9\u4f38"));
  assert.equal(walking.completedAmount, 20);
  assert.equal(walking.status, "completed");
  assert.equal(stretching.completedAmount, 10);
  assert.equal(stretching.status, "completed");
  assert.ok((log.extraTrainingEvents || []).some((event) => event.snapshotDisplayName === "\u6563\u6b65" && Number(event.amount) === 10));
  assert.ok((log.extraTrainingEvents || []).some((event) => event.snapshotDisplayName === "\u62c9\u4f38" && Number(event.amount) === 5));

  const html = api.renderCalendarDetailForDate(dateKey);
  assert.match(html, /\u5f53\u5929\u8ba1\u5212\u8fdb\u5ea6/);
  assert.match(html, /\u6563\u6b65/);
  assert.match(html, /\u62c9\u4f38/);
  assert.doesNotMatch(html, /\u5df2\u5b8c\u6210\s*0\/20\u5206\u949f/);
  assert.doesNotMatch(html, /\u5df2\u5b8c\u6210\s*0\/10\u5206\u949f/);
  assert.match(log.aiDailySummary.text, /\u8ba1\u5212\u8fdb\u5ea6/);
  assert.match(log.aiDailySummary.text, /\u989d\u5916\u8bad\u7ec3/);
});

test("exercise library can read every mapped media action through a stable exercise key", () => {
  const { api } = loadApp();
  const library = api.getExerciseLibrary();
  const mediaKeys = api.getExerciseLibraryMediaKeys();

  assert.ok(library.length > 20);
  assert.ok(mediaKeys.length > 25);
  for(const name of mediaKeys){
    const action = api.readExerciseLibraryAction(name);
    assert.ok(action, `missing library action for ${name}`);
    assert.ok(action.exerciseKey);
    assert.ok(action.displayName);
    assert.ok(action.media && action.media.path);
  }

  assert.notEqual(api.readExerciseLibraryAction("单臂哑铃划船").exerciseKey, api.readExerciseLibraryAction("俯身双哑铃划船").exerciseKey);
  assert.notEqual(api.readExerciseLibraryAction("单臂哑铃划船").exerciseKey, api.readExerciseLibraryAction("弹力绳划船").exerciseKey);
  assert.equal(api.readExerciseLibraryAction("坐姿拉背"), null);
});

test("exercise library actions open the shared guide modal card instead of rendering inline media", () => {
  const { api } = loadApp();

  api.renderExerciseLibrary();
  assert.doesNotMatch(api.getPlanGuideModalState().detailHtml, /<img\b/i);

  const result = api.openExerciseLibraryGuideModal("db-calf-raise");
  const state = api.getPlanGuideModalState();

  assert.equal(result.status, "opened");
  assert.equal(state.display, "flex");
  assert.match(state.html, /训练动作库/);
  assert.match(state.html, /哑铃提踵/);
  assert.match(state.html, /class="guide-result"/);
  assert.match(state.html, /custom_dumbbell_calf_raise\.gif/);
});

test("training capture updates plan progress first and writes extra events only after target is met", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 11, 12, 0, 0) });
  api.ensureDailyLogSnapshot("2026-05-11");

  api.handleCharacterTrainingCapture("今天侧平举一组", { now: new Date(2026, 4, 11, 12, 0, 0) });
  let log = api.getDailyLogs()["2026-05-11"];
  let sideRaise = log.planProgressItems.find((item) => item.snapshotDisplayName === "侧平举");
  assert.equal(sideRaise.completedAmount, 1);
  assert.equal(sideRaise.targetAmount, 4);
  assert.equal(log.extraTrainingEvents.length, 0);

  api.handleCharacterTrainingCapture("侧平举三组", { now: new Date(2026, 4, 11, 12, 5, 0) });
  api.handleCharacterTrainingCapture("又加练一组侧平举", { now: new Date(2026, 4, 11, 12, 10, 0) });

  log = api.getDailyLogs()["2026-05-11"];
  sideRaise = log.planProgressItems.find((item) => item.snapshotDisplayName === "侧平举");
  assert.equal(sideRaise.completedAmount, 4);
  assert.equal(sideRaise.status, "completed");
  assert.equal(log.extraTrainingEvents.length, 1);
  assert.equal(log.extraTrainingEvents[0].amount, 1);
});

test("daily facts are collected by category instead of reading only legacy AI capture records", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 11, 12, 0, 0) });
  api.ensureDailyLogSnapshot("2026-05-11");
  api.handleCharacterTrainingCapture("今天侧平举一组", { now: new Date(2026, 4, 11, 12, 0, 0) });
  api.handleCharacterTrainingCapture("肩膀有点不舒服", { now: new Date(2026, 4, 11, 12, 2, 0) });

  const facts = api.collectDailyFacts("2026-05-11");
  assert.ok(facts.planProgress.some((item) => item.displayName === "侧平举" && item.completedAmount === 1));
  assert.ok(facts.safetyFeedback.length >= 1);
  assert.equal(facts.safetyFeedback[0].countsTowardTraining, false);
});

test("daily facts and calendar detail include record protocol writes", () => {
  const { api } = loadApp({
    localStorageValues: {
      "gain-daily-logs": JSON.stringify({
        "2026-05-16": {
          date: "2026-05-16",
          dayType: "training",
          records: [{
            recordId: "protocol-plank-1",
            type: "extra_training",
            targetDateIso: "2026-05-16",
            exerciseName: "平板支撑",
            amount: 2,
            unit: "set",
            sets: 2,
            duration: 60,
            durationUnit: "second",
            evidenceText: "这周六的平板支撑，每组的时间是60秒"
          }]
        }
      })
    }
  });

  const facts = api.collectDailyFacts("2026-05-16");
  const plank = facts.extraTraining.find((item) => item.source === "record_protocol");
  assert.equal(plank.displayName, "平板支撑");
  assert.equal(plank.amount, 2);
  assert.equal(plank.unit, "组");
  assert.equal(plank.duration, 60);
  assert.equal(plank.durationUnit, "秒");

  const html = api.renderCalendarDetailForDate("2026-05-16");
  assert.match(html, /平板支撑/);
  assert.match(html, /60秒/);
  assert.match(html, /AI 协议记录/);
});

test("training calendar detail shows completed and unfinished amounts for every planned action", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 14, 12, 0, 0) });
  api.ensureDailyLogSnapshot("2026-05-14");

  api.handleCharacterTrainingCapture("今天侧平举一组", { now: new Date(2026, 4, 14, 12, 0, 0) });

  const html = api.renderCalendarDetailForDate("2026-05-14");
  assert.match(html, /当天计划进度/);
  assert.match(html, /侧平举/);
  assert.match(html, /已完成 1\/4组/);
  assert.match(html, /未完成 3组/);
  assert.match(html, /反向卷腹/);
  assert.match(html, /已完成 0\/3组/);
  assert.match(html, /未完成 3组/);
});

test("short training reference only binds while the active v2 snapshot reference is valid", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 11, 12, 0, 0) });
  api.ensureDailyLogSnapshot("2026-05-11");

  api.handleCharacterTrainingCapture("今天侧平举一组", { now: new Date(2026, 4, 11, 12, 0, 0) });
  api.handleCharacterTrainingCapture("又一组", { now: new Date(2026, 4, 11, 12, 1, 0) });

  const log = api.getDailyLogs()["2026-05-11"];
  const sideRaise = log.planProgressItems.find((item) => item.snapshotDisplayName === "侧平举");
  assert.equal(sideRaise.completedAmount, 2);
  assert.equal(log.extraTrainingEvents.length, 0);
});

test("undo rolls back structured plan progress and revokes linked extra events", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 11, 12, 0, 0) });
  api.ensureDailyLogSnapshot("2026-05-11");

  const first = api.handleCharacterTrainingCapture("今天侧平举一组", { now: new Date(2026, 4, 11, 12, 0, 0) });
  api.undoTrainingCaptureRecord(first.recordId);
  let log = api.getDailyLogs()["2026-05-11"];
  let sideRaise = log.planProgressItems.find((item) => item.snapshotDisplayName === "侧平举");
  assert.equal(sideRaise.completedAmount, 0);

  api.handleCharacterTrainingCapture("侧平举四组", { now: new Date(2026, 4, 11, 12, 5, 0) });
  const extra = api.handleCharacterTrainingCapture("又加练一组侧平举", { now: new Date(2026, 4, 11, 12, 10, 0) });
  api.undoTrainingCaptureRecord(extra.recordId);
  log = api.getDailyLogs()["2026-05-11"];
  sideRaise = log.planProgressItems.find((item) => item.snapshotDisplayName === "侧平举");
  assert.equal(sideRaise.completedAmount, 4);
  assert.equal(log.extraTrainingEvents.filter((event) => !event.revoked).length, 0);
});

test("past cross-day training without an existing snapshot does not create structured progress", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 14, 12, 0, 0) });

  const result = api.handleCharacterTrainingCapture("上周二引体向上三组", { now: new Date(2026, 4, 14, 12, 0, 0) });
  const log = api.getDailyLogs()["2026-05-05"];

  assert.equal(result.status, "not_recorded");
  assert.equal(log?.dayType, "note_only");
  assert.equal((log?.planProgressItems || []).some((item) => Number(item.completedAmount || 0) > 0), false);
  assert.equal((log?.extraTrainingEvents || []).length, 0);
});

test("ambiguous weekday body metrics resolve to the nearest past date", () => {
  const { api } = loadApp({ now: new Date(2026, 4, 11, 12, 0, 0) });

  api.handleCharacterTrainingCapture("周三体重 70kg，睡了 7 小时", { now: new Date(2026, 4, 11, 12, 0, 0) });
  const logs = api.getDailyLogs();

  assert.ok(logs["2026-05-06"], "Monday mentioning 周三 should target the previous Wednesday");
  assert.equal(logs["2026-05-06"].bodyState.weight, "70");
  assert.equal(logs["2026-05-06"].bodyState.sleep, "7小时");
  assert.equal(logs["2026-05-13"], undefined);
});

test("unknown exercise templates stay drafts until safety cautions and user confirmation exist", () => {
  const { api } = loadApp();

  const draftResult = api.createExerciseTemplateDraft("熊爬肩推", { sourceText: "熊爬肩推三组" });
  assert.equal(draftResult.status, "draft");
  assert.equal(api.confirmExerciseTemplateDraft(draftResult.draft.id).status, "needs_review");
  assert.equal(api.readExerciseLibraryAction("熊爬肩推"), null);

  const reviewed = api.createExerciseTemplateDraft("熊爬肩推", {
    sourceText: "熊爬肩推三组",
    cautions: ["肩部不适时停止", "动作放慢，避免塌腰"]
  });
  const confirmed = api.confirmExerciseTemplateDraft(reviewed.draft.id);
  assert.equal(confirmed.status, "confirmed");
  assert.equal(api.readExerciseLibraryAction("熊爬肩推").exerciseKey, confirmed.action.exerciseKey);
});
