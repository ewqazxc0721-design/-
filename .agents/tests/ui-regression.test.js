const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const INDEX_HTML = path.join(ROOT, "index.html");

function createElement(id) {
  return {
    id,
    value: "",
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
    setAttribute() {},
    getAttribute() { return ""; }
  };
}

function loadScriptApi() {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const start = html.indexOf("const APP_VERSION");
  const stop = html.indexOf('document.querySelectorAll(".tab").forEach((btn) => {\n      btn.addEventListener("click"', start);
  assert.notEqual(start, -1, "main script should exist");
  assert.notEqual(stop, -1, "test harness should stop before boot code");

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
  const localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
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
    fetch: async () => ({ ok: true, json: async () => ({}) })
  });
  vm.runInContext(html.slice(start, stop), context, { filename: "index.html" });
  vm.runInContext(`
    globalThis.__testApi = {
      clampDayIndicatorVisualLeft,
      getCenteredDayIndicatorBox,
      shouldResetFirstIosDayDock,
      buildCharacterChatLogHtml
    };
  `, context);
  return context.__testApi;
}

function visualBounds(left, width, scaleX, direction) {
  const scale = Math.max(1, scaleX || 1);
  const extra = width * (scale - 1);
  if(direction > 0) return { left, right: left + width * scale };
  if(direction < 0) return { left: left - extra, right: left + width };
  return { left: left - extra / 2, right: left + width + extra / 2 };
}

test("iOS day indicator clamp keeps the dark pill inside the visible nav bounds", () => {
  const { clampDayIndicatorVisualLeft } = loadScriptApi();
  const cases = [
    { left: -30, width: 98, scrollLeft: 0, containerWidth: 360, edgeGap: 14, scaleX: 1, direction: 0 },
    { left: 310, width: 100, scrollLeft: 0, containerWidth: 360, edgeGap: 14, scaleX: 1.17, direction: 1 },
    { left: 42, width: 100, scrollLeft: 80, containerWidth: 360, edgeGap: 14, scaleX: 1.12, direction: -1 }
  ];

  cases.forEach((input) => {
    const next = clampDayIndicatorVisualLeft(input);
    const bounds = visualBounds(next, input.width, input.scaleX, input.direction);
    assert.ok(bounds.left >= input.scrollLeft + input.edgeGap - 0.01);
    assert.ok(bounds.right <= input.scrollLeft + input.containerWidth - input.edgeGap + 0.01);
  });
});

test("iOS day indicator stays centered on the selected day label near nav edges", () => {
  const { getCenteredDayIndicatorBox } = loadScriptApi();

  const firstDay = getCenteredDayIndicatorBox({
    center: 64,
    desiredWidth: 120,
    minWidth: 68,
    visibleLeft: 14,
    visibleRight: 346
  });

  assert.ok(firstDay.left >= 14);
  assert.ok(firstDay.left + firstDay.width <= 346);
  assert.ok(Math.abs((firstDay.left + firstDay.width / 2) - 64) < 0.01);
  assert.ok(firstDay.width < 120, "edge pill should shrink before it loses center alignment");

  const middleDay = getCenteredDayIndicatorBox({
    center: 180,
    desiredWidth: 120,
    minWidth: 68,
    visibleLeft: 14,
    visibleRight: 346
  });

  assert.equal(middleDay.width, 120);
  assert.ok(Math.abs((middleDay.left + middleDay.width / 2) - 180) < 0.01);
});

test("weekly plan day dock does not double-subtract side padding from tab geometry", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const dayTabRules = Array.from(html.matchAll(/#dayTabs \.day-tab\s*\{([\s\S]*?)\n\s*\}/g), (match) => match[1]);
  const finalRule = dayTabRules.at(-1) || "";

  assert.match(finalRule, /flex:\s*0 0 25% !important/);
  assert.match(finalRule, /width:\s*25% !important/);
  assert.doesNotMatch(finalRule, /100%\s*-\s*40px/);
  assert.doesNotMatch(html, /calc\(\(100% - 40px\) \/ 4\)/);
  assert.equal(
    dayTabRules.some((rule) => /calc\(\(100%\s*-\s*\(var\(--day-tab-side-padding\)\s*\*\s*2\)\)\s*\/\s*4\)/.test(rule)),
    false,
    "day tab width rules must not subtract side padding; flex percentage already resolves against content box"
  );
});

test("iOS first day dock hides and resets if Safari restores horizontal scroll on load", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const { shouldResetFirstIosDayDock } = loadScriptApi();

  assert.equal(shouldResetFirstIosDayDock({ isIos:true, activeIndex:0, scrollLeft:153 }), true);
  assert.equal(shouldResetFirstIosDayDock({ isIos:true, activeIndex:1, scrollLeft:153 }), false);
  assert.equal(shouldResetFirstIosDayDock({ isIos:false, activeIndex:0, scrollLeft:153 }), false);
  assert.match(html, /first-day-resetting/);
  assert.match(html, /forceIosDayDockLeftEdge\(\{ updateIndicator:false \}\)/);
  assert.match(html, /hideDayDockIndicatorDuringFirstDayReset\(tabs\)/);
});

test("weekly plan day dock repairs indicator after reload for all browser modes", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");

  assert.match(html, /function repairDayDockLayout\(/);
  assert.match(html, /function scheduleDayDockPostLayoutRepair\(/);
  assert.match(html, /document\.fonts\.ready/);
  assert.match(html, /window\.addEventListener\("pageshow"[\s\S]*scheduleDayDockPostLayoutRepair/);
  assert.match(html, /window\.addEventListener\("focus"[\s\S]*scheduleDayDockPostLayoutRepair/);
});

test("manual plan checks rerender without forcing the weekly day dock to scroll", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");

  assert.match(html, /function renderPlan\(options = \{\}\)/);
  assert.match(html, /const shouldScrollDayDock = options\.scrollDayDock !== false/);
  assert.match(html, /const preserveDayDockScroll = options\.preserveDayDockScroll === true/);
  assert.match(html, /scheduleDayDockPostLayoutRepair\(\{ immediate:true, scroll: shouldScrollDayDock \}\)/);
  assert.match(html, /function togglePlanCheck[\s\S]*renderPlan\(\{ scrollDayDock:false, preserveDayDockScroll:true \}\)/);
});

test("bottom navigation drag keeps the iOS touch chain locked until release", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const tabsRules = Array.from(html.matchAll(/\.tabs\s*\{([\s\S]*?)\n\s*\}/g), (match) => match[1]).join("\n");
  const tabRules = Array.from(html.matchAll(/\.tab\s*\{([\s\S]*?)\n\s*\}/g), (match) => match[1]).join("\n");

  assert.match(tabsRules, /touch-action:\s*none/);
  assert.match(tabRules, /touch-action:\s*none/);
  assert.match(html, /tabsEl\.addEventListener\("pointerdown", handlePointerDown, \{ passive:false \}\)/);
  assert.match(html, /const lockDockTouchChain = \(\) => \{/);
  assert.match(html, /const clearDockTouchChainLock = \(\) => \{/);
  assert.match(html, /handlePointerDown[\s\S]*event\.preventDefault\(\)/);
  assert.match(html, /document\.addEventListener\("lostpointercapture", handleLostPointerCapture/);
  assert.doesNotMatch(html, /document\.addEventListener\("lostpointercapture", cancelPointerInteraction/);
  assert.match(html, /document\.addEventListener\("touchmove", handleTouchMove, \{ passive:false, capture:true \}\)/);
  assert.match(html, /document\.addEventListener\("touchend", handleTouchEnd, \{ passive:false, capture:true \}\)/);
  assert.match(html, /document\.addEventListener\("touchcancel", handleTouchCancel, \{ passive:true, capture:true \}\)/);
});

test("mobile bottom navigation centers the active pill on edge tabs", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const prototypeDock = html.slice(html.indexOf("Prototype-only 4+1 bottom dock"));

  assert.match(
    prototypeDock,
    /@media \(max-width:480px\)[\s\S]*\.tabs\{[\s\S]*--indicator-edge-gap:5px !important/
  );
  assert.match(html, /function getCenteredTabIndicatorBox\(/);
  assert.match(html, /indicatorBoxForItem:\(box\) => getCenteredTabIndicatorBox/);
});

test("AI bubble chat modal layout keeps the text input visible in the panel", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");

  assert.match(html, /class="[^"]*\bai-coach-panel-modal\b/);
  assert.match(html, /class="[^"]*\bai-coach-panel-card\b/);
  assert.match(html, /\.ai-coach-panel-card[\s\S]*display:flex/);
  assert.match(html, /\.ai-coach-panel-card[\s\S]*overflow:hidden/);
  assert.match(html, /\.ai-coach-chat-box[\s\S]*flex-direction:column/);
  assert.match(html, /#characterChatInput[\s\S]*flex:0 0 auto/);
  assert.match(html, /#characterChatInput[\s\S]*box-sizing:border-box/);
});

test("training capture notifications render as transient toasts outside the AI chat card", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const modalIndex = html.indexOf('id="aiCoachPanelModal"');
  const toastIndex = html.indexOf('id="trainingCaptureToastStack"');
  const cardIndex = html.indexOf('class="ai-coach-panel-card"', modalIndex);

  assert.notEqual(modalIndex, -1);
  assert.notEqual(toastIndex, -1);
  assert.notEqual(cardIndex, -1);
  assert.ok(toastIndex > modalIndex && toastIndex < cardIndex, "toast stack should sit in the modal overlay before the chat card");
  assert.doesNotMatch(html, /id="trainingCaptureCardStack"/);
  assert.match(html, /\.training-capture-toast-stack[\s\S]*position:fixed/);
  assert.match(html, /\.training-capture-toast-stack \.training-capture-card[\s\S]*pointer-events:auto/);
  assert.match(html, /data-capture-toast-dismiss/);
  assert.match(html, /class="training-capture-toast-close"/);
  assert.match(html, /TRAINING_CAPTURE_TOAST_MS\s*=\s*5000/);
});

test("AI bubble chat composer keeps the input and action buttons in separate rows", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");

  assert.match(html, /class="[^"]*\bcharacter-chat-composer\b/);
  assert.match(html, /class="[^"]*\bcharacter-chat-actions\b/);
  assert.match(html, /\.character-chat-composer[\s\S]*display:grid/);
  assert.match(html, /\.character-chat-composer[\s\S]*grid-template-rows:auto auto/);
  assert.match(html, /\.character-chat-composer[\s\S]*gap:10px/);
  assert.match(html, /\.character-chat-composer[\s\S]*position:sticky/);
  assert.match(html, /\.character-chat-composer[\s\S]*z-index:30/);
  assert.match(html, /#characterChatInput[\s\S]*z-index:40/);
  assert.match(html, /#characterChatInput[\s\S]*border-radius:999px/);
  assert.match(html, /\.character-chat-actions[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /\.character-chat-actions[\s\S]*padding:10px/);
  assert.match(html, /\.character-chat-actions[\s\S]*border-radius:18px/);
  assert.match(html, /chatBox\.style\.display = "flex"/);
});

test("character chat renderer escapes user and assistant text", () => {
  const { buildCharacterChatLogHtml } = loadScriptApi();
  const html = buildCharacterChatLogHtml(
    { id: "role-1", name: "Coach", first_mes: "<b>hello</b>" },
    [
      { role: "user", content: "<img src=x onerror=alert(1)>" },
      { role: "assistant", content: "safe <script>alert(1)</script>" }
    ]
  );

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /safe &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<script>/);
});

test("AI settings expose record protocol management and debug panel outside chat UI", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");

  assert.match(html, /id="importRecordProtocolBtn"/);
  assert.match(html, /id="recordProtocolEnabledBtn"/);
  assert.match(html, /id="recordProtocolDebugBtn"/);
  assert.match(html, /id="recordProtocolList"/);
  assert.match(html, /id="recordProtocolDebugPanel"/);
  assert.match(html, /function renderRecordProtocolUi\(/);
  assert.match(html, /recordProtocolDebugPanel[\s\S]*rawModelOutput/);
});

test("weekly record page exposes the AI weekly summary draft and refresh control", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");

  assert.match(html, /id="aiWeeklySummaryDraftCard"/);
  assert.match(html, /id="aiWeeklySummaryDraftContent"/);
  assert.match(html, /id="refreshAiWeeklyDraftBtn"/);
  assert.match(html, /基于训练日历/);
});

test("PWA manifest and exercise library assets referenced by the page exist", () => {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  assert.match(html, /href="\.\/icons\/app-icon\.svg"/);
  assert.ok(fs.existsSync(path.join(ROOT, "manifest.webmanifest")));
  assert.ok(fs.existsSync(path.join(ROOT, "icons", "app-icon.svg")));
  assert.match(sw, /训练动作库\/actions\.json/);
  assert.match(sw, /icons\/app-icon\.svg/);
  assert.ok(fs.existsSync(path.join(ROOT, "训练动作库", "actions.json")));
});
