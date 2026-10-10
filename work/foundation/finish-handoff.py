from pathlib import Path
import json
import zipfile

from archive_workspace import archive_workspace
root = archive_workspace()
package = root / 'outputs/psych-simulator-foundation'
handoff = root / 'outputs/Codex Handoff - Psychological Interview Simulator.txt'
text = handoff.read_text(encoding='utf-8')
checklist = (package / 'Checklist Status.txt').read_text(encoding='utf-8').strip()
sources = json.loads((package / 'data/sources.json').read_text(encoding='utf-8'))
registry = '\n\n'.join('\n'.join([
    f"{s['id']} | {s['title']}",
    f"Publisher: {s['publisher']}",
    f"Version/date: {s['version']}",
    f"URL: {s['url']}",
    f"Use: {s['use']}",
    f"Rights: {s['rights']}"
]) for s in sources)
assert text.count('[[CHECKLIST_SNAPSHOT]]') == 1
assert text.count('[[SOURCE_REGISTER]]') == 1
text = text.replace('[[CHECKLIST_SNAPSHOT]]', checklist).replace('[[SOURCE_REGISTER]]', registry)
handoff.write_text(text, encoding='utf-8')
status = json.loads((package / 'data/checklist-status.json').read_text(encoding='utf-8'))
assert len(status['items']) == 71
assert len(sources) == 11
assert all(f"{i['id']} [{i['status']}] {i['task']}" in text for i in status['items'])
assert all(s['url'] in text for s in sources)
assert '[[' not in text
case = json.loads((package / 'data/case-a01.json').read_text(encoding='utf-8'))
bundle = json.loads((package / 'prototype/dist/data.json').read_text(encoding='utf-8'))
assert bundle['case'] == case
with zipfile.ZipFile(root / 'outputs/Psych Simulator Foundation.zip') as archive:
    assert archive.testzip() is None
    archive_count = len(archive.infolist())
print(json.dumps({'handoff': str(handoff), 'words': len(text.split()), 'bytes': handoff.stat().st_size,
                  'checklist_items_included': len(status['items']), 'sources_included': len(sources),
                  'original_zip_files': archive_count, 'case_and_browser_bundle_match': True,
                  'unresolved_markers': False}))
