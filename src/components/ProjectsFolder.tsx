'use client';

import { useGameStore } from '@/store/gameStore';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TYPE_ICONS: Record<string, string> = {
  code: '💻', doc: '📄', report: '📊', spec: '📋', config: '⚙️', analysis: '🔍', design: '🎨', research: '🔬',
};
const TYPE_COLORS: Record<string, string> = {
  code: '#FF9F0A', doc: '#0A84FF', report: '#BF5AF2', spec: '#34C759', config: '#FF375F', analysis: '#FF453A', design: '#5E5CE6', research: '#34C759',
};

export default function ProjectsFolder() {
  const projects = useGameStore((s) => s.deliverableProjects);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full mb-2.5 cursor-pointer py-1 rounded-lg hover:bg-[rgba(0,0,0,0.02)] transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm">📁</span>
          <h3 className="text-navy/70 font-semibold text-xs uppercase tracking-wider">Deliverables</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-navy/55 text-[10px]">{projects.length} files</span>
          <span className="text-navy/55 text-[9px]">{isOpen ? '▼' : '▶'}</span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {projects.length === 0 && (
              <div className="text-center py-6">
                <div className="text-2xl mb-2 opacity-30">📂</div>
                <p className="text-xs text-navy/55">No deliverables yet</p>
              </div>
            )}
            <div className="space-y-2 max-h-[300px] overflow-y-auto glass-scrollbar">
              {projects.map((project) => {
                const icon = TYPE_ICONS[project.type] || '📦';
                const color = TYPE_COLORS[project.type] || '#86868B';
                return (
                  <div key={project.id} className="glass-card rounded-xl overflow-hidden">
                    <button
                      onClick={() => setSelectedProject(selectedProject === project.id ? null : project.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer"
                      style={{ borderLeft: selectedProject === project.id ? `3px solid ${color}` : '3px solid transparent' }}
                    >
                      <span className="text-sm shrink-0">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-navy font-bold text-xs truncate">{project.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-semibold uppercase" style={{ color }}>{project.type}</span>
                          {project.lang && <span className="text-navy/55 text-[9px]">ext: {project.lang}</span>}
                        </div>
                      </div>
                      <span className="text-navy/55 text-[9px] shrink-0">{new Date(project.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </button>
                    <AnimatePresence>
                      {selectedProject === project.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-3 pb-3">
                          <pre className="text-navy/80 text-xs whitespace-pre-wrap bg-white/70/80 p-3 rounded-xl max-h-[220px] overflow-y-auto glass-scrollbar font-mono leading-relaxed">
                            {project.content.slice(0, 1500)}{project.content.length > 1500 ? '\n...(truncated)' : ''}
                          </pre>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => navigator.clipboard.writeText(project.content)} className="text-xs px-3 py-1.5 glass-card text-ocean-600 rounded-lg hover:bg-ocean-50 transition-colors cursor-pointer">Copy</button>
                            <button onClick={() => { const blob = new Blob([project.content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${project.title.replace(/\s+/g, '_')}.${project.lang || 'txt'}`; a.click(); URL.revokeObjectURL(url); }} className="text-xs px-3 py-1.5 glass-card text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer">Download</button>
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
