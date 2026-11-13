'use client'

import { useCallback, useEffect, useState } from 'react'
import { detectExecutorEnv } from '@/execution/ToolExecutor'

/**
 * Desktop-only: the local folder agents may read/write. The path is chosen
 * through a native dialog in the Electron main process; the page can't pick it.
 */
export function useDesktopWorkspace() {
  const [isDesktop, setIsDesktop] = useState(false)
  const [root, setRoot] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const desktop = detectExecutorEnv() === 'desktop'
    const api = window.electronAPI?.workspace
    // Deferred so state updates happen outside the effect body.
    const t = setTimeout(async () => {
      if (cancelled) return
      setIsDesktop(desktop)
      if (desktop && api) {
        try { if (!cancelled) setRoot(await api.getRoot()) } catch { /* bridge unavailable */ }
      }
    }, 0)
    return () => { cancelled = true; clearTimeout(t) }
  }, [])

  const choose = useCallback(async () => {
    const api = window.electronAPI?.workspace
    if (!api) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.setRoot()
      if (res.ok && res.root) setRoot(res.root)
      else if (res.error && res.error !== 'cancelled') setError(res.error)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const clear = useCallback(async () => {
    try { await window.electronAPI?.workspace?.clearRoot(); setRoot(null) } catch { /* ignore */ }
  }, [])

  return { isDesktop, root, busy, error, choose, clear }
}
