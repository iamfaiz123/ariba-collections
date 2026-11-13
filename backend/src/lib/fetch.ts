/**
 * fetch with a timeout and retries on network errors / 5xx / 429.
 * Only retry requests that are safe to repeat (GETs, or calls the remote side de-duplicates).
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
  }
}

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T = any>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 10_000, retries = 0, body, headers, ...rest } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(Math.min(4000, 250 * 2 ** attempt) + Math.random() * 200);
    try {
      const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
      const res = await fetch(url, {
        ...rest,
        headers: { ...(body !== undefined && !isForm ? { 'content-type': 'application/json' } : {}), ...(headers as any) },
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      let data: any = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        /* keep raw text */
      }
      if (!res.ok) {
        const err = new HttpError(res.status, data, `${rest.method ?? 'GET'} ${url} → ${res.status}`);
        if (res.status >= 500 || res.status === 429) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      return data as T;
    } catch (err) {
      if (err instanceof HttpError && err.status < 500 && err.status !== 429) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}
