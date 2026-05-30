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
  code: 'var(--color-amber)',
  doc: 'var(--color-blue)',
  report: '#a29bfe',
  spec: '#4ecdc4',
  config: '#f472b6',
  analysis: 'var(--color-red)',
  design: '#6366f1',
  research: '#22c55e',
};

export default function ProjectsFolder() {
  const projects = useGameStore((s) => s.deliverableProjects);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="font-mono text-xs text-text">
      {/* Folder Header Accordion */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full mb-3 cursor-pointer py-1 hover:bg-text/5 px-1 rounded transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">📁</span>
          <h3 className="text-text font-bold uppercase tracking-wider text-glow">DELIVERABLES_ARCHIVE</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-subtle text-[10px]">{projects.length} files</span>
          <span className="text-subtle text-[9px]">{isOpen ? '▼' : '▶'}</span>
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
              <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                <span className="text-3xl text-glow animate-pulse mb-2.5">📦</span>
                <span className="text-text font-bold uppercase tracking-wider mb-1 text-glow">ARCHIVE_EMPTY</span>
                <span className="text-subtle text-[10px] mb-3">No finished deliverables archived yet...</span>
                <div className="w-full max-w-[120px] space-y-2 animate-pulse">
                  <div className="h-1 bg-muted rounded pulse-skeleton w-3/4 mx-auto" />
                </div>
              </div>
            )}

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {projects.map((project) => {
                const icon = TYPE_ICONS[project.type] || '📦';
                const color = TYPE_COLORS[project.type] || 'var(--text)';
                return (
                  <div key={project.id} className="border border-border/20 rounded bg-card/40 p-1">
                    <button
                      onClick={() =>
                        setSelectedProject(
                          selectedProject === project.id ? null : project.id,
                        )
                      }
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:bg-text/5 text-left transition-colors cursor-pointer rounded"
                      style={{
                        borderLeft:
                          selectedProject === project.id
                            ? `3px solid ${color}`
                            : '3px solid transparent',
                      }}
                    >
                      <span className="text-sm shrink-0">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-text font-bold text-[11px] truncate text-glow">
                          [FILE] {project.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-[9px] font-bold uppercase"
                            style={{ color }}
                          >
                            {project.type}
                          </span>
                          {project.lang && (
                            <span className="text-subtle text-[9px]">
                              ext: {project.lang}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-subtle text-[9px] shrink-0">
                        {new Date(project.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </button>

                    <AnimatePresence>
                      {selectedProject === project.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mb-1 px-1.5"
                        >
                          <pre className="text-text/90 text-[10px] whitespace-pre-wrap bg-[#050805] p-2.5 rounded-lg mt-2 max-h-[220px] overflow-y-auto border border-border/40 font-mono leading-normal shadow-inner">
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
