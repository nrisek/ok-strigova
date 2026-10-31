import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrape } from './scrape';

const here = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const getArg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return [...args].find((a) => a.startsWith(prefix))?.slice(prefix.length);
};

const out = resolve(getArg('out') ?? resolve(here, '../../../data/snapshot.json'));
const useCache = args.has('--cache');

const snapshot = await scrape({
  cacheDir: useCache ? resolve(here, '../.cache') : null,
  matchDetails: !args.has('--no-details'),
  delayMs: getArg('delay') ? Number(getArg('delay')) : undefined,
  log: (m) => console.error(m),
});

await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.error(
  `zapisano ${out}: ${snapshot.competitions.length} natjecanja, ${snapshot.teams.length} ekipa, ${snapshot.matches.length} utakmica`,
);
