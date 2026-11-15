import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { getUserId } from '@/lib/session';
import { isPublicAddress, htmlToText } from '@/lib/ssrf';

/**
 * Read-only page fetcher for the web-tier agent loop.
 *
 * A server that fetches arbitrary URLs is an SSRF primitive, so every hop is
 * validated: http(s) on 80/443 only, no credentials in the URL, and the
 * *resolved address* is checked at connect time (not before, which DNS
 * rebinding would defeat) against loopback / private / link-local / CGNAT /
 * multicast / reserved ranges. Redirects are followed manually and re-checked.
 * Responses are size- and time-capped and only text-like types are returned.
 */

export const runtime = 'nodejs';

const MAX_BYTES = 300_000;
const MAX_CHARS = 12_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const RATE_LIMIT = 30; // requests per minute per user (best effort, per instance)

const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_LIMIT;
}

/** dns.lookup replacement that refuses to hand back a non-public address. */
function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  cb: (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void,
): void {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => !isPublicAddress(a.address))) {
      const e: NodeJS.ErrnoException = new Error('blocked: address is not public');
      e.code = 'EBLOCKED';
      return cb(e);
    }
    if (options.all) return cb(null, addrs);
    return cb(null, addrs[0].address, addrs[0].family);
  });
}

function validateTarget(raw: string): URL | string {
  let u: URL;
  try { u = new URL(raw); } catch { return 'invalid url'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'only http(s) urls are allowed';
  if (u.username || u.password) return 'urls with credentials are not allowed';
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');
  if (port !== '80' && port !== '443') return 'only ports 80 and 443 are allowed';
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return 'blocked host';
  const bare = host.replace(/^\[|\]$/g, '');
  if (net.isIP(bare) && !isPublicAddress(bare)) return 'blocked address';
  return u;
}

interface Fetched { status: number; contentType: string; body: string; location?: string }

function fetchOnce(u: URL): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname.replace(/^\[|\]$/g, ''),
        port: u.port || undefined,
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        lookup: safeLookup as unknown as net.LookupFunction,
        headers: { 'User-Agent': 'AgentCorp-Agent/1.0', Accept: 'text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.1' },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (c: Buffer) => {
          total += c.length;
          if (total > MAX_BYTES) { res.destroy(); return; }
          chunks.push(c);
        });
        const done = () => resolve({
          status: res.statusCode ?? 0,
          contentType: String(res.headers['content-type'] ?? ''),
          body: Buffer.concat(chunks).toString('utf-8'),
          location: typeof res.headers.location === 'string' ? res.headers.location : undefined,
        });
        res.on('end', done);
        res.on('close', done); // size cap destroys the stream
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (rateLimited(userId)) return NextResponse.json({ success: false, error: 'rate limited' }, { status: 429 });

  let url = '';
  try {
    const body = (await req.json()) as { url?: unknown };
    url = typeof body.url === 'string' ? body.url.trim() : '';
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }
  if (!url || url.length > 2000) return NextResponse.json({ success: false, error: 'url required' }, { status: 400 });

  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const target = validateTarget(current);
      if (typeof target === 'string') return NextResponse.json({ success: false, error: target }, { status: 400 });
      const r = await fetchOnce(target);
      if (r.status >= 300 && r.status < 400 && r.location) {
        current = new URL(r.location, target).toString();
        continue;
      }
      const type = r.contentType.toLowerCase();
      const textLike = /^(text\/|application\/(json|xml|xhtml\+xml|rss\+xml|atom\+xml))/.test(type) || type === '';
      if (!textLike) return NextResponse.json({ success: false, error: `unsupported content type: ${type.slice(0, 60)}` }, { status: 415 });
      const text = (type.includes('html') || /^\s*<(!doctype|html)/i.test(r.body) ? htmlToText(r.body) : r.body).slice(0, MAX_CHARS);
      return NextResponse.json({ success: r.status >= 200 && r.status < 400, url: current, status: r.status, contentType: type, text });
    }
    return NextResponse.json({ success: false, error: 'too many redirects' }, { status: 502 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg.includes('blocked') ? 'blocked: address is not public' : `fetch failed: ${msg.slice(0, 120)}` }, { status: 502 });
  }
}
