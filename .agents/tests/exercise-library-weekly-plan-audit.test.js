const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const INDEX_HTML = path.join(ROOT, "index.html");
const WEEKLY_JSON_DIR = path.join(ROOT, "每周训练json");

const NON_EXERCISE_ITEMS = new Set(["多吃，多睡", "记录本周平均体重"]);

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

function cleanPlanExerciseName(item) {
  return String(item || "")
    .replace(/^可选[:：]\s*/, "")
    .replace(/[（(].*?[）)]/g, "")
    .split(/\s+\d| \d|×/)[0]
    .trim();
}

function getWeeklyPlanExerciseNames() {
  const names = new Set();
  for(const file of fs.readdirSync(WEEKLY_JSON_DIR).filter((name) => name.endsWith(".json"))){
    const data = JSON.parse(fs.readFileSync(path.join(WEEKLY_JSON_DIR, file), "utf8"));
    for(const day of data.days || []){
      for(const item of day.items || []){
        const name = cleanPlanExerciseName(item);
        if(name && !NON_EXERCISE_ITEMS.has(name)) names.add(name);
      }
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function loadApp() {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const scriptStart = html.indexOf("const APP_VERSION");
  const initStart = html.indexOf('document.querySelectorAll(".tab").forEach((btn) => {\n      btn.addEventListener("click"', scriptStart);
  assert.notEqual(scriptStart, -1);
  assert.notEqual(initStart, -1);

  const elements = new Map();
  const localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };
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
  const context = vm.createContext({
    console,
    document,
    window: {
      document,
      localStorage,
      navigator: { standalone: false },
      addEventListener() {},
      removeEventListener() {},
      matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
      supabase: { createClient: () => ({ auth: { onAuthStateChange() {} } }) }
    },
    navigator: { standalone: false },
    localStorage,
    alert() {},
    confirm() { return true; },
    requestAnimationFrame(callback) { return callback(); },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => ({ ok: false, json: async () => ({}) })
  });
  vm.runInContext(html.slice(scriptStart, initStart), context, { filename: "index.html" });
  vm.runInContext(`
    globalThis.__testApi = {
      readExerciseLibraryAction,
      getExerciseLibrary
    };
  `, context);
  return context.__testApi;
}

test("exercise library covers every real exercise found in weekly training JSON files", () => {
  const api = loadApp();
  const missing = [];
  const missingMedia = [];

  for(const name of getWeeklyPlanExerciseNames()){
    const action = api.readExerciseLibraryAction(name);
    if(!action){
      missing.push(name);
      continue;
    }
    if(!action.media?.path) missingMedia.push(`${name} -> ${action.exerciseKey}`);
  }

  assert.deepEqual(missing, []);
  assert.deepEqual(missingMedia, []);
});

test("core exercises stay as separate stable actions instead of aliases of Russian twist or plank", () => {
  const api = loadApp();
  const names = ["平板支撑", "短平板支撑", "侧桥", "死虫", "卷腹", "反向卷腹", "仰卧举腿", "俄罗斯转体"];
  const entries = names.map((name) => api.readExerciseLibraryAction(name));
  assert.equal(entries.every(Boolean), true);

  const keys = entries.map((entry) => entry.exerciseKey);
  assert.equal(new Set(keys).size, names.length);
  assert.equal(api.readExerciseLibraryAction("俄罗斯转体").aliases.includes("死虫"), false);
  assert.equal(api.readExerciseLibraryAction("平板支撑").aliases.includes("卷腹"), false);
});

test("similar rows and lateral raise variations are not collapsed through broad aliases", () => {
  const api = loadApp();

  assert.notEqual(api.readExerciseLibraryAction("单臂哑铃划船").exerciseKey, api.readExerciseLibraryAction("俯身双哑铃划船").exerciseKey);
  assert.notEqual(api.readExerciseLibraryAction("单臂哑铃划船").exerciseKey, api.readExerciseLibraryAction("弹力绳划船").exerciseKey);
  assert.notEqual(api.readExerciseLibraryAction("侧平举").exerciseKey, api.readExerciseLibraryAction("单臂侧平举").exerciseKey);
  assert.notEqual(api.readExerciseLibraryAction("侧平举").exerciseKey, api.readExerciseLibraryAction("弹力绳侧平举").exerciseKey);
});
