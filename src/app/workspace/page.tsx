'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import LeftSidebar from '@/components/LeftSidebar';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import CredentialDialog from '@/components/CredentialDialog';
import WorkspaceViewer from '@/components/WorkspaceViewer';
import { useEffect, useState, Suspense } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useOrgBroadcast } from '@/hooks/useOrgBroadcast';
import { Users, MessageSquare, BarChart2 } from 'lucide-react';
import { useAuthUser } from '@/hooks/useAuthUser';

function WorkspacePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteOrgId = searchParams.get('invite');

  const isInitialized = useGameStore((s) => s.isInitialized);
  const myOrgId = useGameStore((s) => s.orgId);
  const showAgentRoster = useGameStore((s) => s.showAgentRoster);
  const [mobilePanel, setMobilePanel] = useState<'agents' | 'chat' | 'stats'>('chat');
  const [hydrated, setHydrated] = useState(false);
  const { user, isLoading: authLoading } = useAuthUser();

  // Always broadcast when the workspace is initialized (no-op if not)
  useOrgBroadcast();

  useEffect(() => {
    const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    if (useGameStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  // Signed out → email-code sign-in in onboarding. An invite link keeps its
  // workspace id so we come straight back to the invited workspace afterwards.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(inviteOrgId ? `/onboard?invite=${encodeURIComponent(inviteOrgId)}` : '/onboard');
      return;
    }
    if (inviteOrgId) return; // viewer mode — the server decides whether this user may view it
    if (hydrated && !isInitialized) router.replace('/onboard');
  }, [hydrated, isInitialized, user, authLoading, router, inviteOrgId]);

  if (authLoading) return null;
  if (!user) return null;

  // Viewer mode: someone opened the workspace via an invite link
  if (inviteOrgId && hydrated && inviteOrgId !== myOrgId) {
    return <WorkspaceViewer orgId={inviteOrgId} />;
  }

  if (!hydrated || !isInitialized) return null;

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
      <nav className="lg:hidden shrink-0 flex border-t border-navy/10 bg-surface backdrop-blur-md">
        <button
          onClick={() => setMobilePanel('agents')}
          className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${mobilePanel === 'agents' ? 'text-white' : 'text-navy/40'}`}
        >
          <Users className="w-5 h-5" />
          Agents
        </button>
        <button
          onClick={() => setMobilePanel('chat')}
          className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${mobilePanel === 'chat' ? 'text-white' : 'text-navy/40'}`}
        >
          <MessageSquare className="w-5 h-5" />
          Chat
        </button>
        <button
          onClick={() => setMobilePanel('stats')}
          className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${mobilePanel === 'stats' ? 'text-white' : 'text-navy/40'}`}
        >
          <BarChart2 className="w-5 h-5" />
          Stats
        </button>
      </nav>

      <CredentialDialog />
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspacePageInner />
    </Suspense>
  );
}
