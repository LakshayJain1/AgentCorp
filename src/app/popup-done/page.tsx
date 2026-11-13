'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

// Landing page for the sign-in popup (returnTo=/popup-done). It tells the
// onboarding tab that login finished, then closes itself. BroadcastChannel is
// used instead of window.opener because browsers can sever the opener link
// while the popup is on a cross-origin login page.
export default function PopupDonePage() {
  const [stillOpen, setStillOpen] = useState(false)

  useEffect(() => {
    try {
      const bc = new BroadcastChannel('agentcorp-auth')
      bc.postMessage({ type: 'complete' })
      bc.close()
    } catch {
      // BroadcastChannel unsupported: the opener's popup-closed poll still refreshes the session.
    }

    const closeTimer = setTimeout(() => window.close(), 200)
    // Not a script-opened popup (or the browser refused to close it): carry on in this tab.
    const fallbackTimer = setTimeout(() => setStillOpen(true), 900)
    return () => {
      clearTimeout(closeTimer)
      clearTimeout(fallbackTimer)
    }
  }, [])

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6 font-sans">
      <div className="text-center space-y-4 max-w-sm">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
        <h1 className="text-xl font-bold text-navy">You&apos;re signed in</h1>
        <p className="text-sm text-navy/60">
          {stillOpen ? 'You can close this window and return to AgentCorp.' : 'Returning you to AgentCorp…'}
        </p>
        {stillOpen && (
          <a href="/workspace" className="btn-primary text-sm inline-flex">
            Continue to AgentCorp
          </a>
        )}
      </div>
    </div>
  )
}
