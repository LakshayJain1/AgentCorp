'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Cpu, Monitor, Apple, Laptop, ArrowRight, CheckCircle2, Download } from 'lucide-react'

const SPRING = { type: 'spring', bounce: 0, duration: 0.55 } as const

type Platform = 'mac' | 'win' | 'linux' | 'unknown'

const DOWNLOADS: Record<Platform, { label: string; icon: React.ReactNode; formats: string[]; url: string }> = {
  mac: {
    label: 'macOS',
    icon: <Apple className="w-5 h-5" />,
    formats: ['.dmg', '.zip'],
    url: '#', // Add macOS build URL after building on a Mac
  },
  win: {
    label: 'Windows',
    icon: <Laptop className="w-5 h-5" />,
    formats: ['.exe installer', '.portable'],
    url: '/downloads/AgentCorp-Setup-2.0.0.exe',
  },
  linux: {
    label: 'Linux',
    icon: <Monitor className="w-5 h-5" />,
    formats: ['.AppImage', '.deb'],
    url: '#', // Add Linux build URL after building
  },
  unknown: {
    label: 'Download',
    icon: <Monitor className="w-5 h-5" />,
    formats: [],
    url: '/downloads/AgentCorp-Setup-2.0.0.exe',
  },
}

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown'
  const ua = window.navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'mac'
  if (ua.includes('win')) return 'win'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>('unknown')

  useEffect(() => {
    const detected = detectPlatform()
    const t = setTimeout(() => setPlatform(detected), 0)
    return () => clearTimeout(t)
  }, [])

  const detected = DOWNLOADS[platform]

  return (
    <div className="min-h-screen bg-paper font-sans">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50">
        <nav className="max-w-5xl mx-auto px-6 py-3 mt-3">
          <div className="glass rounded-full px-4 py-2 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 font-display font-bold text-[15px] text-navy">
              <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-ocean to-teal flex items-center justify-center shadow-sm">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              AgentCorp
            </Link>
            <a
              href="/onboard"
              className="text-sm font-semibold text-navy/60 hover:text-navy transition-colors"
            >
              Open in Browser
            </a>
          </div>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-32 md:pt-40 pb-24">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="text-center mb-14"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-ocean to-teal flex items-center justify-center mx-auto shadow-[0_16px_40px_rgba(10,132,255,0.35)] mb-7">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <h1 className="display-hero text-navy">Download AgentCorp</h1>
          <p className="prose-body max-w-md mx-auto mt-5">
            Run your autonomous AI workspace natively on your machine. Same features as the web app, installed locally.
          </p>
        </motion.div>

        {/* Primary download (detected OS) */}
        {platform !== 'unknown' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.08 }}
            className="glass rounded-3xl p-9 mb-10 text-center"
          >
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <span className="text-ocean-600">{detected.icon}</span>
              <span className="text-sm font-semibold text-ocean-700 uppercase tracking-wider">
                Detected: {detected.label}
              </span>
            </div>
            <p className="text-[13px] text-navy/50 mb-7">
              We automatically detected your operating system.
            </p>
            <a
              href={detected.url}
              download
              className="btn-primary text-sm px-8 py-3.5"
            >
              <Download className="w-4 h-4" />
              Download for {detected.label}
              <ArrowRight className="w-4 h-4" />
            </a>
            {platform === 'win' && (
              <div className="mt-5 flex items-center justify-center gap-4">
                <a
                  href="/downloads/AgentCorp-Setup-2.0.0.exe"
                  download
                  className="text-xs text-ocean-600 hover:text-ocean-700 font-medium underline underline-offset-2"
                >
                  Installer (.exe)
                </a>
                <span className="text-navy/20">|</span>
                <a
                  href="/downloads/AgentCorp-2.0.0.exe"
                  download
                  className="text-xs text-ocean-600 hover:text-ocean-700 font-medium underline underline-offset-2"
                >
                  Portable (.exe)
                </a>
              </div>
            )}
            {detected.formats.length > 0 && (
              <p className="text-xs text-navy/40 mt-4">
                Available as {detected.formats.join(' and ')}
              </p>
            )}
          </motion.div>
        )}

        {/* All platforms */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.14 }}
        >
          <h2 className="eyebrow text-center text-navy/40 mb-5">
            All Platforms
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(Object.entries(DOWNLOADS) as [Platform, typeof detected][] )
              .filter(([p]) => p !== 'unknown')
              .map(([p, dl]) => (
                <a
                  key={p}
                  href={dl.url}
                  download
                  className={`group flex flex-col items-center gap-3 p-7 rounded-3xl border transition-all duration-300 ${
                    p === platform
                      ? 'glass border-ocean-300/60 shadow-[var(--shadow-lift)]'
                      : 'bg-white/60 border-navy/5 hover:bg-white hover:shadow-[var(--shadow-soft)]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                    p === platform ? 'bg-ocean-600 text-white shadow-[0_8px_20px_rgba(10,132,255,0.35)]' : 'bg-white text-navy/50 border border-navy/5 group-hover:text-ocean-600'
                  }`}>
                    {dl.icon}
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-navy">{dl.label}</div>
                    {dl.formats.length > 0 && (
                      <div className="text-[10px] text-navy/40 mt-1">{dl.formats.join(', ')}</div>
                    )}
                  </div>
                  {p === platform && (
                    <span className="text-[9px] font-semibold text-white bg-ocean-600 px-2.5 py-0.5 rounded-full uppercase">
                      Detected
                    </span>
                  )}
                </a>
              ))}
          </div>
        </motion.div>

        {/* Features list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.2 }}
          className="mt-16 grid sm:grid-cols-2 gap-4"
        >
          {[
            'Same workspace as the web app',
            'Native window controls & shortcuts',
            'Runs locally — your code stays on your machine',
            'Auto-updates when new versions release',
            'Deep link auth — sign in on web, continue in app',
            'System tray support (coming soon)',
          ].map((feature, i) => (
            <div key={i} className="flex items-start gap-2.5 p-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <span className="text-sm text-navy/70">{feature}</span>
            </div>
          ))}
        </motion.div>

        {/* Help */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.26 }}
          className="mt-14 text-center"
        >
          <p className="text-xs text-navy/40">
            Need help? Check the{' '}
            <a href="#" className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2">
              installation guide
            </a>{' '}
            or{' '}
            <a href="#" className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2">
              contact support
            </a>.
          </p>
        </motion.div>
      </main>
    </div>
  )
}