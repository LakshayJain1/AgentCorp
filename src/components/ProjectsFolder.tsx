'use client';

import { useGameStore } from '@/store/gameStore';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TYPE_ICONS: Record<string, string> = {
  code: '💻',
  doc: '📄',
  report: '📊',
  spec: '📋',
  config: '⚙️',
  analysis: '🔍',
  design: '🎨',
  research: '🔬',
};

const TYPE_COLORS: Record<string, string> = {
  code: '#f9ca24',
  doc: '#45b7d1',
  report: '#a29bfe',
  spec: '#4ecdc4',
  config: '#f472b6',
  analysis: '#ff6b6b',
  design: '#6366f1',
  research: '#22c55e',
};

export default function ProjectsFolder() {
  const projects = useGameStore((s) => s.deliverableProjects);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selected = projects.find((p) => p.id === selectedProject);

  return (
    <div className="bg-panel rounded-xl border border-border/50 p-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full mb-2.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">📁</span>
          <h3 className="text-subtle text-sm font-semibold">Projects</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted text-xs">{projects.length} deliverables</span>
          <span className="text-muted text-xs">{isOpen ? '▼' : '▶'}</span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {projects.length === 0 && (
              <div className="text-muted text-xs text-center py-3">
                No completed projects yet. Tasks will appear here when finished.
              </div>
            )}

            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {projects.map((project) => {
                const icon = TYPE_ICONS[project.type] || '📦';
                const color = TYPE_COLORS[project.type] || '#888';
                return (
                  <div key={project.id}>
                    <button
                      onClick={() =>
                        setSelectedProject(
                          selectedProject === project.id ? null : project.id,
                        )
                      }
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface/50 text-left transition-colors"
                      style={{
                        backgroundColor:
                          selectedProject === project.id ? `${color}15` : 'transparent',
                        borderLeft:
                          selectedProject === project.id
                            ? `2px solid ${color}`
                            : '2px solid transparent',
                      }}
                    >
                      <span className="text-sm">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-xs font-medium truncate">
                          {project.title}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[10px] font-medium uppercase"
                            style={{ color }}
                          >
                            {project.type}
                          </span>
                          {project.lang && (
                            <span className="text-muted text-[10px]">
                              {project.lang}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-muted text-[10px] shrink-0">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </button>

                    <AnimatePresence>
                      {selectedProject === project.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden ml-6 mb-1"
                        >
                          <pre className="text-muted text-[10px] whitespace-pre-wrap bg-[#0a0a12] p-2 rounded-lg mt-1 max-h-[200px] overflow-y-auto border border-border/20 font-mono leading-relaxed">
                            {project.content.slice(0, 1500)}
                            {project.content.length > 1500 ? '\n...(truncated)' : ''}
                          </pre>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
