# Local Maintenance Scripts

## Generate The Liquid-Glass Functional Copy

`index.html` is the source of truth. After changing shared HTML, CSS, or JavaScript, regenerate the functional copy:

```powershell
node .agents/scripts/generate-liquid-glass-functional.js
```

The test suite runs the same generator in `--check` mode so drift is caught without mutating files:

```powershell
node .agents/scripts/generate-liquid-glass-functional.js --check
```

## Run The Full Regression Gate

Use this after changing `index.html`, training capture, record protocol, plan reconciliation, local persistence, or UI layout:

```powershell
node .agents/scripts/run-full-regression.js
```

The gate validates the web app feature coverage manifest, checks that `index-liquid-glass-functional.html` is still generated from `index.html`, and then runs every `.agents/tests/*.test.js` file.

The feature coverage manifest is `docs/webapp-feature-coverage.json`; the human checklist is `docs/webapp-function-map.md`.
