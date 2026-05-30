'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  GitBranch, Play, Key, Mail, Lock, Sparkles, Server, Check, ArrowRight, 
  ShieldCheck, ChevronRight, CreditCard, Users, 
  CheckCircle2, DollarSign, Layers, Settings, Zap, Terminal, Code2, 
  LineChart, Sparkle, ArrowUpRight, HelpCircle
} from 'lucide-react';

export default function SetupWizard() {
  const { initializePersonalizedOffice } = useGameStore();

  const [step, setStep] = useState<number>(0); // Step 0 is the premium Landing Page

  // Authentication Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Profile Fields
  const [companyName, setCompanyName] = useState('AgentCorp');
  const [companyProduct, setCompanyProduct] = useState('Autonomous Developer OS');
  const [devCount, setDevCount] = useState(1);

  // Payment Fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Connector Fields
  const [ghConnected, setGhConnected] = useState(true);
  const [ghRepo, setGhRepo] = useState('https://github.com/agentcorp/workspace');
  const [ghToken, setGhToken] = useState('ghp_mocktoken1234567890abcdef');
  const [ghCommit, setGhCommit] = useState(true);

  const [vConnected, setVConnected] = useState(true);
  const [vToken, setVToken] = useState('ver_mocktoken1234567890abcdef');
  const [vDeploy, setVDeploy] = useState(true);

  const [sConnected, setSConnected] = useState(false);
  const [sUrl, setSUrl] = useState('');
  const [sBroadcast, setSBroadcast] = useState(true);

  const [aiProvider, setAiProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [aiKey, setAiKey] = useState('');

  // Deploying loading state
  const [deployStatus, setDeployStatus] = useState<string[]>([]);
  const [currentDeployStep, setCurrentDeployStep] = useState<number>(0);

  // Live Terminal Simulation state for Bento Grid
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'Initializing simulation floor...',
    'System tick calibrated to 60Hz.',
    'Waiting for operator onboarding directive...'
  ]);

  // Pricing Calculation
  const isFree = devCount === 1;
  const basePrice = 0;
  const pricePerDev = 10;
  const totalPrice = isFree ? 0 : (devCount - 1) * pricePerDev;

  // Simulate scrolling terminal in Bento Grid
  useEffect(() => {
    if (step !== 0) return;
    const items = [
      'Sam (PM) assigned task: "Refactor API middleware"',
      'Mike (Engineer) spawns at coding desk',
      'Mike (Engineer) scanning packages... 100% OK',
      'Mike (Engineer) coding auth.ts: [||||||||||] 100%',
      'Tina (QA) scans pull request #42',
      'Tina (QA) running compliance test cases... ALL PASSED',
      'Riley (HR) checks company metrics... Morale: 94%',
      'Jill (Researcher) investigating caching strategies...',
      'System: Auto-deploying deliverable to Vercel production...',
      'Vercel: Deployment SUCCESSFUL! Live at https://acme-prod.vercel.app',
      'Alex (CEO) logs: "Sprint #6 complete. Cashflow positive!"'
    ];

    let idx = 0;
    const timer = setInterval(() => {
      setTerminalLogs((prev) => {
        const next = [...prev, items[idx]];
        if (next.length > 5) next.shift();
        return next;
      });
      idx = (idx + 1) % items.length;
    }, 2500);

    return () => clearInterval(timer);
  }, [step]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setTimeout(() => {
      setIsLoggingIn(false);
      setStep(2); // Go to Profile
    }, 1500);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPaying(true);
    setTimeout(() => {
      setIsPaying(false);
      setPaymentSuccess(true);
      setTimeout(() => {
        setStep(4); // Go to Connectors
      }, 1000);
    }, 2000);
  };

  const handleLaunchSequence = () => {
    setStep(5); // Go to loading deployment screen
    const deployLogs = [
      'Establishing secure local workspace cluster...',
      'Spinning up Phaser 2D visual office floor...',
      'Synthesizing workspace configurations...',
      'Onboarding AI CEO and PM agents...',
      `Spawning ${devCount} developer agents to floor desks...`,
      'Connecting system APIs (GitHub, Vercel, Slack hooks)...',
      'Running Clerk secure proxy middleware test... OK',
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
    enter: { opacity: 0, y: 15 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#080b08] text-white overflow-y-auto overflow-x-hidden font-sans select-none">
      {/* Background glow effects - Sleek Cyberpunk/Glassmorphic accents */}
      <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-15%] w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(0,255,136,0.06)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Floating Header Navbar */}
      <div className="fixed top-0 left-0 right-0 h-16 border-b border-white/5 bg-[#080b08]/80 backdrop-blur-md flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-[#00ff88] to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-[#00ff88]/20">
            <Sparkle size={16} className="text-[#080b08] stroke-[3]" />
          </div>
          <span className="font-mono text-sm font-black tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-[#00ff88]">
            AgentCorp
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-white/50">
          <span className="hover:text-[#00ff88] cursor-pointer transition-colors">Docs</span>
          <span className="hover:text-[#00ff88] cursor-pointer transition-colors">Pricing</span>
          <span className="hover:text-[#00ff88] cursor-pointer transition-colors">Status</span>
          {step === 0 && (
            <button 
              onClick={() => setStep(1)} 
              className="px-3.5 py-1.5 rounded-lg border border-[#00ff88]/30 bg-[#00ff88]/10 hover:bg-[#00ff88]/20 text-[#00ff88] font-bold transition-all cursor-pointer shadow-sm shadow-[#00ff88]/10"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pt-24 pb-12 relative z-10 flex items-center justify-center min-h-screen">
        <AnimatePresence mode="wait">
          {/* STEP 0: JAW-DROPPING BENTO GRID LANDING PAGE */}
          {step === 0 && (
            <motion.div
              key="landing"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4 }}
              className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* HERO CARD & CALL TO ACTION (Main Left block) */}
              <div className="lg:col-span-2 flex flex-col justify-between p-8 bg-white/3 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden group">
                <div className="absolute -right-24 -top-24 w-64 h-64 bg-[#00ff88]/10 rounded-full blur-[80px] group-hover:bg-[#00ff88]/15 transition-colors duration-500" />
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20 text-[#00ff88] text-[10px] uppercase font-mono tracking-widest font-bold">
                    <Sparkles size={10} /> Active Agent Sandbox v2.0.6
                  </div>
                  <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.1] text-white">
                    Build <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00ff88] to-cyan-400">AI teammates</span>,<br />not automations.
                  </h1>
                  <p className="text-sm md:text-base text-white/60 font-normal leading-relaxed max-w-xl">
                    Instantly deploy an autonomous department of AI teammates directly to your project workspace. Watch them coordinate, write, review, and deploy code in real-time.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00ff88] to-cyan-500 hover:from-[#05ff8d] hover:to-cyan-400 text-[#080b08] font-black text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#00ff88]/15 hover:shadow-[#00ff88]/25"
                  >
                    Deploy AI Department <ArrowRight size={14} className="stroke-[3]" />
                  </button>
                  <button 
                    onClick={() => setStep(1)}
                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Configure Sandbox
                  </button>
                </div>
              </div>

              {/* BENTO CARD 2: AI PERSONNEL ROSTER (Right small block) */}
              <div className="p-6 bg-white/3 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden">
                <div className="border-b border-white/5 pb-3">
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-[#00ff88] flex items-center gap-1.5">
                    <Users size={12} /> Active Department
                  </h3>
                  <p className="text-[10px] text-white/40 mt-0.5">Pre-configured agent models</p>
                </div>
                <div className="space-y-2.5 my-4">
                  {[
                    { role: 'CEO', name: 'Alex', color: 'from-rose-500/20 to-rose-500/10', text: 'text-rose-400', emoji: '👑' },
                    { role: 'PM', name: 'Sam', color: 'from-cyan-500/20 to-cyan-500/10', text: 'text-cyan-400', emoji: '📋' },
                    { role: 'Engineer', name: 'Mike', color: 'from-amber-500/20 to-amber-500/10', text: 'text-amber-400', emoji: '💻' },
                    { role: 'QA', name: 'Tina', color: 'from-violet-500/20 to-violet-500/10', text: 'text-violet-400', emoji: '🔍' },
                  ].map((agent, i) => (
                    <div key={i} className={`flex items-center justify-between p-2 rounded-xl bg-gradient-to-r ${agent.color} border border-white/5`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{agent.emoji}</span>
                        <div className="leading-none">
                          <span className="text-[11px] font-bold text-white block">{agent.name}</span>
                          <span className="text-[9px] text-white/50">{agent.role} Agent</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-mono font-bold ${agent.text} uppercase tracking-wider`}>Active</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-mono text-white/40 bg-black/30 p-2 rounded-lg border border-white/5">
                  Spawns additional developers dynamically on scale.
                </div>
              </div>

              {/* BENTO CARD 3: REAL-TIME SIMULATION MONITOR (Left double block row 2) */}
              <div className="lg:col-span-2 p-6 bg-white/3 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col justify-between group overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-ping" />
                    <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-[#00ff88]">
                      Simulation Live Stream
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono text-white/40 uppercase">Channel: Live_SSE</span>
                </div>
                
                {/* Scrolling Console Output */}
                <div className="my-4 h-36 bg-black/50 border border-white/5 p-4 rounded-xl font-mono text-[11px] text-emerald-400 overflow-y-auto space-y-1.5 flex flex-col justify-end shadow-inner relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#080b08]/80 to-transparent pointer-events-none h-8" />
                  {terminalLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-[#00ff88]/40">&gt;</span>
                      <span className={log.includes('SUCCESS') ? 'text-cyan-400 font-bold' : log.includes('complete') ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                        {log}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#00ff88]/40">&gt;</span>
                    <span className="text-white/40">Monitoring compiler streams</span>
                    <span className="w-1.5 h-3 bg-[#00ff88] animate-pulse inline-block" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-white/40 bg-black/20 p-2.5 rounded-lg border border-white/5">
                  <span>Morale Score: <strong className="text-emerald-400">96%</strong></span>
                  <span>Deploy Queue: <strong className="text-cyan-400">Idle</strong></span>
                  <span>Active Sprint: <strong className="text-amber-400">Sprint #6</strong></span>
                </div>
              </div>

              {/* BENTO CARD 4: COST CALCULATOR (Right pricing block row 2) */}
              <div className="p-6 bg-white/3 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -left-20 -bottom-20 w-44 h-44 bg-cyan-500/10 rounded-full blur-[60px]" />
                <div className="border-b border-white/5 pb-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                      <DollarSign size={12} /> Flexible Scaling
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[9px] font-mono font-bold uppercase">
                      Interactive
                    </span>
                  </div>
                  <p className="text-[10px] text-white/40 mt-0.5">Claim 1 developer completely free</p>
                </div>

                <div className="my-4 space-y-4">
                  {/* Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-white/60">Developer Agents</span>
                      <span className="text-cyan-400 font-bold">{devCount} Spawns</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      value={devCount}
                      onChange={(e) => setDevCount(parseInt(e.target.value))}
                      className="w-full h-1 bg-black/60 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-white/30">
                      <span>1 Dev (Free)</span>
                      <span>4 Devs max</span>
                    </div>
                  </div>

                  {/* Price display */}
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-mono text-white/40 block">SPAWNS TIER</span>
                      <span className="text-xs font-bold text-white">{isFree ? 'Free Forever' : 'Enterprise Scale'}</span>
                    </div>
                    <div className="text-right leading-none">
                      <span className="text-[9px] font-mono text-white/40 block">EST. CHARGE</span>
                      <span className="text-xl font-mono font-extrabold text-[#00ff88]">
                        ${totalPrice}<span className="text-[10px] font-normal text-white/50 font-sans">/mo</span>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="w-full py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-bold text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isFree ? 'Claim Free Spawn' : 'Buy Spawns'} <ArrowUpRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 1: PIXEL-PERFECT MOCK CLERK AUTH MODAL */}
          {step === 1 && (
            <motion.div
              key="auth"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-[420px] p-8 bg-white/3 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden"
            >
              {/* Clerk Glow Accents */}
              <div className="absolute top-[-20%] left-[-20%] w-44 h-44 bg-cyan-500/15 rounded-full blur-[50px] pointer-events-none" />
              <div className="absolute bottom-[-20%] right-[-20%] w-44 h-44 bg-purple-500/15 rounded-full blur-[50px] pointer-events-none" />

              {/* Clerk Header logo */}
              <div className="text-center mb-6">
                <div className="flex justify-center items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 bg-gradient-to-tr from-cyan-400 to-purple-500 rounded-md flex items-center justify-center shadow-lg shadow-cyan-400/20">
                    <ShieldCheck size={14} className="text-white" />
                  </div>
                  <span className="font-mono text-xs font-black tracking-widest text-white/50 uppercase">
                    Clerk Secure Auth
                  </span>
                </div>
                <h2 className="text-xl font-extrabold tracking-tight text-white">
                  {authMode === 'signin' ? 'Sign in to AgentCorp' : 'Create your account'}
                </h2>
                <p className="text-xs text-white/50 mt-1">
                  Provide secure credentials to establish host synchronization
                </p>
              </div>

              {/* Social Login Buttons */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoggingIn(true);
                    setTimeout(() => {
                      setIsLoggingIn(false);
                      setStep(2);
                    }, 1200);
                  }}
                  className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.193 22 16.44 22 12.017 22 6.484 17.522 2 12 2z" />
                  </svg>
                  Continue with GitHub
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoggingIn(true);
                    setTimeout(() => {
                      setIsLoggingIn(false);
                      setStep(2);
                    }, 1200);
                  }}
                  className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.468 0-6.277-2.81-6.277-6.277s2.809-6.277 6.277-6.277c1.554 0 2.973.567 4.073 1.503l3.078-3.078C18.896 1.8 15.753 1 12.24 1 6.032 1 1 6.032 1 12.24s5.032 11.24 11.24 11.24c5.897 0 10.87-4.243 10.87-11.24 0-.687-.06-1.354-.17-1.955h-10.7z" />
                  </svg>
                  Continue with Google
                </button>
              </div>

              <div className="flex items-center gap-3 my-5">
                <div className="h-[1px] flex-1 bg-white/10" />
                <span className="text-[10px] font-mono text-white/40 uppercase">or</span>
                <div className="h-[1px] flex-1 bg-white/10" />
              </div>

              {/* Standard Email/Password Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-white/60 uppercase tracking-widest mb-1.5 font-mono">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/40 pointer-events-none">
                      <Mail size={13} />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-cyan-400/50 transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-white/60 uppercase tracking-widest mb-1.5 font-mono">Secure Access Key</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/40 pointer-events-none">
                      <Lock size={13} />
                    </span>
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-cyan-400/50 transition-all font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold text-xs transition-all uppercase font-mono flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Continue <ArrowRight size={14} /></>
                  )}
                </button>
              </form>

              {/* Secure Clerk tag */}
              <div className="mt-5 text-center flex items-center justify-center gap-1 text-[9px] font-mono text-white/30">
                <Lock size={10} /> Securely compiled & authenticated via Clerk
              </div>
            </motion.div>
          )}

          {/* STEP 2: PERSONAL SETUP PROFILE */}
          {step === 2 && (
            <motion.div
              key="profile"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg p-8 bg-white/3 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl space-y-6"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-white uppercase font-mono flex items-center gap-1.5">
                  <Sparkles size={18} className="text-[#00ff88]" /> PERSONAL SETUP PROFILE
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  Define details of your startup corporation for agent synthesis.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-white/60 uppercase tracking-widest mb-1.5 font-mono">Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AcmeCorp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-[#00ff88]/50 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-white/60 uppercase tracking-widest mb-1.5 font-mono">Sector Focus / Agents Core Purpose</label>
                  <textarea
                    required
                    placeholder="e.g. Next-gen billing infrastructure for SaaS startups"
                    value={companyProduct}
                    onChange={(e) => setCompanyProduct(e.target.value)}
                    className="w-full h-16 px-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs outline-none resize-none focus:border-[#00ff88]/50 transition-all font-mono"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[9px] font-bold text-white/60 uppercase tracking-widest font-mono">Spawns Count (Developer Agents)</label>
                    <span className="text-xs font-mono font-bold text-[#00ff88]">{devCount} Active Devs</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={devCount}
                    onChange={(e) => setDevCount(parseInt(e.target.value))}
                    className="w-full h-1 bg-black/40 border border-white/10 rounded-lg appearance-none cursor-pointer accent-[#00ff88]"
                  />
                  <p className="text-[10px] text-white/40 mt-1">
                    Other core roles (CEO, PM, QA, HR) spawn automatically and remain active.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-colors uppercase font-mono cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)} // Go to payment slider
                  className="flex-1 py-2.5 rounded-xl bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/30 text-[#00ff88] font-bold text-xs transition-all uppercase font-mono flex items-center justify-center gap-1 cursor-pointer shadow-lg shadow-[#00ff88]/5"
                >
                  Configure Spawns <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: MOCK STRIPE PAYMENT & GLASSMORPHISM VISA CARD */}
          {step === 3 && (
            <motion.div
              key="payment"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl p-8 bg-white/3 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl space-y-6"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-white uppercase font-mono flex items-center gap-1.5">
                  <CreditCard size={18} className="text-cyan-400" /> Spawns Authorization
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  {isFree ? '1 Developer Spawn is included in the Free Tier.' : `Complete secure Stripe pre-authorization of Enterprise Spawns ($${totalPrice}/mo).`}
                </p>
              </div>

              {/* If Free Tier, show Free Badge, else show Visa Card and Checkout Form */}
              {isFree ? (
                <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                    <CheckCircle2 size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold font-mono uppercase text-emerald-400">Free Tier Active</h4>
                    <p className="text-xs text-white/60 max-w-md mx-auto">
                      1 Developer agent is permanently free. CEO, PM, QA, and HR agents are included. No payment credentials required.
                    </p>
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-lg border border-white/5 text-[10px] font-mono text-white/40">
                    You can scale to Enterprise spawns anytime inside the workstation setting.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  
                  {/* GORGEOUS FROSTED GLASSMOURPHIC VISA CARD (6 cols on large screen) */}
                  <div className="md:col-span-6 flex justify-center">
                    <motion.div 
                      whileHover={{ scale: 1.03, rotateY: 10 }}
                      className="w-full max-w-[260px] h-[160px] bg-gradient-to-br from-[#00ff88]/20 via-cyan-500/15 to-[#008f11]/25 border border-white/20 rounded-2xl p-4 flex flex-col justify-between shadow-2xl relative overflow-hidden backdrop-blur-md"
                    >
                      {/* Frosted radial lighting circle */}
                      <div className="absolute top-[-30%] right-[-20%] w-32 h-32 bg-cyan-400/30 rounded-full blur-[30px]" />
                      <div className="absolute bottom-[-30%] left-[-20%] w-32 h-32 bg-[#00ff88]/20 rounded-full blur-[30px]" />

                      {/* Header */}
                      <div className="flex justify-between items-start z-10">
                        <span className="font-mono text-[9px] font-bold text-white/40 tracking-wider uppercase">Spawns Card</span>
                        <span className="text-[14px] font-extrabold italic text-white flex items-center gap-0.5">
                          VISA
                        </span>
                      </div>

                      {/* Chip & contactless wave */}
                      <div className="flex justify-between items-center z-10">
                        <div className="w-7 h-5.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-sm border border-black/10 shadow-sm" />
                        <svg className="w-5 h-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 9c0 1.66-1.34 3-3 3M8 6c0 3.31-2.69 6-6 6M11 3c0 4.97-4.03 9-9 9" strokeLinecap="round" />
                        </svg>
                      </div>

                      {/* Details */}
                      <div className="space-y-1.5 z-10">
                        <div className="font-mono text-[11px] text-white/80 tracking-widest truncate">
                          {cardNumber ? cardNumber : '••••  ••••  ••••  ••••'}
                        </div>
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="text-[7px] font-mono text-white/40 uppercase block leading-none mb-0.5">Cardholder</span>
                            <span className="font-mono text-[8px] font-bold text-white/95 uppercase tracking-wide block truncate max-w-[120px]">
                              {cardName ? cardName : `${companyName} CEO`}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[7px] font-mono text-white/40 uppercase block leading-none mb-0.5">Expiry</span>
                            <span className="font-mono text-[8px] font-bold text-white block">
                              {cardExpiry ? cardExpiry : '12/28'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Payment checkout form fields */}
                  <div className="md:col-span-6 space-y-3 font-mono">
                    <div>
                      <label className="block text-[8px] font-bold text-white/60 uppercase tracking-widest mb-1 font-mono">Cardholder Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-[10px] outline-none focus:border-cyan-400/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-white/60 uppercase tracking-widest mb-1 font-mono">Card Number</label>
                      <input
                        type="text"
                        required
                        maxLength={19}
                        placeholder="4111 2222 3333 4444"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-[10px] outline-none focus:border-cyan-400/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-bold text-white/60 uppercase tracking-widest mb-1 font-mono">Expiry</label>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-[10px] outline-none focus:border-cyan-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-white/60 uppercase tracking-widest mb-1 font-mono">CVV</label>
                        <input
                          type="password"
                          required
                          maxLength={3}
                          placeholder="•••"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-[10px] outline-none focus:border-cyan-400/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Form buttons or simple buttons */}
              {isFree ? (
                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-colors uppercase font-mono cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(4)} // Connectors step
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs transition-colors uppercase font-mono flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    Authorize Spawn <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <div className="flex gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-colors uppercase font-mono cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isPaying || paymentSuccess}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00ff88] to-cyan-500 hover:from-[#05ff8d] hover:to-cyan-400 text-[#080b08] font-bold text-xs transition-all uppercase font-mono flex items-center justify-center gap-1.5 shadow-lg shadow-[#00ff88]/20 cursor-pointer disabled:opacity-50"
                    >
                      {isPaying ? (
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      ) : paymentSuccess ? (
                        <>Authorized <Check size={14} className="stroke-[3]" /></>
                      ) : (
                        <>Pay & Spawn ${totalPrice} <ArrowRight size={14} className="stroke-[3]" /></>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}

          {/* STEP 4: LINK CONNECTORS (CLAUDE-STYLE) */}
          {step === 4 && (
            <motion.div
              key="connectors"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl p-8 bg-white/3 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl space-y-6"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-white uppercase font-mono flex items-center gap-1.5">
                  🔌 LINK CONNECTORS (CLAUDE-STYLE)
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  Grant credentials to let your personalized Agents push changes to active platforms.
                </p>
              </div>

              <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                {/* GitHub Hook */}
                <div className="p-3.5 bg-black/30 border border-white/5 rounded-2xl space-y-2">
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
                      <div className="w-7 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#00ff88]"></div>
                    </label>
                  </div>
                  {ghConnected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 pt-2 border-t border-white/5"
                    >
                      <input
                        type="text"
                        placeholder="Repository URL (e.g. https://github.com/user/repo)"
                        value={ghRepo}
                        onChange={(e) => setGhRepo(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-[11px] outline-none focus:border-[#00ff88]/30 font-mono"
                      />
                      <input
                        type="password"
                        placeholder="Personal Access Token (ghp_...)"
                        value={ghToken}
                        onChange={(e) => setGhToken(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-[11px] outline-none focus:border-[#00ff88]/30 font-mono"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Vercel Deploy Hook */}
                <div className="p-3.5 bg-black/30 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Play size={12} className="rotate-90 fill-white text-white" />
                      <h3 className="text-xs font-bold text-white/95">Vercel Deployments</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vConnected}
                        onChange={(e) => setVConnected(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                  </div>
                  {vConnected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 pt-2 border-t border-white/5"
                    >
                      <input
                        type="password"
                        placeholder="Vercel API Access Token (ver_...)"
                        value={vToken}
                        onChange={(e) => setVToken(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-[11px] outline-none focus:border-purple-400/30 font-mono"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Slack Webhook Hook */}
                <div className="p-3.5 bg-black/30 border border-white/5 rounded-2xl space-y-2">
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
                      <div className="w-7 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  {sConnected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 pt-2 border-t border-white/5"
                    >
                      <input
                        type="text"
                        placeholder="Incoming Webhook URL (https://hooks.slack.com/...)"
                        value={sUrl}
                        onChange={(e) => setSUrl(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-[11px] outline-none focus:border-amber-400/30 font-mono"
                      />
                    </motion.div>
                  )}
                </div>

                {/* AI Key Provider Hook */}
                <div className="p-3.5 bg-black/30 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Key size={14} className="text-cyan-400" />
                      <h3 className="text-xs font-bold text-white/95">Custom AI API Provider</h3>
                    </div>
                    <span className="text-[10px] text-white/30 font-mono uppercase">OPTIONAL</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')}
                      className="w-full px-2.5 py-1.5 bg-[#080b08]/80 border border-white/10 rounded-lg text-white text-[11px] outline-none col-span-1"
                    >
                      <option value="gemini">Gemini API</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                    <input
                      type="password"
                      placeholder="Enter API Key to override default"
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-[11px] outline-none focus:border-cyan-400/30 col-span-2 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-colors uppercase font-mono cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleLaunchSequence}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold text-xs transition-all uppercase font-mono flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  Launch Simulation <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: LOVELY COMPILING SYNTHESIS LOADER */}
          {step === 5 && (
            <motion.div
              key="deploying"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl p-8 bg-white/3 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl space-y-6"
            >
              {/* Deploying status info */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#00ff88]/10 rounded-full flex items-center justify-center border border-[#00ff88]/30 text-[#00ff88]">
                  <Server size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide">
                    SYNTHESIZING OFFICE INSTANCE
                  </h3>
                  <p className="text-xs text-[#00ff88] animate-pulse font-mono uppercase tracking-wider">
                    Running compiler scripts...
                  </p>
                </div>
              </div>

              {/* Glowing pipelines progress */}
              <div className="relative w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#00ff88] via-cyan-400 to-[#00ff88]"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(currentDeployStep + 1) * 12.5}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Console synthesis logs */}
              <div className="h-[180px] p-4 rounded-xl bg-black/60 border border-white/5 font-mono text-[11px] text-cyan-400 overflow-y-auto space-y-1.5 flex flex-col justify-start relative">
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
                        <span className="w-1.5 h-3.5 bg-cyan-400 inline-block animate-pulse ml-0.5" />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
