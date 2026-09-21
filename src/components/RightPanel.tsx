'use client';

import CompanyMetrics from './CompanyMetrics';
import TaskQueue from './TaskQueue';
import ActivityFeed from './ActivityFeed';
import ExecutionLogViewer from './ExecutionLogViewer';
import ProjectsFolder from './ProjectsFolder';

export default function RightPanel() {
  return (
    <div className="w-1/4 shrink-0 h-full overflow-y-auto glass-panel p-3 space-y-3 glass-scrollbar">
      <CompanyMetrics />
      <TaskQueue />
      <ActivityFeed />
      <ExecutionLogViewer />
      <ProjectsFolder />
    </div>
  );
}
