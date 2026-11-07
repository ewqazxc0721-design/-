#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.cwd();
const started = Date.now();
const failures = [];

function run(label, args) {
  console.log(`\nRUN ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    failures.push(label);
  }
}

run("feature coverage manifest", [".agents/scripts/check-webapp-feature-coverage.js"]);
run("functional copy drift check", [".agents/scripts/generate-liquid-glass-functional.js", "--check"]);

const testsDir = path.join(root, ".agents", "tests");
const testFiles = fs.readdirSync(testsDir)
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => path.join(".agents", "tests", name));

for (const testFile of testFiles) {
  run(testFile, ["--test", testFile]);
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
if (failures.length) {
  console.error(`\nFULL REGRESSION FAILED after ${seconds}s`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`\nFULL REGRESSION PASSED: ${testFiles.length} test files plus coverage and functional-copy checks in ${seconds}s.`);
