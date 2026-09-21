'use client';

import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import LeftSidebar from '@/components/LeftSidebar';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import TaskProgressTracker from '@/components/TaskProgressTracker';
import CredentialDialog from '@/components/CredentialDialog';
import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

export default function WorkspacePage() {
  const router = useRouter();
  const isInitialized = useGameStore((s) => s.isInitialized);

  useEffect(() => {
    if (!isInitialized) {
      router.replace('/onboard');
    }
  }, [isInitialized, router]);

  if (!isInitialized) {
    return null;
  }

  return (
    <div className="h-screen w-screen flex flex-col ws-bg overflow-hidden">
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar />
        <CenterPanel />
        <RightPanel />
      </div>

      <TaskProgressTracker />
      <CredentialDialog />
    </div>
  );
}
