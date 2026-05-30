'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { GitBranch, Play, Key, Mail, Lock, Sparkles, Server, Check, ArrowRight, ShieldCheck, ChevronRight } from 'lucide-react';

export default function SetupWizard() {
  const { initializePersonalizedOffice } = useGameStore();

  const [step, setStep] = useState<number>(1);

  // Authentication Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Profile Fields
  const [companyName, setCompanyName] = useState('AgentCorp');
  const [companyProduct, setCompanyProduct] = useState('Autonomous Developer OS');
  const [devCount, setDevCount] = useState(1);

  // Connector Fields
  const [ghConnected, setGhConnected] = useState(false);
  const [ghRepo, setGhRepo] = useState('');
  const [ghToken, setGhToken] = useState('');
  const [ghCommit, setGhCommit] = useState(true);

  const [vConnected, setVConnected] = useState(false);
  const [vToken, setVToken] = useState('');
  const [vDeploy, setVDeploy] = useState(true);

  const [sConnected, setSConnected] = useState(false);
  const [sUrl, setSUrl] = useState('');
  const [sBroadcast, setSBroadcast] = useState(true);

  const [aiProvider, setAiProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [aiKey, setAiKey] = useState('');

  // Deploying loading state
  const [deployStatus, setDeployStatus] = useState<string[]>([]);
  const [currentDeployStep, setCurrentDeployStep] = useState<number>(0);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoggingIn(true);
    setTimeout(() => {
      setIsLoggingIn(false);
      setStep(2);
    }, 1200);
  };

  const handleLaunchSequence = () => {
    setStep(4);
    const deployLogs = [
      'Establishing secure local workspace cluster...',
      'Spinning up Phaser 2D visual office floor...',
      'Synthesizing workspace configurations...',
      'Onboarding AI CEO and PM agents...',
      'Personalizing developer, QA, and HR models...',
      'Connecting system APIs (GitHub, Vercel, Slack hooks)...',
      'All departments active. Deploying visual layer...'
    ];

    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < deployLogs.length) {
        setDeployStatus((prev) => [...prev, deployLogs[currentLogIndex]]);
        setCurrentDeployStep(currentLogIndex);
        currentLogIndex++;
      } else {
        clearInterval(interval);
        // Complete launch!
        setTimeout(() => {
          initializePersonalizedOffice(companyName, companyProduct, devCount, {
            github: { connected: ghConnected, repoUrl: ghRepo, token: ghToken, autoCommit: ghCommit },
            vercel: { connected: vConnected, token: vToken, autoDeploy: vDeploy },
            slack: { connected: sConnected, webhookUrl: sUrl, broadcastEvents: sBroadcast },
            ai: { provider: aiProvider, apiKey: aiKey },
          });
        }, 1000);
      }
    }, 900);
  };

  const wizardVariants = {
    enter: { opacity: 0, scale: 0.95 },
    center: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08080c] flex items-center justify-center overflow-hidden font-sans p-4">
      {/* Visual background accents */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-15%] w-[700px] h-[700px] bg-purple-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1a1a2e_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />

      <AnimatePresence mode="wait">
        {/* Step 1: Mock secure developer login */}
        {step === 1 && (
          <motion.div
            key="login"
            variants={wizardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="w-full max-w-md p-6 bg-surface/30 backdrop-blur-xl border border-white/10 rounded-2xl relative shadow-2xl"
          >
            {/* Header info */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-tr from-[#00f5ff] to-purple-500 rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-[#00f5ff]/20 mb-3">
                <ShieldCheck size={24} className="text-white" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-white uppercase font-mono">
                SECURE AUTHENTICATION
              </h2>
              <p className="text-xs text-subtle mt-1">
                Establish a secure administrator connection to Agent Corp
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-subtle uppercase tracking-wider mb-1">EMAIL ADDRESS</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-subtle pointer-events-none">
                    <Mail size={14} />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-black/40 border border-border/30 rounded-xl text-white text-xs outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-subtle uppercase tracking-wider mb-1">SECURE ACCESS KEY</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-subtle pointer-events-none">
                    <Lock size={14} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-black/40 border border-border/30 rounded-xl text-white text-xs outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold text-xs transition-all uppercase font-mono flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
              >
                {isLoggingIn ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Connect <ArrowRight size={14} /></>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* Step 2: Personalized Profile */}
        {step === 2 && (
          <motion.div
            key="profile"
            variants={wizardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="w-full max-w-lg p-6 bg-surface/30 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl space-y-4"
          >
            <div>
              <h2 className="text-base font-black tracking-tight text-white uppercase font-mono flex items-center gap-1.5">
                <Sparkles size={16} className="text-cyan-400" /> PERSONAL SETUP PROFILE
              </h2>
              <p className="text-xs text-subtle mt-0.5">
                Define details of your startup corporation for agent synthesis.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-subtle uppercase tracking-wider mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. AcmeCorp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-border/30 rounded-xl text-white text-xs outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-subtle uppercase tracking-wider mb-1">Product Description / Sector Focus</label>
                <textarea
                  placeholder="e.g. Next-gen billing infrastructure for SaaS startups"
                  value={companyProduct}
                  onChange={(e) => setCompanyProduct(e.target.value)}
                  className="w-full h-16 px-3 py-2 bg-black/40 border border-border/30 rounded-xl text-white text-xs outline-none resize-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-subtle uppercase tracking-wider">Spawns Count (Developer Agents)</label>
                  <span className="text-xs font-mono font-bold text-cyan-400">{devCount} Active Devs</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  value={devCount}
                  onChange={(e) => setDevCount(parseInt(e.target.value))}
                  className="w-full h-1 bg-black/40 border border-border/30 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-colors uppercase font-mono"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-xs transition-colors uppercase font-mono flex items-center justify-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Connectors */}
        {step === 3 && (
          <motion.div
            key="connectors"
            variants={wizardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="w-full max-w-xl p-6 bg-surface/30 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl space-y-4"
          >
            <div>
              <h2 className="text-base font-black tracking-tight text-white uppercase font-mono flex items-center gap-1.5">
                🔌 LINK CONNECTORS (CLAUDE-STYLE)
              </h2>
              <p className="text-xs text-subtle mt-0.5">
                Grant credentials to let your personalized Agents push changes to active platforms.
              </p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {/* GitHub Hook */}
              <div className="p-3 bg-black/30 border border-border/20 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} className="text-white" />
                    <h3 className="text-xs font-bold text-white/95">GitHub Integration</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ghConnected}
                      onChange={(e) => setGhConnected(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-7 h-4 bg-muted/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>
                {ghConnected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2 pt-1.5 border-t border-border/15"
                  >
                    <input
                      type="text"
                      placeholder="Repository URL (e.g. https://github.com/user/repo)"
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-border/30 rounded-lg text-white text-[11px] outline-none"
                    />
                    <input
                      type="password"
                      placeholder="Personal Access Token (ghp_...)"
                      value={ghToken}
                      onChange={(e) => setGhToken(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-border/30 rounded-lg text-white text-[11px] outline-none"
                    />
                  </motion.div>
                )}
              </div>

              {/* Vercel Deploy Hook */}
              <div className="p-3 bg-black/30 border border-border/20 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Play size={12} className="rotate-90 fill-white" />
                    <h3 className="text-xs font-bold text-white/95">Vercel Deployments</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vConnected}
                      onChange={(e) => setVConnected(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-7 h-4 bg-muted/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500"></div>
                  </label>
                </div>
                {vConnected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2 pt-1.5 border-t border-border/15"
                  >
                    <input
                      type="password"
                      placeholder="Vercel API Access Token (ver_...)"
                      value={vToken}
                      onChange={(e) => setVToken(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-border/30 rounded-lg text-white text-[11px] outline-none"
                    />
                  </motion.div>
                )}
              </div>

              {/* Slack Webhook Hook */}
              <div className="p-3 bg-black/30 border border-border/20 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[#e2a8ff]" />
                    <h3 className="text-xs font-bold text-white/95">Slack Notifications</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sConnected}
                      onChange={(e) => setSConnected(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-7 h-4 bg-muted/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
                {sConnected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2 pt-1.5 border-t border-border/15"
                  >
                    <input
                      type="text"
                      placeholder="Incoming Webhook URL (https://hooks.slack.com/...)"
                      value={sUrl}
                      onChange={(e) => setSUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-border/30 rounded-lg text-white text-[11px] outline-none"
                    />
                  </motion.div>
                )}
              </div>

              {/* AI Key Provider Hook */}
              <div className="p-3 bg-black/30 border border-border/20 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Key size={14} className="text-cyan-400" />
                    <h3 className="text-xs font-bold text-white/95">Custom AI API Provider</h3>
                  </div>
                  <span className="text-[10px] text-subtle font-mono uppercase">OPTIONAL</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')}
                    className="w-full px-2.5 py-1.5 bg-black/40 border border-border/30 rounded-lg text-white text-[11px] outline-none col-span-1"
                  >
                    <option value="gemini">Gemini API</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                  <input
                    type="password"
                    placeholder="Enter API Key to override default"
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-black/40 border border-border/30 rounded-lg text-white text-[11px] outline-none col-span-2"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-colors uppercase font-mono"
              >
                Back
              </button>
              <button
                onClick={handleLaunchSequence}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold text-xs transition-all uppercase font-mono flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
              >
                Launch Office Floor <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Loading deployment sequence */}
        {step === 4 && (
          <motion.div
            key="deploying"
            variants={wizardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="w-full max-w-xl p-6 bg-surface/30 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl space-y-6"
          >
            {/* Deploying status */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/30 text-cyan-400">
                <Server size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide">
                  SYNTHESIZING OFFICE INSTANCE
                </h3>
                <p className="text-xs text-[#00f5ff] animate-pulse font-mono uppercase tracking-wider">
                  Running custom compiler scripts...
                </p>
              </div>
            </div>

            {/* Glowing pipeline status */}
            <div className="relative w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-border/20">
              <motion.div
                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-cyan-400"
                initial={{ width: '0%' }}
                animate={{ width: `${(currentDeployStep + 1) * 14.3}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>

            {/* Simulated server logs */}
            <div className="h-[180px] p-3 rounded-lg bg-black/60 border border-border/20 font-mono text-[10px] text-cyan-400 overflow-y-auto space-y-1">
              <AnimatePresence>
                {deployStatus.map((log, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-1.5 text-xs"
                  >
                    <span className="text-[#8b5cf6] font-bold">&gt;</span>
                    <span>{log}</span>
                    {idx === currentDeployStep && (
                      <span className="w-1 h-3.5 bg-cyan-400 inline-block animate-pulse ml-0.5" />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
