'use client'

import { useEffect, useState } from 'react'
import { getDesktopRedirectUrl } from './_actions'
import { Cpu, Loader2, CheckCircle2, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'

const SPRING = { type: 'spring', bounce: 0, duration: 0.55 } as const

export default function DesktopRedirectPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [deepLinkUrl, setDeepLinkUrl] = useState('')

  useEffect(() => {
    getDesktopRedirectUrl().then((url) => {
      if (url === '/onboard') {
        window.location.href = '/onboard'
        return
      }
      setDeepLinkUrl(url)
      setStatus('ready')

      // Auto-redirect after a short delay
      const timer = setTimeout(() => {
        window.location.href = url
      }, 2000)
      return () => clearTimeout(timer)
    }).catch(() => {
      setStatus('error')
    })
  }, [])

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
            {status === 'loading' && 'Preparing Desktop App...'}
            {status === 'ready' && 'Returning to AgentCorp'}
            {status === 'error' && 'Something went wrong'}
          </h1>
          <p className="text-sm text-navy/60 leading-relaxed">
            {status === 'loading' && 'Generating secure session for your desktop app.'}
            {status === 'ready' && 'You\'ll be redirected to the AgentCorp desktop app in a moment.'}
            {status === 'error' && 'Failed to generate redirect URL. Please try again.'}
          </p>
        </motion.div>

        {status === 'loading' && (
          <Loader2 className="w-6 h-6 text-ocean-600 animate-spin mx-auto" />
        )}

        {status === 'ready' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.14 }} className="space-y-5">
            <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />

            <a
              href={deepLinkUrl}
              className="btn-primary text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Desktop App
            </a>

            <p className="text-xs text-navy/40">
              If the app didn&apos;t open, copy this URL:
            </p>
            <code className="block text-xs text-navy/60 bg-white/70 border border-navy/5 rounded-xl p-3.5 break-all font-mono shadow-sm">
              {deepLinkUrl}
            </code>
          </motion.div>
        )}

        {status === 'error' && (
          <button
            onClick={() => window.location.reload()}
            className="btn-ghost text-sm"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}