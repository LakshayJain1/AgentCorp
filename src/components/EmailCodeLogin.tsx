'use client'

import { useEffect, useRef, useState } from 'react'
import { useSignIn, useSignUp } from '@clerk/nextjs'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'

interface EmailCodeLoginProps {
  /** Called after the code is accepted and the Clerk session is active. */
  onSignedIn: () => void | Promise<void>
}

const RESEND_SECONDS = 30
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/
const GENERIC_ERROR = 'Something went wrong. Please try again.'

type ClerkErr = {
  code?: string
  longMessage?: string
  message?: string
  errors?: Array<{ code?: string; longMessage?: string; message?: string }>
} | null | undefined

/** Clerk wraps API failures as code 'api_response_error'; the useful code is nested in errors[0]. */
function codeOf(err: ClerkErr): string {
  return err?.errors?.[0]?.code ?? err?.code ?? ''
}

/** Turn a Clerk error into a short, user-safe sentence. */
function friendly(err: ClerkErr, fallback = GENERIC_ERROR): string {
  switch (codeOf(err)) {
    case 'form_code_incorrect':
    case 'verification_failed':
      return 'That code is incorrect. Check your email and try again.'
    case 'verification_expired':
      return 'That code has expired. Request a new one.'
    case 'too_many_requests':
    case 'rate_limit_exceeded':
      return 'Too many attempts. Please wait a minute and try again.'
    case 'form_param_format_invalid':
    case 'form_identifier_invalid':
      return 'Enter a valid email address.'
    default:
      return err?.errors?.[0]?.longMessage || err?.longMessage || err?.errors?.[0]?.message || err?.message || fallback
  }
}

/**
 * Inline email-code sign-in powered by Clerk: type your email, get a 6-digit
 * code, enter it. No popup and no redirect. If the address has no account yet,
 * one is created automatically (passwordless sign-up) — the user never has to
 * choose between "sign in" and "sign up".
 */
export default function EmailCodeLogin({ onSignedIn }: EmailCodeLoginProps) {
  const { signIn } = useSignIn()
  const { signUp } = useSignUp()

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [flow, setFlow] = useState<'signin' | 'signup'>('signin')
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

  /** Email a code — signing in if the address has an account, otherwise creating one. */
  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    const address = email.trim().toLowerCase()
    if (busy) return
    if (!EMAIL_RE.test(address)) { setError('Enter a valid email address.'); return }
    setBusy(true)
    setError(null)
    try {
      // 1) Existing account → sign-in with an emailed code.
      const created = await signIn.create({ identifier: address })
      if (!created.error) {
        const sent = await signIn.emailCode.sendCode()
        if (sent.error) { setError(friendly(sent.error, "We couldn't send a code right now. Please try again.")); return }
        setFlow('signin')
      } else if (codeOf(created.error) === 'form_identifier_not_found') {
        // 2) No account yet → passwordless sign-up, verified by the same emailed code.
        const su = await signUp.create({ emailAddress: address })
        if (su.error) { setError(friendly(su.error)); return }
        const sent = await signUp.verifications.sendEmailCode()
        if (sent.error) { setError(friendly(sent.error, "We couldn't send a code right now. Please try again.")); return }
        setFlow('signup')
      } else {
        setError(friendly(created.error))
        return
      }
      setStep('code')
      setCode('')
      setCooldown(RESEND_SECONDS)
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy || code.length !== 6) return
    setBusy(true)
    setError(null)
    try {
      let complete = false
      if (flow === 'signin') {
        const r = await signIn.emailCode.verifyCode({ code })
        if (r.error) { rejectCode(friendly(r.error)); return }
        if (signIn.status === 'complete') {
          const f = await signIn.finalize()
          if (f.error) { rejectCode(friendly(f.error)); return }
          complete = true
        }
      } else {
        const r = await signUp.verifications.verifyEmailCode({ code })
        if (r.error) { rejectCode(friendly(r.error)); return }
        if (signUp.status === 'complete') {
          const f = await signUp.finalize()
          if (f.error) { rejectCode(friendly(f.error)); return }
          complete = true
        }
      }
      if (!complete) {
        setError('We could not finish signing you in. Please request a new code.')
        return
      }
      await onSignedIn()
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setBusy(false)
    }
  }

  function rejectCode(message: string) {
    setError(message)
    setCode('')
    codeRef.current?.focus()
  }

  function backToEmail() {
    setStep('email')
    setError(null)
    setCode('')
    void signIn.reset()
    void signUp.reset()
  }

  const inputClass =
    'w-full px-3.5 py-2.5 bg-white/[0.06] border border-navy/10 rounded-xl text-navy text-sm outline-none focus:border-white/25 transition-all placeholder:text-navy/30'

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
          className="w-full py-3 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-ocean-600 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          {busy ? 'Sending code…' : 'Email me a sign-in code'}
        </button>
        {/* Clerk's bot-protection widget mounts here (required for custom sign-up flows) */}
        <div id="clerk-captcha" />
        {error && <p role="alert" className="text-[11px] text-rose-400">{error}</p>}
      </form>
    )
  }

  return (
    <form onSubmit={verifyCode} className="space-y-2.5">
      <button
        type="button"
        onClick={backToEmail}
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
        className="w-full py-3 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center gap-2 shadow-none hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {busy ? 'Signing you in…' : 'Verify and continue'}
      </button>
      {error && <p role="alert" className="text-[11px] text-rose-400">{error}</p>}
      <button
        type="button"
        onClick={() => sendCode()}
        disabled={busy || cooldown > 0}
        className="text-[11px] text-white hover:text-white font-semibold disabled:text-navy/35 disabled:cursor-default cursor-pointer"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>
    </form>
  )
}
