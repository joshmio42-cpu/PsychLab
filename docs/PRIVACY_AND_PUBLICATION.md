# Privacy and publication preparation

This repository is a separate, sanitized publication copy of PsychLab. The working project and its private credentials were not moved or replaced. No GitHub repository, upload, deployment, invitation or sharing change was created during preparation.

## What is included

The current Node application, historical scripted prototype, personality models, fictional cases, source registries, original research notes, experimental datasets, model evaluations, reviewer materials, tests, safe UI screenshots, and foundation handbook are retained. The historical prototype remains a source dependency of the current application.

Research participants in the bundled case data and transcripts are authored fictional characters. Public researchers' names, paper titles, DOI identifiers and scholarly URLs are retained as attribution. Citations are not claims of endorsement or proof that the simulator has been validated.

## What was removed or sanitized

| Material | Publication treatment |
| --- | --- |
| API secrets, environment configuration and saved Windows credentials | No live credentials copied; blank examples provided |
| Cloudflare Access allowlists, audience, team and tunnel settings | Private configuration excluded; a nonfunctional example retained |
| Account/dashboard screenshots | Excluded |
| Existing Git histories and hosting metadata | Excluded; this copy starts with a fresh local repository |
| Original ZIP and deployment tarball | Excluded because they can contain old private configuration; their source resources are preserved |
| Downloaded Node executable and dependencies | Excluded; version pin, checksum and installer retained |
| Personal workstation paths, private demo links, remote account/job identifiers | Replaced with generic placeholders in historical documents and results |
| Event packet, sponsor benefit codes and private packaging scratch files | Not redistributed |

The machine-readable [publication inventory](publication-inventory.json) records file exclusions and sanitization. The original private marker list is deliberately not included: a public redaction log must not reproduce the values it removes.

The foundation handbook was checked for personal metadata and private links and retained unchanged. Included application screenshots depict fictional content. Old rendered handbook pages are retained as archival design resources.

## Safe setup

Use `.env.example` to make your own ignored `.env.local` at the repository root. Fill in the provider key privately. `npm start` reads the local file; the key stays on the server. `npm run demo` uses a scripted historical demonstration and does not load keys or contact a provider.

The public copy defaults to localhost. Configuring a new public deployment is a separate operator task. Never add an API key to frontend JavaScript, a README, screenshots, an issue, a test fixture, or a commit message.

The app's browser History stores disclosed fictional transcripts and learner notes on that browser origin. It contains no authentication tokens, but typed sensitive information would still be saved. Use fictional content and clear History on shared devices. Server sessions and browser History are separate stores.

## Repeat the publication checks

```sh
npm run check:privacy
node scripts/check-privacy.mjs --all
git status --short
git diff --cached --stat
```

The ordinary check inspects tracked and untracked, non-ignored files. `--all` also checks ignored working files except Git metadata, installed dependencies and downloaded runtimes, so a real local `.env.local` will deliberately fail that stronger export check. Run it before making a folder/ZIP export, and exclude private local configuration from any export.

The checker reports filenames, line numbers and rule names, never matched secret values. It searches recognizable token formats, private keys, personal email domains, workstation paths, personal hosted-site links, signed URLs, selected remote account identifiers and risky file types. It is a heuristic, not a guarantee that every possible credential or personal fact is absent. Images and the PDF require the separate visual/metadata review recorded here.

Ignore rules prevent accidental inclusion; they do not encrypt files and cannot remove a secret already published. This copy imports no previous commit history. No author name or email was inserted into an initial commit because no commit was made.

## Research reproducibility after sanitization

Original case facts, source citations and substantive evaluation outcomes are retained. Some archived result metadata now contains placeholders, and old report hashes describe their original research snapshots. Do not use sanitized historical remote IDs to resume provider jobs. Do not treat archived source hashes as a verified release of this copy. The optional Adaption model/example release remains inactive and would need fresh complete gates before activation.

See [validation](VALIDATION.md), [archival notes](ARCHIVE_NOTES.md), and the [research map](RESEARCH_MAP.md) for the difference between current software tests, saved model experiments, and unvalidated clinical or educational claims.
