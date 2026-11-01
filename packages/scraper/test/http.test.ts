import { describe, expect, it } from 'vitest';
import { Client, FetchError } from '../src/http';

const response = (status: number, body = '<html>ok</html>'): Response =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html' } });

describe('Client', () => {
  it('retries network errors and 5xx, then succeeds', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      calls.push(String(url));
      if (calls.length === 1) throw new TypeError('fetch failed');
      if (calls.length === 2) return response(502);
      return response(200);
    }) as unknown as typeof fetch;
    const client = new Client({ delayMs: 0, retries: 5, backoffMs: 0, fetchImpl });
    // ubrzaj test: bez stvarnog čekanja između pokušaja
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: () => void) => originalSetTimeout(fn, 0)) as unknown as typeof setTimeout;
    try {
      await expect(client.get('https://example.test/a')).resolves.toBe('<html>ok</html>');
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
    expect(calls).toHaveLength(3);
    expect(client.requests).toBe(3);
  });

  it('does not retry a 404', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return response(404);
    }) as unknown as typeof fetch;
    const client = new Client({ delayMs: 0, retries: 5, fetchImpl });
    await expect(client.get('https://example.test/missing')).rejects.toBeInstanceOf(FetchError);
    expect(calls).toBe(1);
  });

  it('gives up after the configured number of attempts', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const client = new Client({ delayMs: 0, retries: 2, backoffMs: 0, fetchImpl });
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: () => void) => originalSetTimeout(fn, 0)) as unknown as typeof setTimeout;
    try {
      await expect(client.get('https://example.test/down')).rejects.toThrow(/nakon 2 pokušaja/u);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
    expect(calls).toBe(2);
  });
});
