# -*- coding: utf-8 -*-
"""Refresh the existing patch archive, including the visual plan editor files."""
from pathlib import Path
import zipfile

root=Path(__file__).resolve().parents[2]
archive=root/'training-enhancements-update.zip'
with zipfile.ZipFile(archive) as old:
    names=old.namelist()
names += [
    'plan-editor-ui.js','plan-editor.css','docs/plan-editor-validation.md',
    'docs/plan-editor-regression.json','.agents/tests/plan-editor.test.js',
    '.agents/tests/daily-log-v2-action-library.test.js',
    '.agents/scripts/verify-plan-editor-browser.js',
    '.agents/scripts/compare-plan-editor-regression.js',
    '.agents/scripts/build-training-update.py',
    '.agents/fixtures/plan-import-files.json',
    'docs/screenshots/plan-editor-mobile.png','docs/screenshots/plan-editor-desktop.png'
]
names=list(dict.fromkeys(names))
for name in names:
    candidate=(root/name).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise RuntimeError(f'Invalid archive source: {name}')
temporary=root/'.scratch/plan-editor-update.zip'
with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED) as output:
    for name in names:output.write(root/name,name)
with zipfile.ZipFile(temporary) as output:
    assert output.testzip() is None
temporary.replace(archive)
print(f'{archive.name}: {len(names)} files, {archive.stat().st_size} bytes')
