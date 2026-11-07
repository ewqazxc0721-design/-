const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const INDEX_HTML = path.join(ROOT, "index.html");

function createElement(id, value = "") {
  let html = "";
  return {
    id,
    value,
    textContent: "",
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
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = String(value || "");
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector(selector) {
      if(selector === ".ai-coach-panel-card") return createElement("aiCoachPanelCard");
      return null;
    },
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
    }
  };
}

function loadApp(localStorageValues = {}) {
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
  const animationFrames = [];
  const timers = [];
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
    requestAnimationFrame(callback) {
      animationFrames.push(callback);
      return animationFrames.length;
    },
    cancelAnimationFrame() {},
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {},
    setInterval() {},
    clearInterval() {},
    fetch: async () => ({ ok: true, json: async () => ({}) })
  });

  vm.runInContext(html.slice(scriptStart, initStart), context, { filename: "index.html" });
  vm.runInContext(`
    globalThis.__testApi = {
      openAiCoachPanel
    };
  `, context);

  return {
    api: context.__testApi,
    element(id) {
      return document.getElementById(id);
    },
    flushDeferredLayout() {
      while(animationFrames.length) animationFrames.shift()();
      while(timers.length) timers.shift()();
    }
  };
}

test("opening role chat scrolls to the latest message after the panel layout is ready", () => {
  const history = Array.from({ length: 18 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `message ${index + 1}`,
    at: new Date(2026, 4, 15, 10, index).toISOString()
  }));
  const { api, element, flushDeferredLayout } = loadApp({
    "gain-character-cards": JSON.stringify([{ id: "role-1", name: "Role One" }]),
    "gain-active-character-card-id": "role-1",
    "gain-character-chat-history": JSON.stringify(history)
  });
  const log = element("characterChatLog");

  api.openAiCoachPanel(false);
  assert.equal(log.scrollTop, 0);

  log.scrollHeight = 1800;
  flushDeferredLayout();

  assert.equal(log.scrollTop, 1800);
  assert.match(log.innerHTML, /message 18/);
});
