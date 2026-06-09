'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useUser, SignIn, SignUp } from '@clerk/nextjs';
import {
  GitBranch, Play, Key, Sparkles, Server, Check, ArrowRight,
  ShieldCheck, ChevronRight, CreditCard, Users,
  CheckCircle2, DollarSign, ArrowUpRight, Loader2, Cpu
} from 'lucide-react';

export default function SetupWizard() {
  const { initializePersonalizedOffice } = useGameStore();
  const { isSignedIn } = useUser();

  const [step, setStep] = useState<number>(1);
  const [authComponent, setAuthComponent] = useState<'signin' | 'signup'>('signin');

  const [companyName, setCompanyName] = useState('AgentCorp');
  const [companyProduct, setCompanyProduct] = useState('Autonomous Developer OS');
  const [devCount, setDevCount] = useState(1);

  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

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

  const [isRestoring, setIsRestoring] = useState(true);

  const [deployStatus, setDeployStatus] = useState<string[]>([]);
  const [currentDeployStep, setCurrentDeployStep] = useState<number>(0);

  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'Initializing simulation floor...',
    'System tick calibrated to 60Hz.',
    'Waiting for operator onboarding directive...'
  ]);

  const isFree = devCount === 1;
  const totalPrice = isFree ? 0 : (devCount - 1) * 10;

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

  useEffect(() => {
    if (isSignedIn === undefined) return;
    const saved = sessionStorage.getItem('wizardState');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        let targetStep = state.step;
        // Never restore to step 0 or 5 — both are dead-ends without proper context
        if (targetStep === 0 || targetStep >= 5) {
          targetStep = isSignedIn ? 2 : 1;
          sessionStorage.removeItem('wizardState');
        }
        if (isSignedIn && targetStep === 1) targetStep = 2;
        setStep(targetStep);
        setCompanyName(state.companyName);
        setCompanyProduct(state.companyProduct);
        setDevCount(state.devCount);
        setGhConnected(state.ghConnected ?? true);
        setGhRepo(state.ghRepo ?? '');
        setGhToken(state.ghToken ?? '');
        setGhCommit(state.ghCommit ?? true);
        setVConnected(state.vConnected ?? true);
        setVToken(state.vToken ?? '');
        setVDeploy(state.vDeploy ?? true);
        setSConnected(state.sConnected ?? false);
        setSUrl(state.sUrl ?? '');
        setSBroadcast(state.sBroadcast ?? true);
        setAiProvider(state.aiProvider ?? 'gemini');
        setAiKey(state.aiKey ?? '');
      } catch {
        sessionStorage.removeItem('wizardState');
      }
    } else {
      if (isSignedIn) {
        setStep(2);
      } else {
        setStep(1);
      }
    }
    setIsRestoring(false);
  }, [isSignedIn]);

  useEffect(() => {
    if (isRestoring) return;
    // Don't persist the launch/deploying screen — a refresh should restart cleanly
    if (step >= 5) return;
    sessionStorage.setItem('wizardState', JSON.stringify({
      step, companyName, companyProduct, devCount,
      ghConnected, ghRepo, ghToken, ghCommit,
      vConnected, vToken, vDeploy,
      sConnected, sUrl, sBroadcast,
      aiProvider, aiKey,
    }));
  }, [step, companyName, companyProduct, devCount,
      ghConnected, ghRepo, ghToken, ghCommit,
      vConnected, vToken, vDeploy,
      sConnected, sUrl, sBroadcast,
      aiProvider, aiKey, isRestoring]);

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPaying(true);
    setTimeout(() => {
      setIsPaying(false);
      setPaymentSuccess(true);
      setTimeout(() => handleLaunchSequence(), 1000);
    }, 2000);
  };

  const handleLaunchSequence = () => {
    setStep(5);
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
        setTimeout(() => {
          sessionStorage.removeItem('wizardState');
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

  if (isRestoring) {
    return <div className="fixed inset-0 z-50 bg-white" />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-white text-gray-900 overflow-y-auto overflow-x-hidden font-sans select-none">
      <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] bg-sky-200/40 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-15%] w-[800px] h-[800px] bg-violet-200/40 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="fixed top-0 left-0 right-0 h-16 border-b border-gray-100 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center shadow-sm">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-gray-900">AgentCorp</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="hover:text-gray-600 cursor-pointer transition-colors">Docs</span>
          <span className="hover:text-gray-600 cursor-pointer transition-colors">Pricing</span>
          <span className="hover:text-gray-600 cursor-pointer transition-colors">Status</span>
          {step === 0 && (
            <button
              onClick={() => setStep(1)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 text-white font-semibold hover:from-sky-500 hover:to-cyan-500 transition-all cursor-pointer shadow-sm text-xs"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pt-24 pb-12 relative z-10 flex items-center justify-center min-h-screen">
        <AnimatePresence mode="wait">
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
              <div className="lg:col-span-2 flex flex-col justify-between p-8 bg-white border border-gray-100 rounded-3xl card-shadow relative overflow-hidden group">
                <div className="absolute -right-24 -top-24 w-64 h-64 bg-sky-100/60 rounded-full blur-[80px] group-hover:bg-sky-100/80 transition-colors duration-500" />
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-100 text-sky-600 text-[10px] font-semibold tracking-wider">
                    <Sparkles size={10} /> Active Agent Sandbox v2.0.6
                  </div>
                  <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.1] text-gray-900">
                    Build <span className="gradient-text">AI teammates</span>,<br />not automations.
                  </h1>
                  <p className="text-sm md:text-base text-gray-500 font-normal leading-relaxed max-w-xl">
                    Instantly deploy an autonomous department of AI teammates directly to your project workspace. Watch them coordinate, write, review, and deploy code in real-time.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    Deploy AI Department <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold text-xs tracking-wider transition-all cursor-pointer"
                  >
                    Configure Sandbox
                  </button>
                </div>
              </div>

              <div className="p-6 bg-white border border-gray-100 rounded-3xl card-shadow flex flex-col justify-between overflow-hidden">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-600 flex items-center gap-1.5">
                    <Users size={12} /> Active Department
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Pre-configured agent models</p>
                </div>
                <div className="space-y-2.5 my-4">
                  {[
                    { role: 'CEO', name: 'Alex', color: 'from-rose-100 to-rose-50', text: 'text-rose-600', emoji: '👑' },
                    { role: 'PM', name: 'Sam', color: 'from-sky-100 to-sky-50', text: 'text-sky-600', emoji: '📋' },
                    { role: 'Engineer', name: 'Mike', color: 'from-amber-100 to-amber-50', text: 'text-amber-600', emoji: '💻' },
                    { role: 'QA', name: 'Tina', color: 'from-violet-100 to-violet-50', text: 'text-violet-600', emoji: '🔍' },
                  ].map((agent, i) => (
                    <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r ${agent.color} border border-gray-100`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{agent.emoji}</span>
                        <div className="leading-none">
                          <span className="text-xs font-semibold text-gray-900 block">{agent.name}</span>
                          <span className="text-[9px] text-gray-500">{agent.role} Agent</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-semibold ${agent.text} uppercase tracking-wider`}>Active</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-gray-400 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  Spawns additional developers dynamically on scale.
                </div>
              </div>

              <div className="lg:col-span-2 p-6 bg-white border border-gray-100 rounded-3xl card-shadow flex flex-col justify-between group overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                      Simulation Live Stream
                    </h3>
                  </div>
                  <span className="text-[9px] text-gray-400 uppercase">Channel: Live_SSE</span>
                </div>
                <div className="my-4 h-36 bg-gray-50 border border-gray-100 p-4 rounded-xl text-xs text-gray-600 overflow-y-auto space-y-1.5 flex flex-col justify-end font-mono">
                  {terminalLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-gray-300">&gt;</span>
                      <span className={log.includes('SUCCESS') ? 'text-cyan-600 font-semibold' : log.includes('complete') ? 'text-amber-600 font-semibold' : 'text-gray-600'}>
                        {log}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-300">&gt;</span>
                    <span className="text-gray-400">Monitoring compiler streams</span>
                    <span className="w-1.5 h-3 bg-sky-400 animate-pulse inline-block rounded-sm" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <span>Morale Score: <strong className="text-green-600">96%</strong></span>
                  <span>Deploy Queue: <strong className="text-cyan-600">Idle</strong></span>
                  <span>Active Sprint: <strong className="text-amber-600">Sprint #6</strong></span>
                </div>
              </div>

              <div className="p-6 bg-white border border-gray-100 rounded-3xl card-shadow flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -left-20 -bottom-20 w-44 h-44 bg-sky-100/60 rounded-full blur-[60px]" />
                <div className="border-b border-gray-100 pb-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-600 flex items-center gap-1.5">
                      <DollarSign size={12} /> Flexible Scaling
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-100 text-cyan-600 text-[9px] font-semibold uppercase">
                      Interactive
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Claim 1 developer completely free</p>
                </div>
                <div className="my-4 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Developer Agents</span>
                      <span className="text-cyan-600 font-semibold">{devCount} Spawns</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      value={devCount}
                      onChange={(e) => setDevCount(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex justify-between text-[9px] text-gray-400">
                      <span>1 Dev (Free)</span>
                      <span>4 Devs max</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-gray-400 block">SPAWNS TIER</span>
                      <span className="text-xs font-semibold text-gray-900">{isFree ? 'Free Forever' : 'Enterprise Scale'}</span>
                    </div>
                    <div className="text-right leading-none">
                      <span className="text-[9px] text-gray-400 block">EST. CHARGE</span>
                      <span className="text-xl font-bold text-sky-600">
                        ${totalPrice}<span className="text-[10px] font-normal text-gray-400">/mo</span>
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="w-full py-2.5 rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 font-semibold text-xs tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isFree ? 'Claim Free Spawn' : 'Buy Spawns'} <ArrowUpRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="auth"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-[420px] p-8 bg-white border border-gray-100 rounded-3xl card-shadow relative overflow-hidden"
            >
              <div className="absolute top-[-20%] left-[-20%] w-44 h-44 bg-sky-100/60 rounded-full blur-[50px] pointer-events-none" />
              <div className="absolute bottom-[-20%] right-[-20%] w-44 h-44 bg-violet-100/60 rounded-full blur-[50px] pointer-events-none" />

              <div className="text-center mb-6">
                <div className="flex justify-center items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center shadow-sm">
                    <ShieldCheck size={14} className="text-white" />
                  </div>
                  <span className="text-xs font-semibold text-gray-400 uppercase">Clerk Secure Auth</span>
                </div>
                <h2 className="text-xl font-extrabold tracking-tight text-gray-900">
                  {authComponent === 'signin' ? 'Sign in to AgentCorp' : 'Create your account'}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Provide secure credentials to establish host synchronization
                </p>
              </div>

              {authComponent === 'signin' ? (
                <SignIn
                  appearance={{
                    elements: {
                      rootBox: 'w-full',
                      card: 'bg-transparent shadow-none p-0',
                      header: 'hidden',
                      headerTitle: 'hidden',
                      headerSubtitle: 'hidden',
                      footer: 'hidden',
                      socialButtonsBlockButton: 'w-full py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-center gap-2 transition-all',
                      socialButtonsBlockButtonText: 'text-gray-700 text-xs font-semibold',
                      dividerLine: 'bg-gray-100',
                      dividerText: 'text-[10px] text-gray-400 uppercase',
                      dividerRow: 'my-5',
                      formFieldLabel: 'text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5',
                      formFieldInput: 'w-full py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-xs outline-none focus:border-sky-400/50 transition-all',
                      formButtonPrimary: 'w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 text-white font-semibold text-xs transition-all shadow-sm',
                      identityPreviewText: 'text-gray-700 text-xs',
                      identityPreviewEditButton: 'text-sky-600 hover:text-sky-700 text-xs',
                      alternativeMethodsBlockButton: 'w-full py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-center gap-2 transition-all',
                      alternativeMethodsBlockButtonText: 'text-gray-700 text-xs font-semibold',
                    },
                  }}
                />
              ) : (
                <SignUp
                  appearance={{
                    elements: {
                      rootBox: 'w-full',
                      card: 'bg-transparent shadow-none p-0',
                      header: 'hidden',
                      headerTitle: 'hidden',
                      headerSubtitle: 'hidden',
                      footer: 'hidden',
                      socialButtonsBlockButton: 'w-full py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-center gap-2 transition-all',
                      socialButtonsBlockButtonText: 'text-gray-700 text-xs font-semibold',
                      dividerLine: 'bg-gray-100',
                      dividerText: 'text-[10px] text-gray-400 uppercase',
                      dividerRow: 'my-5',
                      formFieldLabel: 'text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5',
                      formFieldInput: 'w-full py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-xs outline-none focus:border-sky-400/50 transition-all',
                      formButtonPrimary: 'w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 text-white font-semibold text-xs transition-all shadow-sm',
                      identityPreviewText: 'text-gray-700 text-xs',
                      identityPreviewEditButton: 'text-sky-600 hover:text-sky-700 text-xs',
                      alternativeMethodsBlockButton: 'w-full py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-center gap-2 transition-all',
                      alternativeMethodsBlockButtonText: 'text-gray-700 text-xs font-semibold',
                    },
                  }}
                />
              )}

              <div className="mt-5 text-center">
                <span className="text-xs text-gray-500">
                  {authComponent === 'signin' ? (
                    <>
                      Don&apos;t have an account?{' '}
                      <button
                        onClick={() => setAuthComponent('signup')}
                        className="text-sky-600 hover:text-sky-700 font-semibold underline underline-offset-2 cursor-pointer"
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        onClick={() => setAuthComponent('signin')}
                        className="text-sky-600 hover:text-sky-700 font-semibold underline underline-offset-2 cursor-pointer"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </span>
              </div>

              <div className="mt-4 text-center flex items-center justify-center gap-1 text-[9px] text-gray-400">
                <ShieldCheck size={10} /> Securely compiled & authenticated via Clerk
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="profile"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg p-8 bg-white border border-gray-100 rounded-3xl card-shadow space-y-6"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-gray-900 flex items-center gap-1.5">
                  <Sparkles size={18} className="text-sky-500" /> Personal Setup Profile
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Define details of your startup corporation for agent synthesis.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AcmeCorp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-xs outline-none focus:border-sky-400/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Sector Focus / Core Purpose</label>
                  <textarea
                    required
                    placeholder="e.g. Next-gen billing infrastructure for SaaS startups"
                    value={companyProduct}
                    onChange={(e) => setCompanyProduct(e.target.value)}
                    className="w-full h-16 px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-xs outline-none resize-none focus:border-sky-400/50 transition-all"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Developer Agents</label>
                    <span className="text-xs font-semibold text-sky-600">{devCount} Active Devs</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={devCount}
                    onChange={(e) => setDevCount(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 border border-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Other core roles (CEO, PM, QA, HR) spawn automatically and remain active.
                  </p>
                </div>
              </div>

              {/* Testing Disclaimer */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                <span className="text-amber-500 text-base shrink-0">⚠️</span>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  <strong>Beta Disclaimer:</strong> AgentCorp is in early testing. Agents may make mistakes, produce incorrect outputs, or take unintended actions. <strong>Use on your own risk</strong> — do not run on production repositories without review. No data is guaranteed to be safe.
                </p>
              </div>

              <div className="flex gap-4 pt-2">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition-colors cursor-pointer">
                  Back
                </button>
                <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-600 font-semibold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer">
                  Configure Spawns <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="payment"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl p-8 bg-white border border-gray-100 rounded-3xl card-shadow space-y-6"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-gray-900 flex items-center gap-1.5">
                  <CreditCard size={18} className="text-cyan-500" /> Spawns Authorization
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isFree ? '1 Developer Spawn is included in the Free Tier.' : `Complete secure pre-authorization of Enterprise Spawns ($${totalPrice}/mo).`}
                </p>
              </div>

              {isFree ? (
                <div className="p-6 rounded-2xl bg-green-50 border border-green-100 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 border border-green-200 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} className="text-green-600" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-green-700">Free Tier Active</h4>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      1 Developer agent is permanently free. CEO, PM, QA, and HR agents are included. No payment required.
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-gray-100 text-[10px] text-gray-400">
                    You can scale to Enterprise spawns anytime inside the workspace.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-6 flex justify-center">
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      className="w-full max-w-[260px] h-[160px] bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100 border border-gray-200 rounded-2xl p-4 flex flex-col justify-between card-shadow relative overflow-hidden"
                    >
                      <div className="absolute top-[-30%] right-[-20%] w-32 h-32 bg-sky-200/60 rounded-full blur-[30px]" />
                      <div className="absolute bottom-[-30%] left-[-20%] w-32 h-32 bg-cyan-200/60 rounded-full blur-[30px]" />
                      <div className="flex justify-between items-start z-10">
                        <span className="text-[9px] font-semibold text-gray-400 tracking-wider uppercase">Spawns Card</span>
                        <span className="text-sm font-bold italic text-gray-700">VISA</span>
                      </div>
                      <div className="flex justify-between items-center z-10">
                        <div className="w-7 h-5 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 rounded-sm border border-amber-500/20 shadow-sm" />
                      </div>
                      <div className="space-y-1.5 z-10">
                        <div className="text-xs text-gray-600 tracking-widest truncate">
                          {cardNumber || '••••  ••••  ••••  ••••'}
                        </div>
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="text-[7px] text-gray-400 uppercase block leading-none mb-0.5">Cardholder</span>
                            <span className="text-[8px] font-semibold text-gray-800 uppercase tracking-wide block truncate max-w-[120px]">
                              {cardName || `${companyName} CEO`}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[7px] text-gray-400 uppercase block leading-none mb-0.5">Expiry</span>
                            <span className="text-[8px] font-bold text-gray-700 block">{cardExpiry || '12/28'}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  <div className="md:col-span-6 space-y-3">
                    <div>
                      <label className="block text-[8px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Cardholder Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-[10px] outline-none focus:border-sky-400/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Card Number</label>
                      <input
                        type="text"
                        required
                        maxLength={19}
                        placeholder="4111 2222 3333 4444"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-[10px] outline-none focus:border-sky-400/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Expiry</label>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-[10px] outline-none focus:border-sky-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-semibold text-gray-500 uppercase tracking-wider mb-1">CVV</label>
                        <input
                          type="password"
                          required
                          maxLength={3}
                          placeholder="•••"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-[10px] outline-none focus:border-sky-400/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isFree ? (
                <div className="flex gap-4 pt-2">
                  <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition-colors cursor-pointer">
                    Back
                  </button>
                  <button onClick={handleLaunchSequence} className="flex-1 py-2.5 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 text-green-600 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    Launch Simulation <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <div className="flex gap-4 pt-2">
                    <button type="button" onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition-colors cursor-pointer">
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isPaying || paymentSuccess}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isPaying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : paymentSuccess ? (
                        <>Authorized <Check size={14} /></>
                      ) : (
                        <>Pay & Spawn ${totalPrice} <ArrowRight size={14} /></>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}

          {step === 999 && (
            <motion.div
              key="connectors"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl p-8 bg-white border border-gray-100 rounded-3xl card-shadow space-y-6"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-gray-900 flex items-center gap-1.5">
                  Platform Integrations
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Grant credentials to let your agents push changes to active platforms.
                </p>
              </div>

              <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <GitBranch size={14} className="text-gray-600" />
                      <h3 className="text-xs font-semibold text-gray-900">GitHub Integration</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={ghConnected} onChange={(e) => setGhConnected(e.target.checked)} className="sr-only peer" />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-400"></div>
                    </label>
                  </div>
                  {ghConnected && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-gray-100">
                      <input type="text" placeholder="Repository URL (e.g. https://github.com/user/repo)" value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-sky-400/50" />
                      <input type="password" placeholder="Personal Access Token (ghp_...)" value={ghToken} onChange={(e) => setGhToken(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-sky-400/50" />
                    </motion.div>
                  )}
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Play size={12} className="rotate-90 fill-gray-600 text-gray-600" />
                      <h3 className="text-xs font-semibold text-gray-900">Vercel Deployments</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={vConnected} onChange={(e) => setVConnected(e.target.checked)} className="sr-only peer" />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-violet-400"></div>
                    </label>
                  </div>
                  {vConnected && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-gray-100">
                      <input type="password" placeholder="Vercel API Access Token (ver_...)" value={vToken} onChange={(e) => setVToken(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-violet-400/50" />
                    </motion.div>
                  )}
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-500" />
                      <h3 className="text-xs font-semibold text-gray-900">Slack Notifications</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={sConnected} onChange={(e) => setSConnected(e.target.checked)} className="sr-only peer" />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-400"></div>
                    </label>
                  </div>
                  {sConnected && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-gray-100">
                      <input type="text" placeholder="Incoming Webhook URL (https://hooks.slack.com/...)" value={sUrl} onChange={(e) => setSUrl(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-amber-400/50" />
                    </motion.div>
                  )}
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Key size={14} className="text-cyan-500" />
                      <h3 className="text-xs font-semibold text-gray-900">Custom AI API Provider</h3>
                    </div>
                    <span className="text-[10px] text-gray-400 uppercase">OPTIONAL</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none col-span-1"
                    >
                      <option value="gemini">Gemini API</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                    <input
                      type="password"
                      placeholder="Enter API Key to override default"
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-sky-400/50 col-span-2"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition-colors cursor-pointer">
                  Back
                </button>
                <button onClick={handleLaunchSequence} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-500 hover:to-cyan-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
                  Launch Simulation <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="deploying"
              variants={wizardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl p-8 bg-white border border-gray-100 rounded-3xl card-shadow space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-400 flex items-center justify-center shadow-sm">
                  <Server size={22} className="text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Synthesizing Office Instance
                  </h3>
                  <p className="text-xs text-sky-500 animate-pulse font-semibold">
                    Running compiler scripts...
                  </p>
                </div>
              </div>

              <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-400 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(currentDeployStep + 1) * 12.5}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="h-[180px] p-4 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-600 overflow-y-auto space-y-1.5 flex flex-col justify-start font-mono">
                <AnimatePresence>
                  {deployStatus.map((log, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-1.5 text-xs"
                    >
                      <span className="text-violet-500 font-bold">&gt;</span>
                      <span>{log}</span>
                      {idx === currentDeployStep && (
                        <span className="w-1.5 h-3.5 bg-sky-400 inline-block animate-pulse ml-0.5 rounded-sm" />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="flex justify-center pt-2">
                <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
