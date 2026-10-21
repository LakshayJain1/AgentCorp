'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { getDesktopAuthPayload } from './_actions'
import { Cpu, Loader2, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

const SPRING = { type: 'spring', bounce: 0, duration: 0.55 } as const

export default function DesktopRedirectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-ocean-600 animate-spin" />
      </div>
    }>
      <DesktopRedirectInner />
    </Suspense>
  )
}

function DesktopRedirectInner() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'sent' | 'error'>('loading')
  const [deepLinkUrl, setDeepLinkUrl] = useState('')
  const [method, setMethod] = useState<'local' | 'deeplink' | null>(null)
  const searchParams = useSearchParams()
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    const port = searchParams.get('port')
    const state = searchParams.get('state')

    getDesktopAuthPayload().then(async (payload) => {
      if (!payload) {
        window.location.href = '/onboard'
        return
      }

      setDeepLinkUrl(payload.deepLinkUrl)
      setStatus('ready')

      // ── Primary: POST token to Electron's local HTTP server ──────────
      // This works regardless of OS protocol registration and is instant.
      if (port && state) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: payload.token, userId: payload.userId, state }),
          })
          if (res.ok) {
            setMethod('local')
            setStatus('sent')
            return
          }
        } catch {
          // local server not reachable — fall through to deep link
        }
      }

      // ── Fallback: OS deep link (agentcorp:// protocol) ───────────────
      setMethod('deeplink')
      window.location.href = payload.deepLinkUrl
    }).catch(() => {
      setStatus('error')
    })
  }, [searchParams])

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full text-center space-y-7">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-ocean to-teal flex items-center justify-center mx-auto shadow-[0_16px_40px_rgba(10,132,255,0.35)]">
            <Cpu className="w-8 h-8 text-white" />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.06 }}>
          <h1 className="text-2xl font-bold text-navy tracking-tight mb-2">
            {(status === 'loading' || status === 'ready') && 'Returning to AgentCorp'}
            {status === 'sent' && 'You\'re signed in!'}
            {status === 'error' && 'Something went wrong'}
          </h1>
          <p className="text-sm text-navy/60 leading-relaxed">
            {(status === 'loading' || status === 'ready') && 'Handing your session back to the desktop app…'}
            {status === 'sent' && (method === 'local'
              ? 'Session delivered directly to the app. You can close this tab.'
              : 'Opening the desktop app now.')}
            {status === 'error' && 'Failed to retrieve your session. Please try signing in again.'}
          </p>
        </motion.div>

        {(status === 'loading' || status === 'ready') && (
          <Loader2 className="w-6 h-6 text-ocean-600 animate-spin mx-auto" />
        )}

        {status === 'sent' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.1 }} className="space-y-5">
            <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />

            {method === 'deeplink' && deepLinkUrl && (
              <>
                <p className="text-xs text-navy/40">If the app didn&apos;t open automatically:</p>
                <a href={deepLinkUrl} className="btn-primary text-sm inline-flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open in Desktop App
                </a>
                <details className="text-left">
                  <summary className="text-xs text-navy/40 cursor-pointer">Manual fallback</summary>
                  <code className="block mt-2 text-xs text-navy/60 bg-white/70 border border-navy/5 rounded-xl p-3 break-all font-mono">
                    {deepLinkUrl}
                  </code>
                </details>
              </>
            )}
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING} className="space-y-4">
            <AlertCircle className="w-9 h-9 text-rose-400 mx-auto" />
            <button onClick={() => window.location.reload()} className="btn-ghost text-sm">
              Try Again
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}