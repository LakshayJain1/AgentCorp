'use client';

import { useGameStore } from '@/store/gameStore';
import { completeClerkOnboarding } from '@/app/onboard/_actions';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, SignIn, SignUp } from '@clerk/nextjs';
import {
  GitBranch, Play, Key, Sparkles, Server, Check, ArrowRight,
  ShieldCheck, ChevronRight, CreditCard, Users,
  CheckCircle2, DollarSign, ArrowUpRight, Loader2, Cpu
} from 'lucide-react';

export default function SetupWizard() {
  const { initializePersonalizedOffice } = useGameStore();
  const { isSignedIn, user } = useUser();
  const router = useRouter();

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

  // On desktop the user already authenticated in the system browser — never
  // show the in-app Clerk sign-in form. Treat desktop as always signed-in for
  // wizard routing purposes.
  const isDesktop = typeof window !== 'undefined' &&
    !!(window as unknown as { agentcorpDesktop?: { available?: boolean } }).agentcorpDesktop?.available;

  useEffect(() => {
    // On desktop: don't wait for Clerk's client-side resolution — skip straight
    // to step 2. The session cookie was injected by the Electron main process and
    // is valid server-side; Clerk's React SDK may lag behind on client-side state.
    if (isDesktop && isSignedIn === undefined) {
      const saved = sessionStorage.getItem('wizardState');
      if (saved) {
        try {
          const state = JSON.parse(saved);
          const targetStep = (state.step === 0 || state.step >= 5) ? 2 : Math.max(state.step, 2);
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
          setStep(2);
        }
      } else {
        setStep(2);
      }
      setIsRestoring(false);
      return;
    }

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
  }, [isSignedIn, isDesktop]);

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

  const handleLaunchSequence = async () => {
    setStep(5);

    // 1. Save Clerk metadata FIRST, while the session is fresh and authenticated.
    //    This must happen before any animation delay so the auth() call in the
    //    server action has a valid session token.
    sessionStorage.removeItem('wizardState');
    try {
      const res = await completeClerkOnboarding({
        companyName,
        companyProduct,
        developersCount: devCount,
      });
      if (res?.success) {
        // Reload so the client-side Clerk session picks up publicMetadata changes.
        await user?.reload();
      } else {
        console.warn('[Clerk] Onboarding metadata not saved:', res?.error);
      }
    } catch (err) {
      console.error('[Clerk] Onboarding server action threw unexpectedly:', err);
    }

    // 2. Run the deploy animation logs.
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
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (currentLogIndex < deployLogs.length) {
          setDeployStatus((prev) => [...prev, deployLogs[currentLogIndex]]);
          setCurrentDeployStep(currentLogIndex);
          currentLogIndex++;
        } else {
          clearInterval(interval);
          resolve();
        }
      }, 900);
    });

    // 3. Short pause to let the final log message render, then initialize and navigate.
    await new Promise((r) => setTimeout(r, 800));

    // 4. Initialize the in-memory game store.
    initializePersonalizedOffice(companyName, companyProduct, devCount, {
      github: { connected: ghConnected, repoUrl: ghRepo, token: ghToken, autoCommit: ghCommit },
      vercel: { connected: vConnected, token: vToken, autoDeploy: vDeploy },
      slack: { connected: sConnected, webhookUrl: sUrl, broadcastEvents: sBroadcast },
      ai: { provider: aiProvider, apiKey: aiKey },
    });

    // 5. Explicitly navigate to /workspace — don't rely on the useEffect in onboard/page.tsx
    //    which may race against the store update.
    //    If running inside Electron, redirect to the desktop-redirect route
    //    which will trigger the deep link back to the desktop app.
    const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');
    if (isElectron) {
      router.replace('/desktop-redirect');
    } else {
      router.replace('/workspace');
    }
  };


  const wizardVariants = {
    enter: { opacity: 0, y: 18, scale: 0.985 },
    center: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -12, scale: 0.99 }
  };

  if (isRestoring) {
    return <div className="fixed inset-0 z-50 bg-white" />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-paper text-navy overflow-y-auto overflow-x-hidden font-sans select-none">
      <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] bg-ocean-300/25 rounded-full blur-[160px] pointer-events-none animate-driftSlow" />
      <div className="absolute bottom-[-20%] left-[-15%] w-[800px] h-[800px] bg-teal/15 rounded-full blur-[180px] pointer-events-none animate-driftSlow" style={{ animationDelay: '-8s' }} />
      <div className="absolute inset-0 grid-dots opacity-60 pointer-events-none" />

      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-10 relative z-10 flex flex-col min-h-screen">

        {/* Page header — logo + step progress only, no nav links */}
        <div className="flex flex-col items-center gap-5 mb-10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-ocean to-teal flex items-center justify-center shadow-sm">
              <Cpu className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-navy/70 font-display">AgentCorp</span>
          </div>

          {step >= 1 && (
            <div className="flex items-center gap-1.5">
              {[
                { label: 'Account', s: 1 },
                { label: 'Workspace', s: 2 },
                { label: 'Launch', s: 3 },
              ].map(({ label, s }, i) => {
                const allDone = step === 5;
                const active = !allDone && step === s;
                const done = allDone || step > s;
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-300 ${
                      allDone        ? 'bg-green-100 text-green-700' :
                      active         ? 'bg-ocean-600 text-white shadow-sm' :
                      done           ? 'bg-green-100 text-green-700' :
                                       'bg-[rgba(23,23,31,0.05)] text-navy/35'
                    }`}>
                      {done ? <Check className="w-3 h-3" /> : <span className="w-3 text-center">{s}</span>}
                      <span>{label}</span>
                    </div>
                    {i < 2 && <ChevronRight className="w-3 h-3 text-navy/20" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center w-full">
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
              <div className="lg:col-span-2 flex flex-col justify-between p-8 glass rounded-3xl !bg-white/80 !backdrop-blur-2xl card-shadow relative overflow-hidden group">
                <div className="absolute -right-24 -top-24 w-64 h-64 bg-ocean-100/60 rounded-full blur-[80px] group-hover:bg-ocean-100/80 transition-colors duration-500" />
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ocean-50 border border-ocean-100 text-ocean-600 text-[10px] font-semibold tracking-wider">
                    <Sparkles size={10} /> Active Agent Sandbox v2.0.6
                  </div>

                  <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.1] text-navy">
                    Build <span className="gradient-text">AI teammates</span>,<br />not automations.
                  </h1>
                  <p className="text-sm md:text-base text-navy/55 font-normal leading-relaxed max-w-xl">
                    Instantly deploy an autonomous department of AI teammates directly to your project workspace. Watch them coordinate, write, review, and deploy code in real-time.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 rounded-xl bg-ocean-600 hover:bg-ocean-700 shadow-[0_8px_24px_rgba(10,132,255,0.35)] text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    Deploy AI Department <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 rounded-xl bg-white/70 hover:bg-[rgba(23,23,31,0.04)] border border-navy/10 text-navy/80 font-semibold text-xs tracking-wider transition-all cursor-pointer"
                  >
                    Configure Sandbox
                  </button>
                </div>
              </div>

              <div className="p-6 glass rounded-3xl !bg-white/80 !backdrop-blur-2xl card-shadow flex flex-col justify-between overflow-hidden">
                <div className="border-b border-navy/5 pb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ocean-600 flex items-center gap-1.5">
                    <Users size={12} /> Active Department
                  </h3>
                  <p className="text-[10px] text-navy/40 mt-0.5">Pre-configured agent models</p>
                </div>
                <div className="space-y-2.5 my-4">
                  {[
                    { role: 'CEO', name: 'Alex', color: 'from-rose-100 to-rose-50', text: 'text-rose-600', emoji: '👑' },
                    { role: 'PM', name: 'Sam', color: 'from-ocean-100 to-ocean-50', text: 'text-ocean-600', emoji: '📋' },
                    { role: 'Engineer', name: 'Mike', color: 'from-amber-100 to-amber-50', text: 'text-amber-600', emoji: '💻' },
                    { role: 'QA', name: 'Tina', color: 'from-violet-100 to-violet-50', text: 'text-violet-600', emoji: '🔍' },
                  ].map((agent, i) => (
                    <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r ${agent.color} border border-navy/5`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{agent.emoji}</span>
                        <div className="leading-none">
                          <span className="text-xs font-semibold text-navy block">{agent.name}</span>
                          <span className="text-[9px] text-navy/55">{agent.role} Agent</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-semibold ${agent.text} uppercase tracking-wider`}>Active</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-navy/40 bg-white/70 p-2.5 rounded-lg border border-navy/5">
                  Spawns additional developers dynamically on scale.
                </div>
              </div>

              <div className="lg:col-span-2 p-6 glass rounded-3xl !bg-white/80 !backdrop-blur-2xl card-shadow flex flex-col justify-between group overflow-hidden">
                <div className="flex items-center justify-between border-b border-navy/5 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-ocean-500 animate-pulse" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ocean-600">
                      Simulation Live Stream
                    </h3>
                  </div>
                  <span className="text-[9px] text-navy/40 uppercase">Channel: Live_SSE</span>
                </div>
                <div className="my-4 h-36 bg-white/70 border border-navy/5 p-4 rounded-xl text-xs text-navy/70 overflow-y-auto space-y-1.5 flex flex-col justify-end font-mono">
                  {terminalLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-navy/25">&gt;</span>
                      <span className={log.includes('SUCCESS') ? 'text-teal font-semibold' : log.includes('complete') ? 'text-amber-600 font-semibold' : 'text-navy/70'}>
                        {log}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <span className="text-navy/25">&gt;</span>
                    <span className="text-navy/40">Monitoring compiler streams</span>
                    <span className="w-1.5 h-3 bg-ocean-500 animate-pulse inline-block rounded-sm" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-navy/40 bg-white/70 p-2.5 rounded-lg border border-navy/5">
                  <span>Morale Score: <strong className="text-green-600">96%</strong></span>
                  <span>Deploy Queue: <strong className="text-teal">Idle</strong></span>
                  <span>Active Sprint: <strong className="text-amber-600">Sprint #6</strong></span>
                </div>
              </div>

              <div className="p-6 glass rounded-3xl !bg-white/80 !backdrop-blur-2xl card-shadow flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute -left-20 -bottom-20 w-44 h-44 bg-ocean-100/60 rounded-full blur-[60px]" />
                <div className="border-b border-navy/5 pb-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-teal flex items-center gap-1.5">
                      <DollarSign size={12} /> Flexible Scaling
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-100 text-teal text-[9px] font-semibold uppercase">
                      Interactive
                    </span>
                  </div>
                  <p className="text-[10px] text-navy/40 mt-0.5">Claim 1 developer completely free</p>
                </div>
                <div className="my-4 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-navy/55">Developer Agents</span>
                      <span className="text-teal font-semibold">{devCount} Spawns</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      value={devCount}
                      onChange={(e) => setDevCount(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-[rgba(23,23,31,0.05)] rounded-lg appearance-none cursor-pointer accent-ocean-600"
                    />
                    <div className="flex justify-between text-[9px] text-navy/40">
                      <span>1 Dev (Free)</span>
                      <span>4 Devs max</span>
                    </div>
                  </div>
                  <div className="bg-white/70 p-3 rounded-xl border border-navy/5 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-navy/40 block">SPAWNS TIER</span>
                      <span className="text-xs font-semibold text-navy">{isFree ? 'Free Forever' : 'Enterprise Scale'}</span>
                    </div>
                    <div className="text-right leading-none">
                      <span className="text-[9px] text-navy/40 block">EST. CHARGE</span>
                      <span className="text-xl font-bold text-ocean-600">
                        ${totalPrice}<span className="text-[10px] font-normal text-navy/40">/mo</span>
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="w-full py-2.5 rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-teal font-semibold text-xs tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
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
              className="w-full max-w-[420px] p-8 glass rounded-3xl !bg-white/80 !backdrop-blur-2xl card-shadow relative overflow-hidden"
            >
              <div className="absolute top-[-20%] left-[-20%] w-44 h-44 bg-ocean-100/60 rounded-full blur-[50px] pointer-events-none" />
              <div className="absolute bottom-[-20%] right-[-20%] w-44 h-44 bg-violet-100/60 rounded-full blur-[50px] pointer-events-none" />

              <div className="text-center mb-6">
                <div className="flex justify-center items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-ocean to-violet-500 flex items-center justify-center shadow-sm">
                    <ShieldCheck size={14} className="text-white" />
                  </div>
                  <span className="text-xs font-semibold text-navy/40 uppercase">Clerk Secure Auth</span>
                </div>
                <h2 className="text-xl font-extrabold tracking-tight text-navy">
                  {authComponent === 'signin' ? 'Sign in to AgentCorp' : 'Create your account'}
                </h2>
                <p className="text-xs text-navy/55 mt-1">
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
                      socialButtonsBlockButton: 'w-full py-2.5 rounded-xl border border-navy/10 bg-white hover:bg-white/70 text-xs font-semibold text-navy/80 flex items-center justify-center gap-2 transition-all',
                      socialButtonsBlockButtonText: 'text-navy/80 text-xs font-semibold',
                      dividerLine: 'bg-[rgba(23,23,31,0.05)]',
                      dividerText: 'text-[10px] text-navy/40 uppercase',
                      dividerRow: 'my-5',
                      formFieldLabel: 'text-[9px] font-semibold text-navy/55 uppercase tracking-wider mb-1.5',
                      formFieldInput: 'w-full py-2 bg-white/70 border border-navy/10 rounded-xl text-navy text-xs outline-none focus:border-ocean-400/60 transition-all',
                      formButtonPrimary: 'w-full py-2.5 rounded-xl bg-ocean-600 hover:bg-ocean-700 shadow-[0_8px_24px_rgba(10,132,255,0.35)] text-white font-semibold text-xs transition-all shadow-sm',
                      identityPreviewText: 'text-navy/80 text-xs',
                      identityPreviewEditButton: 'text-ocean-600 hover:text-ocean-700 text-xs',
                      alternativeMethodsBlockButton: 'w-full py-2.5 rounded-xl border border-navy/10 bg-white hover:bg-white/70 text-xs font-semibold text-navy/80 flex items-center justify-center gap-2 transition-all',
                      alternativeMethodsBlockButtonText: 'text-navy/80 text-xs font-semibold',
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
                      socialButtonsBlockButton: 'w-full py-2.5 rounded-xl border border-navy/10 bg-white hover:bg-white/70 text-xs font-semibold text-navy/80 flex items-center justify-center gap-2 transition-all',
                      socialButtonsBlockButtonText: 'text-navy/80 text-xs font-semibold',
                      dividerLine: 'bg-[rgba(23,23,31,0.05)]',
                      dividerText: 'text-[10px] text-navy/40 uppercase',
                      dividerRow: 'my-5',
                      formFieldLabel: 'text-[9px] font-semibold text-navy/55 uppercase tracking-wider mb-1.5',
                      formFieldInput: 'w-full py-2 bg-white/70 border border-navy/10 rounded-xl text-navy text-xs outline-none focus:border-ocean-400/60 transition-all',
                      formButtonPrimary: 'w-full py-2.5 rounded-xl bg-ocean-600 hover:bg-ocean-700 shadow-[0_8px_24px_rgba(10,132,255,0.35)] text-white font-semibold text-xs transition-all shadow-sm',
                      identityPreviewText: 'text-navy/80 text-xs',
                      identityPreviewEditButton: 'text-ocean-600 hover:text-ocean-700 text-xs',
                      alternativeMethodsBlockButton: 'w-full py-2.5 rounded-xl border border-navy/10 bg-white hover:bg-white/70 text-xs font-semibold text-navy/80 flex items-center justify-center gap-2 transition-all',
                      alternativeMethodsBlockButtonText: 'text-navy/80 text-xs font-semibold',
                    },
                  }}
                />
              )}

              <div className="mt-5 text-center">
                <span className="text-xs text-navy/55">
                  {authComponent === 'signin' ? (
                    <>
                      Don&apos;t have an account?{' '}
                      <button
                        onClick={() => setAuthComponent('signup')}
                        className="text-ocean-600 hover:text-ocean-700 font-semibold underline underline-offset-2 cursor-pointer"
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        onClick={() => setAuthComponent('signin')}
                        className="text-ocean-600 hover:text-ocean-700 font-semibold underline underline-offset-2 cursor-pointer"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </span>
              </div>

              <div className="mt-4 text-center flex items-center justify-center gap-1 text-[9px] text-navy/40">
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
              className="w-full max-w-lg p-8 glass rounded-3xl !bg-white/80 !backdrop-blur-2xl card-shadow space-y-6"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-navy flex items-center gap-1.5">
                  <Sparkles size={18} className="text-ocean-600" /> Personal Setup Profile
                </h2>
                <p className="text-xs text-navy/55 mt-0.5">
                  Define details of your startup corporation for agent synthesis.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-semibold text-navy/55 uppercase tracking-wider mb-1.5">Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AcmeCorp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white/70 border border-navy/10 rounded-xl text-navy text-xs outline-none focus:border-ocean-400/60 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold text-navy/55 uppercase tracking-wider mb-1.5">Sector Focus / Core Purpose</label>
                  <textarea
                    required
                    placeholder="e.g. Next-gen billing infrastructure for SaaS startups"
                    value={companyProduct}
                    onChange={(e) => setCompanyProduct(e.target.value)}
                    className="w-full h-16 px-3.5 py-2 bg-white/70 border border-navy/10 rounded-xl text-navy text-xs outline-none resize-none focus:border-ocean-400/60 transition-all"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[9px] font-semibold text-navy/55 uppercase tracking-wider">Developer Agents</label>
                    <span className="text-xs font-semibold text-ocean-600">{devCount} Active Devs</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={devCount}
                    onChange={(e) => setDevCount(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[rgba(23,23,31,0.05)] border border-navy/10 rounded-lg appearance-none cursor-pointer accent-ocean-600"
                  />
                  <p className="text-[10px] text-navy/40 mt-1">
                    Other core roles (CEO, PM, QA, HR) spawn automatically and remain active.
                  </p>
                </div>
              </div>

              {/* Testing Disclaimer */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                <span className="text-amber-500 text-base shrink-0">⚠️</span>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  <strong>Beta Disclaimer:</strong> AgentCorp is in early testing. Agents may make mistakes, produce incorrect outputs, or take unintended actions. <strong>Use at your own risk.</strong> Do not run on production repositories without review. No data is guaranteed to be safe.
                </p>
              </div>

              <div className="flex gap-4 pt-2">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl bg-white/70 border border-navy/10 text-navy/80 font-semibold text-xs hover:bg-[rgba(23,23,31,0.04)] transition-colors cursor-pointer">
                  Back
                </button>
                <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl bg-ocean-50 hover:bg-ocean-100 border border-ocean-200 text-ocean-600 font-semibold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer">
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
              className="w-full max-w-xl p-8 glass rounded-3xl !bg-white/80 !backdrop-blur-2xl card-shadow space-y-6"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-navy flex items-center gap-1.5">
                  <CreditCard size={18} className="text-teal" /> Spawns Authorization
                </h2>
                <p className="text-xs text-navy/55 mt-0.5">
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
                    <p className="text-xs text-navy/55 max-w-md mx-auto">
                      1 Developer agent is permanently free. CEO, PM, QA, and HR agents are included. No payment required.
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-navy/5 text-[10px] text-navy/40">
                    You can scale to Enterprise spawns anytime inside the workspace.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-6 flex justify-center">
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      className="w-full max-w-[260px] h-[160px] bg-gradient-to-br from-ocean-100 via-teal/10 to-ocean-50 border border-navy/10 rounded-2xl p-4 flex flex-col justify-between card-shadow relative overflow-hidden"
                    >
                      <div className="absolute top-[-30%] right-[-20%] w-32 h-32 bg-ocean-200/60 rounded-full blur-[30px]" />
                      <div className="absolute bottom-[-30%] left-[-20%] w-32 h-32 bg-cyan-200/60 rounded-full blur-[30px]" />
                      <div className="flex justify-between items-start z-10">
                        <span className="text-[9px] font-semibold text-navy/40 tracking-wider uppercase">Spawns Card</span>
                        <span className="text-sm font-bold italic text-navy/80">VISA</span>
                      </div>
                      <div className="flex justify-between items-center z-10">
                        <div className="w-7 h-5 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 rounded-sm border border-amber-500/20 shadow-sm" />
                      </div>
                      <div className="space-y-1.5 z-10">
                        <div className="text-xs text-navy/70 tracking-widest truncate">
                          {cardNumber || '••••  ••••  ••••  ••••'}
                        </div>
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="text-[7px] text-navy/40 uppercase block leading-none mb-0.5">Cardholder</span>
                            <span className="text-[8px] font-semibold text-navy uppercase tracking-wide block truncate max-w-[120px]">
                              {cardName || `${companyName} CEO`}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[7px] text-navy/40 uppercase block leading-none mb-0.5">Expiry</span>
                            <span className="text-[8px] font-bold text-navy/80 block">{cardExpiry || '12/28'}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  <div className="md:col-span-6 space-y-3">
                    <div>
                      <label className="block text-[8px] font-semibold text-navy/55 uppercase tracking-wider mb-1">Cardholder Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white/70 border border-navy/10 rounded-lg text-navy text-[10px] outline-none focus:border-ocean-400/60"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-semibold text-navy/55 uppercase tracking-wider mb-1">Card Number</label>
                      <input
                        type="text"
                        required
                        maxLength={19}
                        placeholder="4111 2222 3333 4444"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white/70 border border-navy/10 rounded-lg text-navy text-[10px] outline-none focus:border-ocean-400/60"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-semibold text-navy/55 uppercase tracking-wider mb-1">Expiry</label>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white/70 border border-navy/10 rounded-lg text-navy text-[10px] outline-none focus:border-ocean-400/60"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-semibold text-navy/55 uppercase tracking-wider mb-1">CVV</label>
                        <input
                          type="password"
                          required
                          maxLength={3}
                          placeholder="•••"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white/70 border border-navy/10 rounded-lg text-navy text-[10px] outline-none focus:border-ocean-400/60"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isFree ? (
                <div className="flex gap-4 pt-2">
                  <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-xl bg-white/70 border border-navy/10 text-navy/80 font-semibold text-xs hover:bg-[rgba(23,23,31,0.04)] transition-colors cursor-pointer">
                    Back
                  </button>
                  <button onClick={handleLaunchSequence} className="flex-1 py-2.5 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 text-green-600 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    Launch Simulation <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <div className="flex gap-4 pt-2">
                    <button type="button" onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-xl bg-white/70 border border-navy/10 text-navy/80 font-semibold text-xs hover:bg-[rgba(23,23,31,0.04)] transition-colors cursor-pointer">
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isPaying || paymentSuccess}
                      className="flex-1 py-2.5 rounded-xl bg-ocean-600 hover:bg-ocean-700 shadow-[0_8px_24px_rgba(10,132,255,0.35)] text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
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
              className="w-full max-w-xl p-8 glass rounded-3xl !bg-white/80 !backdrop-blur-2xl card-shadow space-y-6"
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-navy flex items-center gap-1.5">
                  Platform Integrations
                </h2>
                <p className="text-xs text-navy/55 mt-0.5">
                  Grant credentials to let your agents push changes to active platforms.
                </p>
              </div>

              <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                <div className="p-3.5 bg-white/70 border border-navy/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <GitBranch size={14} className="text-navy/70" />
                      <h3 className="text-xs font-semibold text-navy">GitHub Integration</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={ghConnected} onChange={(e) => setGhConnected(e.target.checked)} className="sr-only peer" />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-navy/15 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-ocean-500"></div>
                    </label>
                  </div>
                  {ghConnected && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-navy/5">
                      <input type="text" placeholder="Repository URL (e.g. https://github.com/user/repo)" value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-navy/10 rounded-lg text-navy text-xs outline-none focus:border-ocean-400/60" />
                      <input type="password" placeholder="Personal Access Token (ghp_...)" value={ghToken} onChange={(e) => setGhToken(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-navy/10 rounded-lg text-navy text-xs outline-none focus:border-ocean-400/60" />
                    </motion.div>
                  )}
                </div>

                <div className="p-3.5 bg-white/70 border border-navy/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Play size={12} className="rotate-90 fill-gray-600 text-navy/70" />
                      <h3 className="text-xs font-semibold text-navy">Vercel Deployments</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={vConnected} onChange={(e) => setVConnected(e.target.checked)} className="sr-only peer" />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-navy/15 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-ocean-500"></div>
                    </label>
                  </div>
                  {vConnected && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-navy/5">
                      <input type="password" placeholder="Vercel API Access Token (ver_...)" value={vToken} onChange={(e) => setVToken(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-navy/10 rounded-lg text-navy text-xs outline-none focus:border-ocean-400/60" />
                    </motion.div>
                  )}
                </div>

                <div className="p-3.5 bg-white/70 border border-navy/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-500" />
                      <h3 className="text-xs font-semibold text-navy">Slack Notifications</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={sConnected} onChange={(e) => setSConnected(e.target.checked)} className="sr-only peer" />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-navy/15 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-400"></div>
                    </label>
                  </div>
                  {sConnected && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-navy/5">
                      <input type="text" placeholder="Incoming Webhook URL (https://hooks.slack.com/...)" value={sUrl} onChange={(e) => setSUrl(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-navy/10 rounded-lg text-navy text-xs outline-none focus:border-amber-400/50" />
                    </motion.div>
                  )}
                </div>

                <div className="p-3.5 bg-white/70 border border-navy/5 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Key size={14} className="text-teal" />
                      <h3 className="text-xs font-semibold text-navy">Custom AI API Provider</h3>
                    </div>
                    <span className="text-[10px] text-navy/40 uppercase">OPTIONAL</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')}
                      className="w-full px-2.5 py-1.5 bg-white border border-navy/10 rounded-lg text-navy text-xs outline-none col-span-1"
                    >
                      <option value="gemini">Gemini API</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                    <input
                      type="password"
                      placeholder="Enter API Key to override default"
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-navy/10 rounded-lg text-navy text-xs outline-none focus:border-ocean-400/60 col-span-2"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl bg-white/70 border border-navy/10 text-navy/80 font-semibold text-xs hover:bg-[rgba(23,23,31,0.04)] transition-colors cursor-pointer">
                  Back
                </button>
                <button onClick={handleLaunchSequence} className="flex-1 py-2.5 rounded-xl bg-ocean-600 hover:bg-ocean-700 shadow-[0_8px_24px_rgba(10,132,255,0.35)] text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
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
              className="w-full max-w-xl p-8 glass rounded-3xl !bg-white/80 !backdrop-blur-2xl card-shadow space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-ocean to-teal flex items-center justify-center shadow-sm">
                  <Server size={22} className="text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy">
                    Synthesizing Office Instance
                  </h3>
                  <p className="text-xs text-ocean-600 animate-pulse font-semibold">
                    Running compiler scripts...
                  </p>
                </div>
              </div>

              <div className="relative w-full h-2 bg-[rgba(23,23,31,0.05)] rounded-full overflow-hidden">
                <motion.div
                  className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-ocean-600 via-ocean-400 to-ocean-600 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(currentDeployStep + 1) * 12.5}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="h-[180px] p-4 rounded-xl bg-white/70 border border-navy/5 text-xs text-navy/70 overflow-y-auto space-y-1.5 flex flex-col justify-start font-mono">
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
                        <span className="w-1.5 h-3.5 bg-ocean-500 inline-block animate-pulse ml-0.5 rounded-sm" />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="flex justify-center pt-2">
                <Loader2 className="w-5 h-5 text-ocean-400 animate-spin" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
