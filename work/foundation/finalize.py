from pathlib import Path
import json
import zipfile

from archive_workspace import archive_workspace
root = archive_workspace() / 'outputs'
package = root / 'psych-simulator-foundation'
url = 'https://example.invalid/archived-demo'
(package / 'Private Rehearsal Link.txt').write_text(
    'PRIVATE REHEARSAL\n' + url + '\n\n'
    'Published 2026-10-05. Access is private to the owner. This link is not public reviewer access. '
    'Give your reviewer the handbook and review form, or review the rehearsal together. '
    'All responses are scripted; live AI and clinical review are pending.\n', encoding='utf-8')
readme = package / 'README.txt'
original = readme.read_text(encoding='utf-8')
original = original.replace('or use the private hosted prototype link when available.', 'or use the published private rehearsal:\n' + url + '\nOwner access only; the downloadable reviewer materials can be used separately.')
readme.write_text(original, encoding='utf-8')
browser = {
    'date': '2026-10-05',
    'environment': 'Codex in-app browser, local rehearsal build',
    'checks_passed': [
        'Opening, sleep and daily-function topics produced the authored replies.',
        'Empty assessment rationale was rejected.',
        'Assessment rationale and explanation acknowledgement produced GAD-7 15/21 and the seven item responses.',
        'Completed reasoning produced the debrief with 3/15 topic coverage, exact conversation evidence and NR ratings.',
        'Session-end state disabled further interview and assessment actions.',
        'Report download exists and its content matches the tested session.',
        'Reload cleared the session to zero exchanges.',
        'WebMCP accepted an authored fact ID and rejected an invalid ID.',
        'Full-page desktop screenshot inspected; no clipped content or overlapping panels observed.'
    ],
    'not_verified': [
        'Reset confirmation dialog could not be completed by browser automation; reload reset was verified.',
        'Mobile viewport and assistive-technology testing not performed.',
        'No live AI provider calls, generative clinical scoring or human usability study performed.'
    ],
    'deployment': {
        'status': 'succeeded',
        'url': url,
        'audience': 'owner-private',
        'commit': 'fe48c25dd0ed9d9b167d954d8c49b6f740d3d14f'
    }
}
(package / 'data/browser-validation.json').write_text(json.dumps(browser, indent=2) + '\n', encoding='utf-8')
target = root / 'Psych Simulator Foundation.zip'
files = sorted(p for p in package.rglob('*') if p.is_file() and not any(part in {'.git', 'node_modules', '.sites-runtime', '__pycache__'} for part in p.relative_to(package).parts))
assert not any(p.name.startswith('.env') for p in files)
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for item in files:
        archive.write(item, 'psych-simulator-foundation/' + item.relative_to(package).as_posix())
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
print(json.dumps({'archive': str(target), 'files': len(files), 'bytes': target.stat().st_size, 'integrity': 'passed'}))
