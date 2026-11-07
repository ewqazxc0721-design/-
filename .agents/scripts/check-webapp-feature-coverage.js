#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const manifestPath = path.join(root, "docs", "webapp-feature-coverage.json");
const mapPath = path.join(root, "docs", "webapp-function-map.md");
const testsDir = path.join(root, ".agents", "tests");

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalizeRel(file) {
  return file.replace(/\\/g, "/").replace(/^\.\//, "");
}

function extractTestNames(file) {
  const text = fs.readFileSync(file, "utf8");
  const names = new Set();
  const pattern = /(?:^|\n)\s*test\(\s*(['"`])([\s\S]*?)\1/g;
  let match;
  while ((match = pattern.exec(text))) {
    names.add(match[2].replace(/\s+/g, " ").trim());
  }
  return names;
}

function main() {
  if (!fs.existsSync(manifestPath)) fail(`Missing ${normalizeRel(path.relative(root, manifestPath))}`);
  if (!fs.existsSync(mapPath)) fail(`Missing ${normalizeRel(path.relative(root, mapPath))}`);

  const manifest = readJson(manifestPath);
  if (manifest.schema !== "webapp-feature-coverage/v1") {
    fail(`Unsupported feature coverage schema: ${manifest.schema}`);
  }
  if (!Array.isArray(manifest.features) || manifest.features.length < 10) {
    fail("Feature coverage manifest must list the major app capabilities.");
  }

  const mapText = fs.readFileSync(mapPath, "utf8");
  const allTestFiles = fs.readdirSync(testsDir)
    .filter((name) => name.endsWith(".test.js"))
    .map((name) => normalizeRel(path.join(".agents", "tests", name)));
  const referencedTestFiles = new Set((manifest.supportingTestFiles || []).map(normalizeRel));
  const featureIds = new Set();
  let coveredCount = 0;
  let gapCount = 0;

  for (const feature of manifest.features) {
    if (!feature || typeof feature !== "object") fail("Feature entries must be objects.");
    if (!feature.id || !/^[a-z0-9-]+$/.test(feature.id)) fail(`Invalid feature id: ${feature.id}`);
    if (featureIds.has(feature.id)) fail(`Duplicate feature id: ${feature.id}`);
    featureIds.add(feature.id);
    if (!mapText.includes(feature.id)) fail(`Human function map does not mention feature id ${feature.id}`);
    if (!feature.name) fail(`Feature ${feature.id} is missing a name.`);
    if (!feature.changeRisk) fail(`Feature ${feature.id} is missing changeRisk.`);
    if (!["covered", "gap"].includes(feature.status)) fail(`Feature ${feature.id} has invalid status ${feature.status}`);

    if (feature.status === "covered") {
      coveredCount += 1;
      if (!Array.isArray(feature.coverage) || !feature.coverage.length) {
        fail(`Covered feature ${feature.id} must point to at least one regression test.`);
      }
    } else {
      gapCount += 1;
      if (!Array.isArray(feature.manualChecks) || !feature.manualChecks.length) {
        fail(`Gap feature ${feature.id} must document manual checks.`);
      }
      if (!Array.isArray(feature.recommendedTests) || !feature.recommendedTests.length) {
        fail(`Gap feature ${feature.id} must document recommended tests.`);
      }
    }

    for (const coverage of feature.coverage || []) {
      const testFile = normalizeRel(coverage.testFile || "");
      if (!testFile) fail(`Feature ${feature.id} has coverage without a testFile.`);
      const absoluteTestFile = path.join(root, testFile);
      if (!fs.existsSync(absoluteTestFile)) fail(`Feature ${feature.id} references missing test file ${testFile}`);
      referencedTestFiles.add(testFile);
      const availableNames = extractTestNames(absoluteTestFile);
      if (!Array.isArray(coverage.tests) || !coverage.tests.length) {
        fail(`Feature ${feature.id} coverage for ${testFile} must name at least one test.`);
      }
      for (const testName of coverage.tests) {
        if (!availableNames.has(testName)) {
          fail(`Feature ${feature.id} references missing test "${testName}" in ${testFile}`);
        }
      }
    }
  }

  for (const testFile of allTestFiles) {
    if (!referencedTestFiles.has(testFile)) {
      fail(`Test file ${testFile} is not mapped to any feature. Add it to docs/webapp-feature-coverage.json.`);
    }
  }

  if (!mapText.includes("node .agents/scripts/run-full-regression.js")) {
    fail("Human function map must document the full regression command.");
  }
  if (coveredCount < 10) fail("Expected at least 10 covered feature areas.");

  console.log(`Feature coverage map OK: ${coveredCount} covered, ${gapCount} documented gaps, ${allTestFiles.length} test files mapped.`);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
