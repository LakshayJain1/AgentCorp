'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Users, Shield, Zap, Sparkles, Coffee,
  UserCheck, AlertTriangle, Play, RefreshCw,
  TrendingUp, Heart, Award
} from 'lucide-react';

interface AgentNode {
  id: string;
  name: string;
  role: string;
  color: string;
  bgLight: string;
  borderClass: string;
  icon: React.ReactNode;
  x: number;
  y: number;
}

export default function AgentEcosystemIllustration() {
  const [currentStep, setCurrentStep] = useState<
    'idle' | 'assigning' | 'decomposing' | 'executing' | 'fatigue' | 'cooldown' | 'transfer' | 'testing' | 'deployed'
  >('idle');
  const [logs, setLogs] = useState<string[]>([
    'System Initialized. Awaiting objective...'
  ]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Agent Dynamic Metrics
  const [agentMetrics, setAgentMetrics] = useState<Record<string, { energy: number; morale: number; status: string }>>({
    ceo: { energy: 95, morale: 90, status: 'Reviewing Pipeline' },
    pm: { energy: 90, morale: 88, status: 'Coordinating Teams' },
    dev: { energy: 85, morale: 82, status: 'Coding Landing Page' },
    qa: { energy: 92, morale: 85, status: 'Idle - Waiting' },
    hr: { energy: 96, morale: 94, status: 'Monitoring Morale' },
  });

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 7)]);
  };

  const agents: AgentNode[] = [
    {
      id: 'ceo',
      name: 'Alex (CEO)',
      role: 'Chief Executive',
      color: '#FF453A',
      bgLight: 'bg-red-50/80',
      borderClass: 'border-red-200 hover:border-red-400',
      icon: <Award className="w-5 h-5 text-red-500" />,
      x: 50,
      y: 15,
    },
    {
      id: 'pm',
      name: 'Sam (PM)',
      role: 'Product Manager',
      color: '#06B6D4',
      bgLight: 'bg-cyan-50/80',
      borderClass: 'border-teal/30 hover:border-teal/60',
      icon: <Users className="w-5 h-5 text-teal" />,
      x: 18,
      y: 50,
    },
    {
      id: 'dev',
      name: currentStep === 'transfer' || currentStep === 'testing' || currentStep === 'deployed' ? 'Mike-2 (Dev)' : 'Mike (Dev)',
      role: 'Software Engineer',
      color: '#FF9F0A',
      bgLight: 'bg-amber-50/80',
      borderClass: 'border-amber-200 hover:border-amber-400',
      icon: <Cpu className="w-5 h-5 text-amber-500" />,
      x: 50,
      y: 85,
    },
    {
      id: 'qa',
      name: 'Tina (QA)',
      role: 'Quality Assurance',
      color: '#BF5AF2',
      bgLight: 'bg-violet-50/80',
      borderClass: 'border-violet-200 hover:border-violet-400',
      icon: <Shield className="w-5 h-5 text-violet-500" />,
      x: 82,
      y: 50,
    },
    {
      id: 'hr',
      name: 'Riley (HR)',
      role: 'People Operations',
      color: '#EC4899',
      bgLight: 'bg-rose-50/80',
      borderClass: 'border-rose-200 hover:border-rose-400',
      icon: <Heart className="w-5 h-5 text-rose-500" />,
      x: 50,
      y: 50,
    },
  ];

  // Simulation step transitions
  useEffect(() => {
    if (currentStep === 'idle') return;

    let timer: NodeJS.Timeout;
    switch (currentStep) {
      case 'assigning':
        addLog('CEO proposed goal: "Redesign AgentCorp UI using nature-tech aesthetic."');
        setAgentMetrics((m) => ({
          ...m,
          ceo: { ...m.ceo, status: 'Prioritizing goals', morale: 92 },
          pm: { ...m.pm, status: 'Receiving task brief', morale: 90 }
        }));
        timer = setTimeout(() => setCurrentStep('decomposing'), 3000);
        break;

      case 'decomposing':
        addLog('PM decomposing backlog: Splitting work into React UI layout & animations.');
        setAgentMetrics((m) => ({
          ...m,
          pm: { ...m.pm, status: 'Creating subtask schedule' },
          dev: { ...m.dev, status: 'Assigned "Scaffold Layout"' }
        }));
        timer = setTimeout(() => setCurrentStep('executing'), 3000);
        break;

      case 'executing':
        addLog('Developer Agent executing code changes. Writing component modules...');
        setAgentMetrics((m) => ({
          ...m,
          dev: { energy: 55, morale: 75, status: 'Writing code & styling pages' }
        }));
        timer = setTimeout(() => setCurrentStep('fatigue'), 3000);
        break;

      case 'fatigue':
        addLog('⚠️ HR Alert: Developer fatigue detected. Energy below threshold (30%). Morale critical.');
        setAgentMetrics((m) => ({
          ...m,
          dev: { energy: 28, morale: 40, status: 'Fatigued / Morale Warning' },
          hr: { ...m.hr, status: 'Triggering break cooldown' }
        }));
        timer = setTimeout(() => setCurrentStep('cooldown'), 3000);
        break;

      case 'cooldown':
        addLog('💤 Dev Mike entering Cooldown at Gaming / Coffee. Morale recovering.');
        addLog('⚡ HR spawning replacement agent Mike-2 to maintain operations.');
        setAgentMetrics((m) => ({
          ...m,
          dev: { energy: 40, morale: 65, status: 'On Cooldown (Gaming)' },
          hr: { ...m.hr, status: 'Spawning replacement Dev-2' }
        }));
        timer = setTimeout(() => setCurrentStep('transfer'), 3000);
        break;

      case 'transfer':
        addLog('🔄 Initiating knowledge transfer from Mike (Dev-1) to Mike-2 (Dev-2)...');
        addLog('✅ Knowledge base imported. Dev-2 taking over current workstation.');
        setAgentMetrics((m) => ({
          ...m,
          dev: { energy: 100, morale: 95, status: 'Task inherited. Resuming code' }
        }));
        timer = setTimeout(() => setCurrentStep('testing'), 3500);
        break;

      case 'testing':
        addLog('🧪 QA Agent running validation script (`npm run build` and UI visual tests).');
        setAgentMetrics((m) => ({
          ...m,
          qa: { energy: 80, morale: 88, status: 'Running tsc & eslint checks' }
        }));
        timer = setTimeout(() => setCurrentStep('deployed'), 3000);
        break;

      case 'deployed':
        addLog('🎉 Compilation successful. Site deployed to Vercel production! Success rate: 100%.');
        setAgentMetrics((m) => ({
          ceo: { energy: 98, morale: 98, status: 'Goal Complete!' },
          pm: { energy: 95, morale: 96, status: 'Sprint Complete!' },
          dev: { energy: 90, morale: 95, status: 'Goal Met' },
          qa: { energy: 90, morale: 92, status: 'All Tests Green' },
          hr: { energy: 98, morale: 98, status: 'Morale Stable' },
        }));
        timer = setTimeout(() => setCurrentStep('idle'), 4000);
        break;
    }

    return () => clearTimeout(timer);
  }, [currentStep]);

  const startSimulation = () => {
    setCurrentStep('assigning');
  };

  const handleAgentClick = (id: string) => {
    setSelectedAgentId(selectedAgentId === id ? null : id);
  };

  return (
    <div className="w-full flex flex-col bg-white rounded-3xl border border-ocean-100/80 p-5 shadow-inner">
      {/* Simulation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/5 pb-4 mb-4">
        <div>
          <h3 className="font-sans font-bold text-navy text-sm flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-ocean-600" />
            Ecosystem Simulator
          </h3>
          <p className="text-navy/40 text-xs mt-0.5">Visualize autonomous multi-agent task flows & lifecycle rules</p>
        </div>
        <div className="flex items-center gap-2">
          {currentStep === 'idle' ? (
            <button
              onClick={startSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ocean-600 hover:bg-ocean-700 text-white rounded-full text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Demo
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs text-navy/55 font-mono capitalize">Phase: {currentStep}</span>
              <button
                onClick={() => {
                  setCurrentStep('idle');
                  addLog('Simulation reset.');
                }}
                className="p-1 hover:bg-[rgba(23,23,31,0.05)] rounded-full transition-colors cursor-pointer text-navy/40"
                title="Reset simulation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative w-full aspect-[4/3] max-h-[350px] bg-slate-50/50 rounded-2xl overflow-hidden border border-navy/5 flex items-center justify-center p-4">
        {/* Sky Background landscape grid */}
        <div className="absolute inset-0 bg-gradient-to-b from-ocean-50/40 to-white/70 opacity-80" />

        {/* Pulse connecting lines using SVGs */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          {/* Paths connecting nodes */}
          {/* CEO to PM */}
          <path d="M 50% 18% L 18% 50%" stroke="#e2e8f0" strokeWidth="2" fill="none" />
          {/* CEO to HR */}
          <path d="M 50% 18% L 50% 50%" stroke="#e2e8f0" strokeWidth="2" fill="none" />
          {/* PM to Dev */}
          <path d="M 18% 50% L 50% 82%" stroke="#e2e8f0" strokeWidth="2" fill="none" />
          {/* Dev to QA */}
          <path d="M 50% 82% L 82% 50%" stroke="#e2e8f0" strokeWidth="2" fill="none" />
          {/* QA to CEO */}
          <path d="M 82% 50% L 50% 18%" stroke="#e2e8f0" strokeWidth="2" fill="none" />
          {/* HR to Dev */}
          <path d="M 50% 50% L 50% 82%" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 4" fill="none" />

          {/* Glowing Animated Pulses based on steps */}
          {currentStep === 'assigning' && (
            <motion.path
              d="M 50% 18% L 18% 50%"
              stroke="#0A84FF"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="6 6"
              className="animate-data-flow"
            />
          )}
          {currentStep === 'decomposing' && (
            <motion.path
              d="M 18% 50% L 50% 82%"
              stroke="#0A84FF"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="6 6"
              className="animate-data-flow"
            />
          )}
          {currentStep === 'fatigue' && (
            <motion.path
              d="M 50% 82% L 50% 50%"
              stroke="#FF453A"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="6 6"
              className="animate-data-flow"
            />
          )}
          {currentStep === 'cooldown' && (
            <motion.path
              d="M 50% 50% L 50% 82%"
              stroke="#34C759"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="6 6"
              className="animate-data-flow"
            />
          )}
          {currentStep === 'transfer' && (
            <motion.circle
              cx="50%"
              cy="82%"
              r="24"
              stroke="#FF9F0A"
              strokeWidth="2"
              fill="none"
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          )}
          {currentStep === 'testing' && (
            <motion.path
              d="M 50% 82% L 82% 50%"
              stroke="#BF5AF2"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="6 6"
              className="animate-data-flow"
            />
          )}
          {currentStep === 'deployed' && (
            <motion.path
              d="M 82% 50% L 50% 18%"
              stroke="#34C759"
              strokeWidth="3"
              fill="none"
              strokeDasharray="6 6"
              className="animate-data-flow"
            />
          )}
        </svg>

        {/* Coffee/Gaming Cooldown Zone Illustration */}
        <AnimatePresence>
          {currentStep === 'cooldown' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute left-8 bottom-8 p-2 rounded-xl bg-amber-50 border border-amber-200/60 shadow-sm flex items-center gap-2 z-10 animate-float"
            >
              <div className="p-1.5 bg-amber-500 rounded-lg text-white">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-amber-800">Coffee Oasis</div>
                <div className="text-[9px] text-amber-600 font-semibold">Mike (Dev-1) cooling down</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nodes list */}
        {agents.map((agent) => {
          const metrics = agentMetrics[agent.id] || { energy: 100, morale: 100, status: 'Idle' };
          const isSelected = selectedAgentId === agent.id;
          const isTired = metrics.energy < 40;
          const isOnCooldown = currentStep === 'cooldown' && agent.id === 'dev';

          return (
            <motion.div
              key={agent.id}
              onClick={() => handleAgentClick(agent.id)}
              className="absolute group cursor-pointer select-none"
              style={{ left: `${agent.x}%`, top: `${agent.y}%`, transform: 'translate(-50%, -50%)' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Pulse background on active node */}
              {((currentStep === 'assigning' && (agent.id === 'ceo' || agent.id === 'pm')) ||
                (currentStep === 'decomposing' && agent.id === 'pm') ||
                (currentStep === 'executing' && agent.id === 'dev') ||
                (currentStep === 'fatigue' && (agent.id === 'dev' || agent.id === 'hr')) ||
                (currentStep === 'cooldown' && (agent.id === 'hr' || agent.id === 'dev')) ||
                (currentStep === 'transfer' && agent.id === 'dev') ||
                (currentStep === 'testing' && agent.id === 'qa')) && (
                  <span className="absolute -inset-2.5 rounded-2xl bg-ocean-500/10 blur-md animate-pulse" />
                )}

              {/* Node content box */}
              <div className={`flex flex-col items-center p-2 rounded-2xl glass-panel border ${agent.borderClass} ${agent.bgLight} transition-all duration-300 w-24 relative ${isSelected ? 'ring-2 ring-offset-2 ring-ocean-500 shadow-md' : 'shadow-sm'}`}>
                {/* Micro energy pill indicator */}
                <div className="absolute top-1 right-2 flex items-center gap-0.5">
                  <div className="h-1.5 w-6 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${metrics.energy > 60 ? 'bg-emerald-400' : metrics.energy > 30 ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'}`}
                      style={{ width: `${metrics.energy}%` }}
                    />
                  </div>
                </div>

                {/* Main Icon */}
                <div className={`p-1.5 bg-white rounded-xl shadow-inner border border-navy/5 ${isOnCooldown ? 'animate-bounce' : ''}`}>
                  {isOnCooldown ? <Coffee className="w-5 h-5 text-amber-500" /> : agent.icon}
                </div>

                {/* Labels */}
                <span className="text-[10px] font-bold text-navy mt-1 truncate max-w-full">{agent.name}</span>
                <span className="text-[8px] text-navy/40 font-semibold tracking-wide uppercase mt-0.5">{agent.role.split(' ')[0]}</span>

                {/* Cooldown progress indicator label */}
                {isOnCooldown && (
                  <span className="absolute -bottom-5 bg-amber-500 text-white font-mono text-[8px] px-1 py-0.5 rounded shadow">
                    Resting...
                  </span>
                )}
                {isTired && !isOnCooldown && agent.id === 'dev' && (
                  <span className="absolute -bottom-5 bg-rose-500 text-white font-mono text-[8px] px-1 py-0.5 rounded shadow flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> Tired
                  </span>
                )}
              </div>

              {/* Interactive Hover Card Overlay */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute left-1/2 -translate-x-1/2 -top-24 bg-navy-900 text-white p-2.5 rounded-xl text-[10px] w-36 shadow-lg z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{agent.name}</span>
                      <span className="text-[8px] bg-white/20 px-1 py-0.2 rounded font-normal uppercase tracking-wider">{agent.id}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-navy/25">
                      <span>Morale Morale:</span>
                      <span className="font-mono text-emerald-400">{metrics.morale}%</span>
                    </div>
                    <div className="flex items-center justify-between text-navy/25">
                      <span>Energy Levels:</span>
                      <span className="font-mono text-ocean-400">{Math.round(metrics.energy)}%</span>
                    </div>
                    <div className="mt-1.5 border-t border-white/10 pt-1 text-[9px] text-navy/40 font-semibold italic truncate">
                      "{metrics.status}"
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Terminal Live Feed logs */}
      <div className="mt-4 bg-navy-900 border border-white/10 rounded-2xl p-3 flex flex-col font-mono">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-white/40 text-[10px] font-bold uppercase ml-2">Console Stream</span>
          </div>
          <span className="text-white/25 text-[9px]">Rate: 100fps</span>
        </div>
        <div className="space-y-1 h-[120px] overflow-y-auto pr-1">
          {logs.map((log, index) => (
            <div key={index} className={`text-[10px] leading-relaxed ${log.includes('⚠️') ? 'text-amber-400' : log.includes('🎉') || log.includes('✅') ? 'text-emerald-400' : 'text-white/70'}`}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
