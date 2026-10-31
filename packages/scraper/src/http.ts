import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { REQUEST_DELAY_MS, USER_AGENT } from './config';

export interface ClientOptions {
  delayMs?: number;
  /** Direktorij za keširanje sirovog HTML-a (samo za razvoj; nema isteka). */
  cacheDir?: string | null;
  retries?: number;
  log?: (msg: string) => void;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** HTTP klijent s razmakom između zahtjeva, ponavljanjem i opcionalnim diskovnim kešom. */
export class Client {
  private readonly delayMs: number;
  private readonly cacheDir: string | null;
  private readonly retries: number;
  private readonly log: (msg: string) => void;
  private lastRequestAt = 0;
  requests = 0;

  constructor(opts: ClientOptions = {}) {
    this.delayMs = opts.delayMs ?? REQUEST_DELAY_MS;
    this.cacheDir = opts.cacheDir ?? null;
    this.retries = opts.retries ?? 3;
    this.log = opts.log ?? (() => {});
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
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' } });
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        if (!res.ok) throw new NonRetryableError(`HTTP ${res.status} for ${url}`);
        const html = await res.text();
        await this.writeCache(url, html);
        return html;
      } catch (err) {
        if (err instanceof NonRetryableError) throw err;
        lastError = err;
        this.log(`  attempt ${attempt} failed: ${String(err)}`);
        await sleep(1000 * attempt);
      }
    }
    throw new Error(`Failed to fetch ${url}: ${String(lastError)}`);
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

class NonRetryableError extends Error {}
