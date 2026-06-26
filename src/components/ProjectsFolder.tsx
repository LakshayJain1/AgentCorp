'use client';

import { useGameStore } from '@/store/gameStore';
import { useState, useCallback } from 'react';
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
  code: '#F59E0B',
  doc: '#59C7FF',
  report: '#8B7CF6',
  spec: '#6CC04A',
  config: '#EC4899',
  analysis: '#EF4444',
  design: '#7C3AED',
  research: '#6CC04A',
};

export default function ProjectsFolder() {
  const projects = useGameStore((s) => s.deliverableProjects);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="text-sm text-gray-900">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full mb-3 cursor-pointer py-1 px-1 rounded-lg hover:bg-gray-50 transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">📁</span>
          <h3 className="text-gray-900 font-semibold text-xs uppercase tracking-wider">Deliverables</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-[10px]">{projects.length} files</span>
          <span className="text-gray-400 text-[9px]">{isOpen ? '▼' : '▶'}</span>
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
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400/20 to-green-400/20 flex items-center justify-center mb-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <span className="text-sm font-semibold text-gray-400 mb-1">Archive empty</span>
                <span className="text-xs text-gray-300 mb-3">No deliverables yet...</span>
                <div className="w-full max-w-[120px] space-y-2">
                  <div className="h-1.5 bg-gray-100 rounded-full pulse-skeleton w-3/4 mx-auto" />
                </div>
              </div>
            )}

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {projects.map((project) => {
                const icon = TYPE_ICONS[project.type] || '📦';
                const color = TYPE_COLORS[project.type] || '#9CA3AF';
                return (
                  <div key={project.id} className="border border-gray-100 rounded-xl bg-white">
                    <button
                      onClick={() =>
                        setSelectedProject(
                          selectedProject === project.id ? null : project.id,
                        )
                      }
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left transition-colors cursor-pointer rounded-xl"
                      style={{
                        borderLeft: selectedProject === project.id ? `3px solid ${color}` : '3px solid transparent',
                      }}
                    >
                      <span className="text-sm shrink-0">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-gray-900 font-semibold text-xs truncate">
                          {project.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-semibold uppercase" style={{ color }}>
                            {project.type}
                          </span>
                          {project.lang && (
                            <span className="text-gray-400 text-[9px]">
                              ext: {project.lang}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-gray-400 text-[9px] shrink-0">
                        {new Date(project.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </button>

                    <AnimatePresence>
                      {selectedProject === project.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mb-1 px-2"
                        >
                          <pre className="text-gray-700 text-xs whitespace-pre-wrap bg-gray-50 p-3 rounded-xl mt-2 max-h-[220px] overflow-y-auto border border-gray-100 font-mono leading-relaxed">
                            {project.content.slice(0, 1500)}
                            {project.content.length > 1500 ? '\n...(truncated)' : ''}
                          </pre>
                          <div className="flex gap-2 mt-2 mb-1">
                            <button
                              onClick={() => navigator.clipboard.writeText(project.content)}
                              className="text-xs px-3 py-1.5 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-colors cursor-pointer"
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => {
                                const blob = new Blob([project.content], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${project.title.replace(/\s+/g, '_')}.${project.lang || 'txt'}`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                              Download
                            </button>
                          </div>
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
