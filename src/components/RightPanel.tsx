'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Plug, ListChecks } from 'lucide-react';
import EventLog from './EventLog';
import AgentInspector from './AgentInspector';
import CompanyMetrics from './CompanyMetrics';
import TaskQueue from './TaskQueue';
import ActivityFeed from './ActivityFeed';
import ExecutionLogViewer from './ExecutionLogViewer';
import ConversationPanel from './ConversationPanel';
import ProjectsFolder from './ProjectsFolder';
import ConnectorsTab from './ConnectorsTab';

type PanelTab = 'simulation' | 'connectors' | 'tasks';

const TABS: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
  { id: 'simulation', label: 'Live', icon: <Activity size={13} /> },
  { id: 'tasks', label: 'Tasks', icon: <ListChecks size={13} /> },
  { id: 'connectors', label: 'Connectors', icon: <Plug size={13} /> },
];

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>('simulation');

  return (
    <div className="w-[420px] shrink-0 h-full flex flex-col bg-panel border-l border-border/60">
      {/* Tab Navigation Header */}
      <div className="flex items-center border-b border-border/40 bg-surface/30 px-1 pt-2 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider font-mono
              transition-colors duration-200 rounded-t-lg
              ${activeTab === tab.id
                ? 'text-[#00f5ff] bg-panel border border-border/40 border-b-transparent -mb-px z-10'
                : 'text-muted hover:text-subtle border border-transparent'
              }
            `}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#00f5ff] rounded-full"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence mode="wait">
          {activeTab === 'simulation' && (
            <motion.div
              key="simulation"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {/* Metrics Row */}
              <CompanyMetrics />

              {/* Live Activity Feed */}
              <ActivityFeed />

              {/* Agent Chat */}
              <ConversationPanel />

              {/* Projects Folder */}
              <ProjectsFolder />

              {/* Agent List */}
              <AgentInspector />

              {/* Event Log */}
              <div className="h-[250px]">
                <EventLog />
              </div>
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {/* Task Queue */}
              <TaskQueue />

              {/* Execution Log */}
              <ExecutionLogViewer />
            </motion.div>
          )}

          {activeTab === 'connectors' && (
            <motion.div
              key="connectors"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
            >
              <ConnectorsTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
