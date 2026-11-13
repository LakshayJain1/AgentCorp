'use client'

import { FolderOpen, FolderPlus, X } from 'lucide-react'
import { useDesktopWorkspace } from '@/hooks/useDesktopWorkspace'

function folderName(p: string) {
  const parts = p.split(/[\/]+/).filter(Boolean)
  return parts[parts.length - 1] || p
}

/** Desktop app only: pick the local project folder agents can work in. */
export default function WorkspaceFolderButton() {
  const { isDesktop, root, busy, error, choose, clear } = useDesktopWorkspace()
  if (!isDesktop) return null

  return (
    <div className="flex items-center">
      <button
        onClick={choose}
        disabled={busy}
        title={error ? `Error: ${error}` : root ? `Agents can read and write in:\n${root}\n\nClick to change` : 'Choose the project folder your agents can read and write'}
        className={`flex items-center gap-1.5 pl-2.5 py-1.5 text-xs font-semibold rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${
          root ? 'pr-2.5 text-navy/70 border-navy/10 bg-white/[0.06] hover:bg-white/10' : 'pr-3 text-amber-400 border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/15'
        } ${root ? 'rounded-r-none' : ''}`}
      >
        {root ? <FolderOpen className="w-3.5 h-3.5" /> : <FolderPlus className="w-3.5 h-3.5" />}
        <span className="hidden lg:inline max-w-[140px] truncate">{root ? folderName(root) : 'Choose project folder'}</span>
      </button>
      {root && (
        <button
          onClick={clear}
          title="Stop agents from accessing this folder"
          aria-label="Disconnect project folder"
          className="px-1.5 py-1.5 rounded-r-full border border-l-0 border-navy/10 bg-white/[0.06] text-navy/40 hover:text-rose-400 hover:bg-white/10 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
