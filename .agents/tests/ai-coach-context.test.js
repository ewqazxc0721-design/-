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
    remove() {},
    closest() { return null; },
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

function loadApp({ formValues = {}, localStorageValues = {} } = {}) {
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
      if(!elements.has(id)){
        elements.set(id, createElement(id, formValues[id] || ""));
      }
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
  };

  const context = vm.createContext({
    console,
    document,
    window,
    navigator: window.navigator,
    localStorage,
    alert() {},
    confirm() { return true; },
    requestAnimationFrame(callback) { return callback(); },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => ({ ok: true, json: async () => ({}) })
  });

  vm.runInContext(html.slice(scriptStart, initStart), context, { filename: "index.html" });
  vm.runInContext(`
    globalThis.__testApi = {
      buildAiCoachEncouragementContext,
      buildAiExerciseCompletedPayload,
      buildAiDayCompletePayload,
      getPlanDays,
      saveAiFeedback,
      getCharacterChatHistory
    };
  `, context);
  return context.__testApi;
}

test("AI coach encouragement context reads counter plus today's calendar weight and sleep", () => {
  const api = loadApp({
    formValues: {
      weight1: "52.1",
      avgSleep: "7小时30分",
      latestSleep: "01:00"
    },
    localStorageValues: {
      "portable-counter-value": "8",
      "gain-daily-logs": JSON.stringify({
        "2026-05-11": {
          date: "2026-05-11",
          planDay: "周一",
          weight: "52.6",
          sleep: "7小时10分",
          note: "状态还行"
        }
      })
    }
  });

  const context = api.buildAiCoachEncouragementContext(0, { baseDate: new Date(2026, 4, 11) });

  assert.equal(context.counter.value, 8);
  assert.equal(context.today.date, "2026-05-11");
  assert.equal(context.today.weight, "52.6");
  assert.equal(context.today.weightSource, "dailyLog");
  assert.equal(context.today.sleep, "7小时10分");
  assert.equal(context.today.sleepSource, "dailyLog");
  assert.equal(context.today.note, "状态还行");
});

test("AI coach encouragement context falls back to weekly form weight and sleep when calendar log is empty", () => {
  const api = loadApp({
    formValues: {
      weight2: "53.1",
      avgSleep: "7小时40分",
      latestSleep: "00:50"
    },
    localStorageValues: {
      "portable-counter-value": "3",
      "gain-daily-logs": "{}"
    }
  });

  const context = api.buildAiCoachEncouragementContext(1, { baseDate: new Date(2026, 4, 11) });

  assert.equal(context.today.date, "2026-05-12");
  assert.equal(context.today.weight, "53.1");
  assert.equal(context.today.weightSource, "weeklyForm");
  assert.equal(context.today.sleep, "7小时40分");
  assert.equal(context.today.sleepSource, "weeklyAverage");
  assert.equal(context.today.latestSleep, "00:50");
});

test("exercise and day-complete AI payloads include encouragement context", () => {
  const api = loadApp({
    formValues: {
      weight1: "52.2",
      avgSleep: "7小时20分"
    },
    localStorageValues: {
      "portable-counter-value": "5",
      "gain-plan-checks": JSON.stringify({ d0_i0: true }),
      "gain-daily-logs": JSON.stringify({
        "2026-05-11": { date: "2026-05-11", weight: "52.7", sleep: "7小时" }
      })
    }
  });
  const monday = api.getPlanDays()[0];

  const exercisePayload = api.buildAiExerciseCompletedPayload(
    { dayIndex: 0, itemIndex: 0 },
    monday,
    monday.items[0],
    { d0_i0: true },
    { baseDate: new Date(2026, 4, 11) }
  );
  const dayCompletePayload = api.buildAiDayCompletePayload(
    0,
    monday,
    { d0_i0: true },
    { baseDate: new Date(2026, 4, 11) }
  );

  assert.equal(exercisePayload.encouragementContext.counter.value, 5);
  assert.equal(exercisePayload.encouragementContext.today.weight, "52.7");
  assert.equal(dayCompletePayload.encouragementContext.today.sleep, "7小时");
  assert.equal(dayCompletePayload.encouragementContext.weeklyBody.averageSleep, "7小时20分");
});

test("saved AI coach feedback is mirrored into the active character chat", () => {
  const api = loadApp({
    localStorageValues: {
      "gain-character-cards": JSON.stringify([
        { id: "anna", name: "Anna", description: "Training partner" }
      ]),
      "gain-active-character-card-id": "anna",
      "gain-character-chat-history": JSON.stringify([
        { role: "user", content: "How did that set look?", at: "2026-05-11T00:00:00.000Z" }
      ])
    }
  });

  api.saveAiFeedback(
    { type: "exercise_completed", title: "Action done", message: "Good set. Keep the next reps clean." },
    { day: "Monday" }
  );

  const history = api.getCharacterChatHistory();
  const latest = history.at(-1);
  assert.equal(latest.role, "assistant");
  assert.equal(latest.source, "ai_coach");
  assert.equal(latest.aiFeedbackType, "exercise_completed");
  assert.match(latest.content, /Action done/);
  assert.match(latest.content, /Good set/);
});
