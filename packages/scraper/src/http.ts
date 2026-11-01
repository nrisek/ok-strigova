import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { REQUEST_DELAY_MS, USER_AGENT } from './config';

export interface ClientOptions {
  delayMs?: number;
  /** Direktorij za keširanje sirovog HTML-a (samo za razvoj; nema isteka). */
  cacheDir?: string | null;
  /** Broj pokušaja po zahtjevu prije odustajanja. */
  retries?: number;
  /** Najdulje čekanje na odgovor jednog zahtjeva. */
  timeoutMs?: number;
  log?: (msg: string) => void;
  /** Zamjena za globalni fetch (testovi). */
  fetchImpl?: typeof fetch;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class FetchError extends Error {
  constructor(
    public readonly url: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(`${message} (${url})`);
    this.name = 'FetchError';
  }
}

/**
 * HTTP klijent s razmakom između zahtjeva, ponavljanjem uz rastući razmak, timeoutom
 * i opcionalnim diskovnim kešom. Stranice saveza povremeno ne odgovore ili prekinu
 * vezu, pa je ponavljanje nužno.
 */
export class Client {
  private readonly delayMs: number;
  private readonly cacheDir: string | null;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly log: (msg: string) => void;
  private readonly fetchImpl: typeof fetch;
  private lastRequestAt = 0;
  requests = 0;

  constructor(opts: ClientOptions = {}) {
    this.delayMs = opts.delayMs ?? REQUEST_DELAY_MS;
    this.cacheDir = opts.cacheDir ?? null;
    this.retries = opts.retries ?? 5;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.log = opts.log ?? (() => {});
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async get(url: string): Promise<string> {
    const cached = await this.readCache(url);
    if (cached !== null) return cached;

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      await this.throttle();
      try {
        this.requests++;
        this.log(`GET ${url}`);
        const res = await this.fetchImpl(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
        if (!res.ok) throw new FetchError(url, `HTTP ${res.status}`, false);
        const html = await res.text();
        await this.writeCache(url, html);
        return html;
      } catch (err) {
        if (err instanceof FetchError && !err.retryable) throw err;
        lastError = err;
        this.log(`  pokušaj ${attempt}/${this.retries} nije uspio: ${describe(err)}`);
        if (attempt < this.retries) await sleep(2000 * attempt);
      }
    }
    throw new FetchError(url, `nije uspjelo nakon ${this.retries} pokušaja: ${describe(lastError)}`, true);
  }

  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + this.delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }

  private cachePath(url: string): string | null {
    if (!this.cacheDir) return null;
    return join(this.cacheDir, `${createHash('sha1').update(url).digest('hex')}.html`);
  }

  private async readCache(url: string): Promise<string | null> {
    const path = this.cachePath(url);
    if (!path) return null;
    try {
      return await readFile(path, 'utf8');
    } catch {
      return null;
    }
  }

  private async writeCache(url: string, html: string): Promise<void> {
    const path = this.cachePath(url);
    if (!path) return;
    await mkdir(this.cacheDir!, { recursive: true });
    await writeFile(path, html, 'utf8');
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    return cause instanceof Error ? `${err.message} (${cause.message})` : err.message;
  }
  return String(err);
}
