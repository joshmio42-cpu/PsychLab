import {readFileSync} from 'node:fs';

// Fixtures start the real app explicitly after their simulated page is ready.
// Event handlers may follow startup, so do not assume it is the last line.
const source=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
const startup=/^init\(\);[\t ]*\r?$/gm;
if([...source.matchAll(startup)].length!==1)throw new Error('Expected one standalone app startup call');
export const appSource=source.replace(startup,'');
