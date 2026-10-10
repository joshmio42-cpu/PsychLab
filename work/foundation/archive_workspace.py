"""Require a separate scratch workspace before running historical generators."""
import os
from pathlib import Path


def archive_workspace():
    configured = os.environ.get('PSYCHLAB_ARCHIVE_OUTPUT')
    if not configured:
        raise SystemExit('Historical generator: set PSYCHLAB_ARCHIVE_OUTPUT to a separate scratch workspace. See docs/ARCHIVE_NOTES.md.')
    target = Path(configured).expanduser().resolve()
    repository = Path(__file__).resolve().parents[2]
    if target == repository or repository in target.parents or target in repository.parents:
        raise SystemExit('The archival output must be outside this repository and cannot be one of its parent directories.')
    target.mkdir(parents=True, exist_ok=True)
    return target
