'use client';

import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import LeftSidebar from '@/components/LeftSidebar';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import CredentialDialog from '@/components/CredentialDialog';
import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Users, MessageSquare, BarChart2 } from 'lucide-react';

export default function WorkspacePage() {
  const router = useRouter();
  const isInitialized = useGameStore((s) => s.isInitialized);
  const showAgentRoster = useGameStore((s) => s.showAgentRoster);
  const [mobilePanel, setMobilePanel] = useState<'agents' | 'chat' | 'stats'>('chat');
  // Track whether Zustand's persist middleware has finished reading from localStorage.
  // Without this, isInitialized is briefly false on every reload and triggers /onboard.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // onFinishHydration fires once the persisted state is merged in.
    const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    // If hydration already finished before this effect runs, mark immediately.
    if (useGameStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (hydrated && !isInitialized) {
      router.replace('/onboard');
    }
  }, [hydrated, isInitialized, router]);

  // Render nothing until hydration is confirmed to avoid flash redirect.
  if (!hydrated || !isInitialized) {
    return null;
  }

  return (
    <div className="h-screen w-screen flex flex-col ws-bg overflow-hidden">
      <TopBar />

      <div className="flex-1 overflow-hidden min-h-0 relative">
        {/* Desktop layout — original 3-column flex row, untouched */}
        <div className="hidden lg:flex h-full w-full">
          {showAgentRoster && <LeftSidebar />}
          <CenterPanel />
          <RightPanel />
        </div>

        {/* Mobile / tablet — one full-screen panel at a time */}
        <div className="lg:hidden h-full w-full flex">
          {mobilePanel === 'agents' && <LeftSidebar />}
          {mobilePanel === 'chat' && <CenterPanel />}
          {mobilePanel === 'stats' && <RightPanel />}
        </div>
      </div>

      {/* Mobile / tablet bottom navigation — hidden on lg+ */}
      <nav className="lg:hidden shrink-0 flex border-t border-navy/10 bg-white/90 backdrop-blur-md">
        <button
          onClick={() => setMobilePanel('agents')}
          className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${mobilePanel === 'agents' ? 'text-[#0A84FF]' : 'text-navy/40'}`}
        >
          <Users className="w-5 h-5" />
          Agents
        </button>
        <button
          onClick={() => setMobilePanel('chat')}
          className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${mobilePanel === 'chat' ? 'text-[#0A84FF]' : 'text-navy/40'}`}
        >
          <MessageSquare className="w-5 h-5" />
          Chat
        </button>
        <button
          onClick={() => setMobilePanel('stats')}
          className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${mobilePanel === 'stats' ? 'text-[#0A84FF]' : 'text-navy/40'}`}
        >
          <BarChart2 className="w-5 h-5" />
          Stats
        </button>
      </nav>

      <CredentialDialog />
    </div>
  );
}
