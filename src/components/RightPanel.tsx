'use client';

import { motion } from 'framer-motion';
import EventLog from './EventLog';
import AgentInspector from './AgentInspector';
import CompanyMetrics from './CompanyMetrics';
import TaskQueue from './TaskQueue';
import ActivityFeed from './ActivityFeed';
import ExecutionLogViewer from './ExecutionLogViewer';
import ConversationPanel from './ConversationPanel';
import ProjectsFolder from './ProjectsFolder';

export default function RightPanel() {
  return (
    <div className="w-[420px] shrink-0 h-full overflow-y-auto bg-panel border-l border-border/60 p-3 space-y-3">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
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

        {/* Execution Log */}
        <ExecutionLogViewer />

        {/* Task Queue */}
        <TaskQueue />

        {/* Agent List */}
        <AgentInspector />

        {/* Event Log */}
        <div className="h-[250px]">
          <EventLog />
        </div>
      </motion.div>
    </div>
  );
}
