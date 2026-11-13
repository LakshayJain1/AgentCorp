'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'

interface EmailCodeLoginProps {
  /** Called after the code is accepted and the session cookie is set. */
  onSignedIn: () => void | Promise<void>
}

const RESEND_SECONDS = 30

/**
 * Inline email-code sign-in: type your email, get a 6-digit code, enter it.
 * No popup and no redirect — the session is created by /api/login/verify.
 * New addresses get an account automatically (passwordless sign-up).
 */
export default function EmailCodeLogin({ onSignedIn }: EmailCodeLoginProps) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  async function post(path: string, payload: Record<string, string>) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    return { ok: res.ok && data.ok === true, error: data.error ?? 'Something went wrong. Please try again.' }
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy || !email.trim()) return
    setBusy(true)
    setError(null)
    const r = await post('/api/login/start', { email: email.trim() })
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    setStep('code')
    setCode('')
    setCooldown(RESEND_SECONDS)
  }

  async function verifyCode(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy || code.length !== 6) return
    setBusy(true)
    setError(null)
    const r = await post('/api/login/verify', { email: email.trim(), code })
    if (!r.ok) {
      setBusy(false)
      setError(r.error)
      setCode('')
      codeRef.current?.focus()
      return
    }
    try { await onSignedIn() } finally { setBusy(false) }
  }

  const inputClass =
    'w-full px-3.5 py-2.5 bg-white/70 border border-navy/10 rounded-xl text-navy text-sm outline-none focus:border-ocean-400/60 transition-all placeholder:text-navy/30'

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} className="space-y-2.5">
        <label className="block text-[10px] font-semibold text-navy/55 uppercase tracking-wider">Email</label>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          required
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="w-full py-3 rounded-xl bg-navy text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-ocean-600 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          {busy ? 'Sending code…' : 'Email me a sign-in code'}
        </button>
        {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
      </form>
    )
  }

  return (
    <form onSubmit={verifyCode} className="space-y-2.5">
      <button
        type="button"
        onClick={() => { setStep('email'); setError(null); setCode('') }}
        className="flex items-center gap-1 text-[11px] text-navy/50 hover:text-navy cursor-pointer"
      >
        <ArrowLeft size={11} /> Use a different email
      </button>
      <p className="text-xs text-navy/60">
        We sent a 6-digit code to <strong className="text-navy">{email.trim().toLowerCase()}</strong>.
      </p>
      <input
        ref={codeRef}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className={`${inputClass} text-center text-lg tracking-[0.5em] font-mono`}
        aria-label="6-digit sign-in code"
      />
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-ocean to-teal text-white text-xs font-bold flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(10,132,255,0.30)] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {busy ? 'Signing you in…' : 'Verify and continue'}
      </button>
      {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={() => sendCode()}
        disabled={busy || cooldown > 0}
        className="text-[11px] text-ocean-600 hover:text-ocean-700 font-semibold disabled:text-navy/35 disabled:cursor-default cursor-pointer"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>
    </form>
  )
}
