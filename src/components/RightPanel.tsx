'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Database, Users, CheckSquare, FileText,
  ChevronRight, ChevronDown, Folder, AlertTriangle, Copy, Download, Check, X
} from 'lucide-react';

export default function RightPanel() {
  const agents = useGameStore((s) => s.agents);
  const tasks = useGameStore((s) => s.tasks);
  const projects = useGameStore((s) => s.deliverableProjects);
  const connectors = useGameStore((s) => s.connectors);
  const simulation = useGameStore((s) => s.simulation);
  const setSelectedTask = useGameStore((s) => s.setSelectedTask);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dynamic values
  const onlineAgents = agents.filter((a) => a.online).length;
  const totalAgents = agents.length || 6;
  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const executionLogs = useMemo(() => {
    const logs = tasks.flatMap((t) => t.executionLogs.map((l) => ({ ...l, taskTitle: t.title })));
    return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);
  }, [tasks]);

  // Use real simulation metrics from the store
  const cpuUsage = simulation.cpuUsage;
  const memoryUsage = simulation.memoryUsage;

  // Deliverables mapping - render actual deliverables, no mock fallback
  const displayDeliverables = useMemo(() => {
    return [...projects].sort((a, b) => b.createdAt - a.createdAt);
  }, [projects]);

  const handleCopy = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const handleDownload = (title: string, type: string, lang: string | undefined, content: string) => {
    const ext = lang || (type === 'code' ? 'txt' : 'md');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Deliverable label styles matching image precisely
  const getDeliverableBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'code':
        return (
          <span className="text-[9px] font-bold text-[#FF9F0A] bg-[#FF9F0A]/10 px-1.5 py-0.5 rounded uppercase">
            CODE
          </span>
        );
      case 'spec':
        return (
          <span className="text-[9px] font-bold text-[#A2845E] bg-[#A2845E]/10 px-1.5 py-0.5 rounded uppercase">
            SPEC
          </span>
        );
      case 'report':
        return (
          <span className="text-[9px] font-bold text-[#BF5AF2] bg-[#BF5AF2]/10 px-1.5 py-0.5 rounded uppercase">
            REPORT
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-bold text-navy/40 bg-navy/5 px-1.5 py-0.5 rounded uppercase">
            FILE
          </span>
        );
    }
  };

  // Icon selector based on deliverable type
  const getDeliverableIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'code':
        return '💻';
      case 'spec':
        return '📝';
      case 'report':
        return '📊';
      default:
        return '📄';
    }
  };

  // Connected count of integrations
  const connectedCount = Object.values(connectors).filter((c) => c && 'connected' in c && c.connected).length;

  return (
    <div className="w-1/4 shrink-0 h-full min-h-0 overflow-y-auto glass-panel p-4 space-y-4.5 glass-scrollbar bg-[#FAFBFD]/30 border-l">
      
      {/* 1. Live Activity Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#34C759]"></span>
            </span>
            <h3 className="text-sm font-bold text-navy font-display tracking-tight">Live Activity</h3>
          </div>
          <span className="text-[10px] text-navy/40 font-medium">Waiting for activity...</span>
        </div>

        {/* 4 Stats Cards Grid */}
        <div className="grid grid-cols-4 gap-2">
          {/* CPU Card */}
          <div className="bg-[#EBF2FC]/40 border border-[#EBF2FC] rounded-2xl p-2.5 flex flex-col justify-between min-h-[75px] shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-white rounded-lg w-6 h-6 flex items-center justify-center border border-navy/5">
              <Cpu className="w-3.5 h-3.5 text-navy/60" />
            </div>
            <div className="mt-2">
              <span className="block text-[8px] font-bold text-navy/40 uppercase">CPU</span>
              <span className="text-sm font-black text-navy font-display">{cpuUsage}%</span>
            </div>
          </div>

          {/* Memory Card */}
          <div className="bg-[#EBF2FC]/40 border border-[#EBF2FC] rounded-2xl p-2.5 flex flex-col justify-between min-h-[75px] shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-white rounded-lg w-6 h-6 flex items-center justify-center border border-navy/5">
              <Database className="w-3.5 h-3.5 text-[#0A84FF]" />
            </div>
            <div className="mt-2">
              <span className="block text-[8px] font-bold text-navy/40 uppercase">Memory</span>
              <span className="text-sm font-black text-navy font-display">{memoryUsage} GB</span>
            </div>
          </div>

          {/* Agents Card */}
          <div className="bg-[#EBF2FC]/40 border border-[#EBF2FC] rounded-2xl p-2.5 flex flex-col justify-between min-h-[75px] shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-white rounded-lg w-6 h-6 flex items-center justify-center border border-navy/5">
              <Users className="w-3.5 h-3.5 text-[#BF5AF2]" />
            </div>
            <div className="mt-2">
              <span className="block text-[8px] font-bold text-navy/40 uppercase">Agents</span>
              <span className="text-sm font-black text-navy font-display">{onlineAgents}/{totalAgents}</span>
            </div>
          </div>

          {/* Tasks Card */}
          <div className="bg-[#EBF2FC]/40 border border-[#EBF2FC] rounded-2xl p-2.5 flex flex-col justify-between min-h-[75px] shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-white rounded-lg w-6 h-6 flex items-center justify-center border border-[#34C759]/20">
              <CheckSquare className="w-3.5 h-3.5 text-[#34C759]" />
            </div>
            <div className="mt-2">
              <span className="block text-[8px] font-bold text-navy/40 uppercase">Tasks</span>
              <span className="text-sm font-black text-navy font-display">{completedTasksCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Execution Log Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-lg bg-navy/5 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-navy/60" />
            </span>
            <h3 className="text-sm font-bold text-navy font-display tracking-tight">Execution Log</h3>
          </div>
          <span className="text-[10px] text-navy/40 font-medium">{executionLogs.length} entries</span>
        </div>

        {/* Empty / Logs List State */}
        <div className="bg-[#FAFBFD]/80 border border-navy/5 rounded-2xl p-4 shadow-sm min-h-[140px] flex items-center justify-center">
          {executionLogs.length === 0 ? (
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-full bg-navy/5 flex items-center justify-center mx-auto mb-2">
                <FileText className="w-5 h-5 text-navy/40" />
              </div>
              <p className="text-xs font-bold text-navy/80">No logs yet</p>
              <p className="text-[10px] text-navy/45 mt-1 max-w-[200px] mx-auto leading-normal">
                Execution logs will appear here during agent activity.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-2 max-h-[160px] overflow-y-auto glass-scrollbar">
              {executionLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-navy/80 font-bold truncate">[{log.tool}] {log.action}</p>
                    <p className="text-navy/40 text-[9px]">{log.taskTitle}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Deliverables Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-lg bg-navy/5 flex items-center justify-center">
              <Folder className="w-3.5 h-3.5 text-[#FF9F0A]" />
            </span>
            <h3 className="text-sm font-bold text-navy font-display tracking-tight">Deliverables</h3>
          </div>
          <button
            onClick={() => setListCollapsed((v) => !v)}
            title={listCollapsed ? 'Expand deliverables' : 'Collapse deliverables'}
            className="text-[10px] text-navy/40 hover:text-navy/70 font-semibold flex items-center gap-0.5 cursor-pointer"
          >
            {displayDeliverables.length} files
            <span className={`transition-transform ${listCollapsed ? '' : 'rotate-90'}`}>
              <ChevronRight className="w-3 h-3" />
            </span>
          </button>
        </div>

        {/* Files List */}
        {!listCollapsed && (
        <div className="space-y-2">
          {displayDeliverables.length === 0 ? (
            <div className="bg-[#FAFBFD]/80 border border-navy/5 rounded-2xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-navy/5 flex items-center justify-center mx-auto mb-2">
                <Folder className="w-5 h-5 text-navy/40" />
              </div>
              <p className="text-xs font-bold text-navy/80">No deliverables yet</p>
              <p className="text-[10px] text-navy/45 mt-1 max-w-[200px] mx-auto leading-normal">
                Files generated by agents will appear here.
              </p>
            </div>
          ) : (
            displayDeliverables.map((file) => {
              const isOpen = expandedId === file.id;
              const author = file.completedBy ? agents.find((a) => a.id === file.completedBy) : null;
              const parentTask = tasks.find((t) => t.id === file.taskId);
              return (
              <div
                key={file.id}
                className={`bg-white border rounded-2xl shadow-sm transition-shadow ${isOpen ? 'border-ocean-300 shadow-md' : 'border-navy/5 hover:shadow-md'}`}
              >
                <button
                  onClick={() => setExpandedId(isOpen ? null : file.id)}
                  title={isOpen ? 'Collapse deliverable' : 'Expand to view content'}
                  className="w-full p-3 flex items-center justify-between cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#FAFBFD] border border-navy/5 flex items-center justify-center text-sm shadow-sm shrink-0">
                      {getDeliverableIcon(file.type)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-navy truncate">{file.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {getDeliverableBadge(file.type)}
                        {file.lang && (
                          <span className="text-[10px] text-navy/40 font-medium">ext: {file.lang}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-navy/40 font-semibold uppercase">
                      {new Date(file.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={`p-1 rounded-lg text-navy/35 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-1 border-t border-navy/5">
                        <div className="flex items-center gap-2 text-[10px] text-navy/50 py-2">
                          {author && <span className="font-bold">By {author.emoji} {author.name}</span>}
                          {author && parentTask && <span>·</span>}
                          {parentTask && (
                            <button
                              onClick={() => setSelectedTask(parentTask.id)}
                              className="font-semibold text-ocean-600 hover:underline cursor-pointer truncate"
                              title="Jump to parent task"
                            >
                              Task: {parentTask.title}
                            </button>
                          )}
                          <span className="ml-auto shrink-0">{file.content.length} chars</span>
                        </div>
                        <pre className="text-[11px] leading-relaxed text-navy/80 bg-[#FAFBFD] border border-navy/5 rounded-xl p-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words glass-scrollbar">
                          {file.content || 'No content.'}
                        </pre>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => handleCopy(file.id, file.content)}
                            className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-navy/5 hover:bg-navy/10 text-navy/70 cursor-pointer"
                          >
                            {copiedId === file.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedId === file.id ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            onClick={() => handleDownload(file.title, file.type, file.lang, file.content)}
                            className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-navy/5 hover:bg-navy/10 text-navy/70 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                          <button
                            onClick={() => setExpandedId(null)}
                            className="ml-auto flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-navy/40 hover:text-navy/70 hover:bg-navy/5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> Close
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              );
            })
          )}
        </div>
        )}
      </div>

      {/* 4. Integrations Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-lg bg-navy/5 flex items-center justify-center">
              <CheckSquare className="w-3.5 h-3.5 text-navy/60" />
            </span>
            <h3 className="text-sm font-bold text-navy font-display tracking-tight">Integrations</h3>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
            <span className="text-[8px] font-bold text-[#34C759] uppercase">LIVE</span>
          </div>
          <span className="text-[10px] text-navy/40 font-medium">{connectedCount} of 10 connected</span>
        </div>

        {/* Warning Platform Box */}
        <div className="bg-[#EBF2FC]/50 border border-[#D6E9FF] rounded-2xl p-3.5 shadow-sm hover:bg-[#EBF2FC]/70 transition-colors cursor-pointer flex items-start justify-between gap-3">
          <div className="flex gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-[#0A84FF] shrink-0 mt-0.5" />
            <div className="text-[10px] text-navy/70 leading-normal">
              <strong className="block text-navy font-bold">Setup needed (platform owner):</strong>
              <ul className="list-disc ml-3.5 mt-1 space-y-0.5 font-medium text-navy/65">
                <li>GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY + OAuth client ID/secret</li>
                <li>OPENROUTER_API_KEY and/or GEMINI_API_KEY</li>
                <li>GitHub OAuth for your own repos unlocks more features</li>
              </ul>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#0A84FF]/60 shrink-0 mt-1" />
        </div>
      </div>

    </div>
  );
}