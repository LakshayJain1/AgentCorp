'use client';

import { useGameStore } from '@/store/gameStore';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Database, Users, CheckSquare, FileText,
  ChevronRight, Folder, Copy, Download, Check, X,
  LayoutDashboard, Plug, PackageOpen, CalendarDays
} from 'lucide-react';
import ConnectorsTab from '@/components/ConnectorsTab';
import { centralOrchestrator } from '@/orchestrator/CentralOrchestrator';

export default function RightPanel() {
  const agents = useGameStore((s) => s.agents);
  const tasks = useGameStore((s) => s.tasks);
  const projects = useGameStore((s) => s.deliverableProjects);
  const simulation = useGameStore((s) => s.simulation);
  const setSelectedTask = useGameStore((s) => s.setSelectedTask);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'integrations'>('overview');
  const [sprintLoading, setSprintLoading] = useState(false);

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

  const handleExportAll = () => {
    if (displayDeliverables.length === 0) return;
    const header = `AgentCorp Deliverables Export\nGenerated: ${new Date().toLocaleString()}\nFiles: ${displayDeliverables.length}\n${'='.repeat(60)}\n\n`;
    const body = displayDeliverables.map((f) =>
      `${'='.repeat(60)}\n# ${f.title}\n# Type: ${f.type}${f.lang ? ` | Lang: ${f.lang}` : ''} | ${new Date(f.createdAt).toLocaleDateString()}\n${'='.repeat(60)}\n\n${f.content}\n\n`
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentcorp-deliverables-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSprintPlanning = async () => {
    if (sprintLoading) return;
    setSprintLoading(true);
    try {
      await centralOrchestrator.runSprintPlanning();
    } finally {
      setSprintLoading(false);
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

  const connectors = useGameStore((s) => s.connectors);
  const connectedCount = Object.values(connectors).filter(
    (c) => c && 'connected' in c && (c as { connected: boolean }).connected
  ).length;

  return (
    <div className="w-full lg:w-1/4 shrink-0 h-full min-h-0 flex flex-col glass-panel bg-[#FAFBFD]/30 border-l">

      {/* Tab Bar */}
      <div className="shrink-0 flex items-center gap-1 px-3 pt-3 pb-0 border-b border-navy/6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'text-navy border-b-2 border-ocean-500 bg-white/60'
              : 'text-navy/45 hover:text-navy/70'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg transition-all cursor-pointer ${
            activeTab === 'integrations'
              ? 'text-navy border-b-2 border-ocean-500 bg-white/60'
              : 'text-navy/45 hover:text-navy/70'
          }`}
        >
          <Plug className="w-3.5 h-3.5" />
          Integrations
          {connectedCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-100 text-emerald-600">
              {connectedCount}
            </span>
          )}
        </button>
      </div>

      {/* Integrations tab */}
      {activeTab === 'integrations' && (
        <div className="flex-1 overflow-y-auto p-4 glass-scrollbar">
          <ConnectorsTab />
        </div>
      )}

      {/* Overview tab */}
      {activeTab === 'overview' && (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 glass-scrollbar">

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
          <button
            onClick={handleSprintPlanning}
            disabled={sprintLoading}
            title="PM-driven sprint: auto-generates and kicks off 4 tasks"
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-full bg-ocean/10 text-ocean-600 hover:bg-ocean/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            <CalendarDays className="w-3 h-3" />
            {sprintLoading ? 'Planning…' : 'Plan Sprint'}
          </button>
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
                Execution logs will appear here as agents process tasks.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-1.5 max-h-[200px] overflow-y-auto glass-scrollbar">
              {executionLogs.map((log, idx) => {
                const dot = log.status === 'success' ? 'bg-emerald-400'
                  : log.status === 'error' ? 'bg-rose-400'
                  : 'bg-amber-400 animate-pulse';
                const agent = agents.find((a) => a.id === log.agentId);
                return (
                  <div key={idx} className="flex items-start gap-2 text-[10px] py-1.5 px-2 rounded-xl hover:bg-navy/4 transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {agent && <span className="font-bold text-navy/70">{agent.emoji} {agent.name}</span>}
                        <span className="text-[9px] font-mono text-navy/35 bg-navy/5 px-1 rounded">{log.tool}</span>
                      </div>
                      <p className="text-navy/60 truncate mt-0.5">{log.action}</p>
                      <p className="text-navy/35 text-[9px] truncate">{log.taskTitle}</p>
                    </div>
                    <span className="text-[9px] text-navy/25 shrink-0 mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                );
              })}
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
          <div className="flex items-center gap-2">
            {displayDeliverables.length > 0 && (
              <button
                onClick={handleExportAll}
                title="Download all deliverables as a single text file"
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg bg-navy/5 hover:bg-navy/10 text-navy/60 hover:text-navy transition-colors cursor-pointer"
              >
                <PackageOpen className="w-3 h-3" /> Export All
              </button>
            )}
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

      </div>
      )}

    </div>
  );
}