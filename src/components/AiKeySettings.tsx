'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import type { AiProviderInfo, AiStatus } from '@/ai/byokTypes';
import { BYOK_ERROR_EVENT, byokSupported, getByokStatus, getLastByokError, notifyByokChanged } from '@/ai/transport';

/**
 * "Use your own AI key" (desktop app only).
 *
 * The key is typed here once and handed straight to the desktop shell, which stores it
 * encrypted on this computer and talks to the provider itself. This page can never read
 * the key back; it only ever sees the last 4 characters.
 */

const FIELD =
  'w-full px-2.5 py-1.5 text-[11px] bg-white/[0.06] border border-navy/10 rounded-lg text-navy placeholder:text-navy/35 outline-none focus:border-sky-500/25 focus:ring-2 focus:ring-sky-500/25 transition-all';
const BTN =
  'px-3 py-1.5 text-[10px] font-medium rounded-full transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export default function AiKeySettings() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState('openrouter');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState<'save' | 'test' | 'clear' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const s = await getByokStatus(true);
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    const ok = byokSupported();
    const t = window.setTimeout(() => {
      setSupported(ok);
      if (ok) void refresh().then((s) => { if (s && !s.configured) setEditing(true); });
      setRuntimeError(getLastByokError());
    }, 0);
    const onErr = (e: Event) => setRuntimeError(String((e as CustomEvent).detail ?? ''));
    window.addEventListener(BYOK_ERROR_EVENT, onErr);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(BYOK_ERROR_EVENT, onErr);
    };
  }, [refresh]);

  // Hidden everywhere except the desktop app (the website never takes a user's key).
  if (!supported || !status) return null;

  const providers = status.providers;
  const current: AiProviderInfo | undefined = providers.find((p) => p.id === provider);
  const active = status.configured ? providers.find((p) => p.id === status.provider) : undefined;

  const pickProvider = (id: string) => {
    setProvider(id);
    setModel('');
    setNotice(null);
  };

  const runTest = async () => {
    const ai = window.electronAPI?.ai;
    if (!ai) return;
    setBusy('test');
    setNotice(null);
    const r = await ai.test();
    setBusy(null);
    if (r.ok) {
      setRuntimeError(null);
      setNotice({ kind: 'ok', text: `Connected. ${r.model ?? 'The model'} answered in ${((r.ms ?? 0) / 1000).toFixed(1)}s.` });
    } else {
      setNotice({ kind: 'error', text: r.error ?? 'The test failed.' });
    }
  };

  const save = async () => {
    const ai = window.electronAPI?.ai;
    if (!ai || !current) return;
    setBusy('save');
    setNotice(null);
    const r = await ai.save({ provider, model: model.trim() || current.defaultModel, baseUrl: provider === 'custom' ? baseUrl : undefined, key });
    if (!r.ok) {
      setBusy(null);
      setNotice({ kind: 'error', text: r.error ?? 'Could not save the key.' });
      return;
    }
    setKey(''); // the page keeps no copy
    setShowKey(false);
    notifyByokChanged();
    await refresh();
    setEditing(false);
    await runTest();
  };

  const clear = async () => {
    const ai = window.electronAPI?.ai;
    if (!ai) return;
    setBusy('clear');
    await ai.clear();
    notifyByokChanged();
    const s = await refresh();
    setBusy(null);
    setRuntimeError(null);
    setNotice({ kind: 'ok', text: 'Key removed from this computer.' });
    if (s && !s.configured) setEditing(true);
  };

  const changeModel = async (next: string) => {
    const ai = window.electronAPI?.ai;
    const m = next.trim();
    if (!ai || !m || m === status.model) return;
    const r = await ai.setModel(m);
    if (r.ok) {
      notifyByokChanged();
      await refresh();
      setNotice({ kind: 'ok', text: `Model set to ${m}.` });
    } else {
      setNotice({ kind: 'error', text: r.error ?? 'Could not change the model.' });
    }
  };

  return (
    <div className="p-4 rounded-xl bg-surface border border-navy/5 soft-shadow text-navy">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
            <KeyRound size={12} /> Your AI key
          </h3>
          <p className="text-[10px] text-navy/40 mt-0.5">
            {status.configured && active
              ? `Using ${active.label} · ${status.model} · key ${status.keyHint}`
              : 'No key yet. AgentCorp falls back to its shared AI, which can be limited or unavailable.'}
          </p>
        </div>
        {status.configured && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 shrink-0">
            <Check size={10} className="text-emerald-400" />
            <span className="text-[9px] font-semibold text-emerald-400 uppercase">Active</span>
          </div>
        )}
      </div>

      <div className="mt-3 p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-start gap-2">
        <ShieldCheck size={12} className="text-sky-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-sky-400 leading-relaxed">
          Your key is stored encrypted on this computer and is sent only to the AI provider you choose. It is never sent to
          AgentCorp&apos;s servers, and this page cannot read it back. Use a key with a spending limit if your provider offers one.
        </p>
      </div>

      {runtimeError && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2">
          <AlertTriangle size={12} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-rose-400 leading-relaxed">Last AI error: {runtimeError}</p>
        </div>
      )}

      {notice && (
        <div className={`mt-3 p-2.5 rounded-lg border flex items-start gap-2 ${notice.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-rose-500/10 border-rose-500/25'}`}>
          {notice.kind === 'ok' ? <Check size={12} className="text-emerald-400 shrink-0 mt-0.5" /> : <AlertTriangle size={12} className="text-rose-400 shrink-0 mt-0.5" />}
          <p className={`text-[10px] leading-relaxed ${notice.kind === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>{notice.text}</p>
        </div>
      )}

      {status.configured && !editing && (
        <div className="mt-3 space-y-2">
          <label className="block text-[10px] text-navy/50">
            Model
            <input
              key={status.model ?? 'model'}
              defaultValue={status.model ?? ''}
              list="byok-models-active"
              onBlur={(e) => void changeModel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className={`${FIELD} mt-1`}
              spellCheck={false}
            />
            <datalist id="byok-models-active">{active?.models.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void runTest()} disabled={busy !== null} className={`${BTN} bg-black text-white hover:bg-[#121212]`}>
              {busy === 'test' ? <span className="inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Testing</span> : 'Test connection'}
            </button>
            <button onClick={() => { setEditing(true); setProvider(status.provider ?? 'openrouter'); setBaseUrl(status.baseUrl ?? ''); setModel(status.model ?? ''); setNotice(null); }} disabled={busy !== null} className={`${BTN} border border-navy/15 text-navy/70 hover:bg-white/[0.06]`}>
              Replace key
            </button>
            <button onClick={() => void clear()} disabled={busy !== null} className={`${BTN} border border-rose-500/30 text-rose-400 hover:bg-rose-500/10`}>
              {busy === 'clear' ? 'Removing…' : 'Remove key'}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          <label className="block text-[10px] text-navy/50">
            Provider
            <select value={provider} onChange={(e) => pickProvider(e.target.value)} className={`${FIELD} mt-1`}>
              {providers.map((p) => (
                <option key={p.id} value={p.id} className="text-black">{p.label}</option>
              ))}
            </select>
          </label>

          {provider === 'custom' && (
            <label className="block text-[10px] text-navy/50">
              Server address
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:11434/v1" className={`${FIELD} mt-1`} spellCheck={false} />
              <span className="block mt-1 text-navy/35">Any OpenAI-compatible server: Ollama, LM Studio, Groq, Together, DeepSeek, or your company gateway.</span>
            </label>
          )}

          <label className="block text-[10px] text-navy/50">
            Model
            <input value={model} onChange={(e) => setModel(e.target.value)} list="byok-models-edit" placeholder={current?.defaultModel || 'model name'} className={`${FIELD} mt-1`} spellCheck={false} />
            <datalist id="byok-models-edit">{current?.models.map((m) => <option key={m} value={m} />)}</datalist>
          </label>

          <label className="block text-[10px] text-navy/50">
            API key{current && !current.needsKey ? ' (optional for local servers)' : ''}
            <div className="relative mt-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={status.configured ? 'Paste the new key' : 'Paste your key'}
                className={`${FIELD} pr-8`}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void save(); }}
              />
              <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy/70 cursor-pointer" aria-label={showKey ? 'Hide key' : 'Show key'}>
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </label>

          {current?.keyUrl && (
            <a href={current.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:underline">
              Get a {current.label} key <ExternalLink size={9} />
            </a>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => void save()} disabled={busy !== null || (!!current?.needsKey && key.trim().length < 8) || (provider === 'custom' && !baseUrl.trim())} className={`${BTN} bg-black text-white hover:bg-[#121212]`}>
              {busy === 'save' || busy === 'test' ? <span className="inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Saving</span> : 'Save and test'}
            </button>
            {status.configured && (
              <button onClick={() => { setEditing(false); setKey(''); setNotice(null); }} disabled={busy !== null} className={`${BTN} border border-navy/15 text-navy/70 hover:bg-white/[0.06]`}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
