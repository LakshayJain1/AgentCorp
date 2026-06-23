'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Cpu, Shield, Sparkles,
  Layers, Settings, Share2,
  Play, ArrowDownToLine, Users, Disc, FileText, Check, Folder, Heart,
  ChevronDown, RefreshCw, Coffee, PlayCircle
} from 'lucide-react';
import AgentEcosystemIllustration from '@/components/AgentEcosystemIllustration';

export default function LandingPage() {
  const router = useRouter();
  const [activeTeamTab, setActiveTeamTab] = useState<'engineering' | 'product' | 'marketing' | 'research'>('engineering');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const teamMembers = {
    engineering: [
      { name: 'Mike (Engineer)', status: 'Coding React UI', morale: 94, tools: ['git', 'nextjs', 'tsc'], color: 'text-amber-500 bg-amber-50' },
      { name: 'Tina (QA)', status: 'Verifying Router tests', morale: 90, tools: ['jest', 'eslint', 'cypress'], color: 'text-violet-500 bg-violet-50' },
      { name: 'Dev-2 (Engineer)', status: 'Spare Pool - Ready', morale: 100, tools: ['git', 'nextjs', 'node'], color: 'text-emerald-500 bg-emerald-50' },
    ],
    product: [
      { name: 'Sam (PM)', status: 'Drafting Spec: v3', morale: 88, tools: ['linear', 'figma', 'notion'], color: 'text-cyan-500 bg-cyan-50' },
      { name: 'Alex (CEO)', status: 'Reviewing proposal priority', morale: 92, tools: ['analytics', 'stripe'], color: 'text-red-500 bg-red-50' },
    ],
    marketing: [
      { name: 'Chloe (Marketer)', status: 'Drafting Launch Spec', morale: 95, tools: ['seo', 'copy', 'trends'], color: 'text-rose-500 bg-rose-50' },
      { name: 'Jack (Sales)', status: 'Auditing outbound templates', morale: 85, tools: ['outreach', 'crd'], color: 'text-blue-500 bg-blue-50' },
    ],
    research: [
      { name: 'Sarah (Researcher)', status: 'Analyzing logs archive', morale: 96, tools: ['crawler', 'md-gen'], color: 'text-purple-500 bg-purple-50' },
    ],
  };

  const steps = [
    {
      title: 'Agent Spawning',
      desc: 'CEO accepts objectives, creates sandboxed directories, and spawns roles.',
      icon: <Sparkles className="w-5 h-5 text-sky-500" />,
      detail: 'Morale: 100% | CPU Sandbox Isolated'
    },
    {
      title: 'Task Decomposition',
      desc: 'PM splits goal into 5 subtask items in the task queue backlog.',
      icon: <Layers className="w-5 h-5 text-cyan-500" />,
      detail: 'Backlog Status: Ready'
    },
    {
      title: 'Morale & Energy Tracking',
      desc: 'HR constantly checks performance metrics, energy drain, and burnout.',
      icon: <Heart className="w-5 h-5 text-rose-500" />,
      detail: 'Interval: Every 20 ticks'
    },
    {
      title: 'Automatic Cooldown',
      desc: 'Fatigued agents automatically walk to gaming/coffee zones to recharge.',
      icon: <Coffee className="w-5 h-5 text-amber-500" />,
      detail: 'Morale recovery: +2.5% / sec'
    },
    {
      title: 'Knowledge Handoff',
      desc: 'HR spawns backups. Knowledge transfer is completed via memory sync.',
      icon: <RefreshCw className="w-5 h-5 text-emerald-500" />,
      detail: 'Sync rate: 100% lossless'
    },
    {
      title: 'Validation & Push',
      desc: 'QA runs compilers, lints routes, and issues pull request approval.',
      icon: <Shield className="w-5 h-5 text-violet-500" />,
      detail: 'Checks: tsc, eslint'
    }
  ];

  const faqs = [
    {
      q: "How does AgentCorp write code locally?",
      a: "AgentCorp runs inside a secure local sandbox workspace. It reads files, decomposes architectural needs, compiles via tsc, and automatically fixes syntax errors, committing directly to your local workspace once validation passes."
    },
    {
      q: "What keeps agents from writing buggy code?",
      a: "Our integrated Quality Assurance (QA) loop runs automated tests and lints (`eslint`) on every iteration. If an error is detected, the stack trace is fed back to the developer agent to debug. The cycle repeats up to 3 times before requiring human review."
    },
    {
      q: "Can I customise the agent roles?",
      a: "Yes! During onboarding, you define the company name, goals, and role structures. You can adjust agent energy conservation settings, morale triggers, and local connector access settings."
    },
    {
      q: "Do I need online accounts to use AgentCorp?",
      a: "No. You can run AgentCorp entirely locally. To use advanced AI features, configure your Gemini API Key or OpenRouter fallback token in your local `.env.local` file."
    }
  ];

  return (
    <div className="min-h-screen bg-ghibli-sky text-[#0F172A] relative selection:bg-sky-100 font-sans">

      {/* Sunlight Glow Background effect */}
      <div className="absolute top-0 left-0 right-0 h-[600px] bg-sunlight-glow pointer-events-none z-0" />

      {/* Floating Header */}
      <header className={`fixed top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-5xl z-50 transition-all duration-300 ${isScrolled ? 'floating-pill py-2.5 px-4 md:px-6 rounded-full' : 'py-4 px-2'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-white shadow-md">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="font-sans font-bold text-sm tracking-tight text-gray-900">AgentCorp</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs text-slate-500 font-semibold">
            <a href="#landscape" className="hover:text-sky-500 transition-colors">Ecosystem</a>
            <a href="#teams" className="hover:text-sky-500 transition-colors">Agent Teams</a>
            <a href="#lifecycle" className="hover:text-sky-500 transition-colors">Lifecycle</a>
            <a href="#dashboard" className="hover:text-sky-500 transition-colors">Workspace OS</a>
            <a href="#faq" className="hover:text-sky-500 transition-colors">FAQs</a>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-slate-100 rounded-full transition-colors hidden sm:inline-block"
              title="Discord"
            >
              <Disc className="w-4 h-4 text-[#5865F2]" />
            </a>
            <button
              onClick={() => router.push('/onboard')}
              className="glow-btn px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 text-white font-bold text-xs transition-colors shadow-sm shadow-sky-400/25 cursor-pointer"
            >
              Launch Setup
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 max-w-6xl mx-auto w-full flex flex-col lg:flex-row items-center gap-12 z-10">

        {/* Left text column */}
        <div className="flex-1 text-left space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            An entire company running itself
          </div>

          <h1 className="font-sans font-extrabold text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-slate-900">
            Run a self-operating business with <span className="gradient-text-sky italic font-serif font-normal">autonomous agents</span>
          </h1>

          <p className="text-slate-500 text-base md:text-lg max-w-xl font-normal leading-relaxed">
            Welcome to a living digital ecosystem. Define your company, assign high-level goals, and watch your automated workforce brainstorm, write scripts, audit code quality, and launch deliverables locally.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => router.push('/onboard')}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-full transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              Launch Agent Setup
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#landscape"
              className="px-6 py-3 border border-slate-200 bg-white/60 hover:bg-white text-slate-700 font-bold text-sm rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Explore Landscape
            </a>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200/60 max-w-md">
            <div>
              <div className="text-2xl font-bold text-slate-900">45k+</div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Agents Spawned</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">100%</div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Locally Sandboxed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">1.2s</div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Cycle Frequency</div>
            </div>
          </div>
        </div>

        {/* Right visualization column */}
        <div className="w-full lg:w-[460px] shrink-0">
          <AgentEcosystemIllustration />
        </div>
      </section>

      {/* Section: Landscape Vector Art */}
      <section id="landscape" className="py-24 bg-white/50 border-y border-sky-100/50 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 w-full flex flex-col items-center">

          <div className="text-center space-y-4 max-w-2xl mb-12">
            <h2 className="font-sans font-extrabold text-3xl md:text-5xl text-slate-900 tracking-tight">
              A Living Ecosystem, <span className="font-serif italic font-normal text-sky-500">Not Just a Dashboard</span>
            </h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Step away from corporate charts and entering an autonomous, nature-tech digital village. Watch agents gather at meeting centers, rest near coffee hubs, and coordinate via pathfinding routes.
            </p>
          </div>

          {/* Ghibli Vector Landscape Container */}
          <div className="w-full h-[240px] md:h-[340px] bg-gradient-to-b from-[#E0F2FE] to-[#F0FDFA] rounded-3xl relative overflow-hidden border border-sky-100 shadow-inner flex items-end">

            {/* Sun in the background */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-12 w-48 h-48 rounded-full bg-amber-100/30 blur-2xl pointer-events-none" />

            {/* Clouds floating */}
            <motion.div
              animate={{ x: [0, 80, 0] }}
              transition={{ repeat: Infinity, duration: 40, ease: 'linear' }}
              className="absolute top-8 left-12 w-20 h-8 bg-white/80 rounded-full blur-sm"
            />
            <motion.div
              animate={{ x: [0, -60, 0] }}
              transition={{ repeat: Infinity, duration: 32, ease: 'linear' }}
              className="absolute top-16 right-20 w-28 h-10 bg-white/60 rounded-full blur-sm"
            />

            {/* Simulated Data Streams / Pulses (Nature Tech Windmills) */}
            <div className="absolute left-[20%] bottom-16 flex flex-col items-center group">
              {/* Windmill blades spinning */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
                className="w-14 h-14 border-t-2 border-r-2 border-emerald-400/60 rounded-full absolute -top-7"
              />
              <div className="w-1.5 h-16 bg-slate-400/40 rounded-full" />
              <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-2 border border-emerald-100 font-semibold font-mono">CEO Office</span>
            </div>

            <div className="absolute right-[25%] bottom-16 flex flex-col items-center group">
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                className="w-12 h-12 border-b-2 border-l-2 border-sky-400/60 rounded-full absolute -top-6"
              />
              <div className="w-1.5 h-14 bg-slate-400/40 rounded-full" />
              <span className="text-[9px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded mt-2 border border-sky-100 font-semibold font-mono">Dev Hub</span>
            </div>

            {/* Central path network overlay */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 20% 85% C 35% 75%, 65% 75%, 75% 85%" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="3" fill="none" />
              <path d="M 50% 85% L 50% 68%" stroke="rgba(14, 165, 233, 0.2)" strokeWidth="2.5" fill="none" />
              <circle cx="50%" cy="68%" r="4" fill="#0ea5e9" className="animate-ping" />
            </svg>

            {/* Landscape hills / mountains bottom overlap */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-emerald-100/80 to-teal-50/50 flex items-center justify-around px-12 z-10 border-t border-emerald-100/20">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Morale Level: Stable
              </div>
              <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                Network Traffic: Nominal
              </div>
              <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Energy Usage: Eco
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Bento Grid: Agent Teams */}
      <section id="teams" className="py-24 max-w-6xl mx-auto px-6 w-full">
        <div className="text-center space-y-4 max-w-xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1 bg-sky-50 text-sky-600 px-3 py-1 rounded-full text-xs font-semibold border border-sky-100">
            Workforces
          </div>
          <h2 className="font-sans font-extrabold text-3xl md:text-5xl text-slate-900 tracking-tight">
            Specialised <span className="font-serif italic font-normal text-sky-500">Agent Teams</span>
          </h2>
          <p className="text-slate-400 text-sm">
            AgentCorp splits work across 4 departments. Click to inspect current agents and live stats.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex justify-center gap-1 mb-8 max-w-md mx-auto bg-slate-100 p-1 rounded-full border border-slate-200/50">
          {(['engineering', 'product', 'marketing', 'research'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTeamTab(tab)}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-full transition-all capitalize cursor-pointer ${activeTeamTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Dynamic Bento Cards Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Card 1: Team summary details */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 bg-sky-500 rounded-full" />
                <h3 className="font-sans font-bold text-lg text-slate-900 capitalize">{activeTeamTab} Team</h3>
              </div>
              <p className="text-slate-400 text-xs mt-3 leading-relaxed">
                This unit processes local source files, crawls repository definitions, and prepares code structures for integration.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Morale morae</span>
              <span className="text-xs font-mono font-bold text-emerald-600">92% Average</span>
            </div>
          </div>

          {/* Card 2: List of active agent nodes */}
          <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h4 className="font-sans font-bold text-sm text-slate-800 mb-4">Active Roster & Tasks</h4>
            <div className="space-y-3">
              {teamMembers[activeTeamTab].map((member, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-800">
                      <Cpu className="w-5 h-5 text-sky-500" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-800">{member.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{member.status}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Tool Badges */}
                    <div className="flex gap-1">
                      {member.tools.map((tool, idx) => (
                        <span key={idx} className="text-[9px] font-mono text-slate-500 bg-white border border-slate-100 px-1.5 py-0.5 rounded-md">
                          {tool}
                        </span>
                      ))}
                    </div>
                    <div className="h-6 w-px bg-slate-200" />
                    <div className="text-[10px] text-emerald-600 font-mono font-bold flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-current text-rose-400" /> {member.morale}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Section: Agent Lifecycle Timeline */}
      <section id="lifecycle" className="py-24 bg-[#F4F7FB]/60 border-y border-slate-200/40">
        <div className="max-w-6xl mx-auto px-6 w-full">

          <div className="text-center space-y-4 max-w-xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-100">
              Operations Loop
            </div>
            <h2 className="font-sans font-extrabold text-3xl md:text-5xl text-slate-900 tracking-tight">
              The Agent <span className="font-serif italic font-normal text-emerald-500">Lifecycle</span>
            </h2>
            <p className="text-slate-400 text-sm">
              Watch how our HR operations coordinate agent happiness, rest, and knowledge preservation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((step, idx) => (
              <div key={idx} className="bg-white rounded-3xl p-6 border border-slate-200/50 shadow-sm flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                      {step.icon}
                    </div>
                    <span className="font-mono text-slate-200 group-hover:text-slate-300 text-4xl font-bold transition-colors">0{idx + 1}</span>
                  </div>
                  <h3 className="font-sans font-bold text-slate-800 text-base mt-6">{step.title}</h3>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">{step.desc}</p>
                </div>
                <div className="mt-6 pt-3 border-t border-slate-50 text-[10px] text-slate-400 font-semibold font-mono flex items-center justify-between">
                  <span>Audit Parameter</span>
                  <span className="text-sky-500 font-bold">{step.detail}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Section: Company OS Dashboard Showcase */}
      <section id="dashboard" className="py-24 max-w-6xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          <div className="space-y-6">
            <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-xs font-semibold border border-rose-100">
              Autonomous OS
            </div>
            <h2 className="font-sans font-extrabold text-3xl md:text-5xl text-slate-900 tracking-tight">
              Manage your entire company <span className="font-serif italic font-normal text-sky-500">from one tab</span>
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              No complex terminal commands or messy configurations. Launch the Agent Setup wizard, specify your business, and interact via a beautifully simplified sensory GUI panel.
            </p>

            <div className="space-y-4">
              {[
                { title: 'Interactive 2D Office Simulator', desc: 'Watch agents navigate between workstations, coffee makers, and meetings.' },
                { title: 'Live Performance Logs', desc: 'Trace script execution, compiler outputs, and automated PR reviews in real-time.' },
                { title: 'Integrated Morale Tracking', desc: 'Check agent energy drain levels and automatic replacements instantly.' }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">{item.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={() => router.push('/onboard')}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Start Dashboard Preview
                <PlayCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Premium Apple-Polish Dashboard Mockup */}
          <div className="bg-slate-900 rounded-3xl p-4 md:p-6 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-slate-500 font-mono ml-3 uppercase">AgentCorp.app/workspace</span>
              </div>
              <span className="text-[9px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full font-bold">1.2x Simulator</span>
            </div>

            {/* Dashboard grid preview mockup */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[9px] text-slate-500 font-bold uppercase"> MORALE Morale</span>
                <div className="text-xl font-bold text-emerald-400 mt-1">94%</div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '94%' }} />
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[9px] text-slate-500 font-bold uppercase">Tasks Resolved</span>
                <div className="text-xl font-bold text-sky-400 mt-1">112 / 115</div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-sky-400 rounded-full" style={{ width: '97%' }} />
                </div>
              </div>
            </div>

            {/* Live Terminal ticker box */}
            <div className="mt-4 bg-slate-950 p-3 rounded-2xl border border-slate-800/80 font-mono text-[9px] text-slate-400 space-y-1">
              <div className="text-sky-400 flex items-center justify-between border-b border-slate-900 pb-1 mb-1 font-bold">
                <span>SYSTEM LOGS</span>
                <span>Active</span>
              </div>
              <div className="truncate text-slate-400">$ tsc --noEmit && eslint .</div>
              <div className="text-emerald-500 font-bold">✓ Compilation complete. 0 Errors.</div>
              <div className="truncate">$ git commit -m "feature: auth migration complete"</div>
            </div>

            {/* Float sun logo overlay */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />
          </div>

        </div>
      </section>

      {/* Section: Industry Use Cases */}
      <section className="py-24 bg-white border-t border-sky-100/50">
        <div className="max-w-6xl mx-auto px-6 w-full">
          <div className="text-center space-y-4 max-w-xl mx-auto mb-16">
            <h2 className="font-sans font-extrabold text-3xl md:text-5xl text-slate-900 tracking-tight">
              Tailored for <span className="font-serif italic font-normal text-emerald-500">Every Business</span>
            </h2>
            <p className="text-slate-400 text-sm">
              Explore how AgentCorp automates operations across different industries.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'SaaS Startup', desc: 'Deploy new UI landing pages, test auth routers, and release scripts autonomously.' },
              { title: 'Digital Agency', desc: 'Automate content updates, write client summaries, and monitor project timelines.' },
              { title: 'E-commerce Brand', desc: 'Audit system databases, scrape competitor prices, and log inventory sync feeds.' },
              { title: 'Content Studio', desc: 'Research target topics, generate formatted markdown reports, and verify SEO scores.' },
              { title: 'Game Studio', desc: 'Initialize interactive canvas frameworks, script sprites, and run integrity tests.' },
              { title: 'Research Lab', desc: 'Scan research publications, structure research summaries, and compile metrics.' }
            ].map((useCase, idx) => (
              <div key={idx} className="p-6 bg-slate-50 hover:bg-white rounded-3xl border border-slate-100 hover:border-sky-200/50 transition-all duration-300 shadow-sm flex flex-col justify-between group cursor-pointer">
                <div>
                  <h3 className="font-sans font-bold text-slate-800 text-base group-hover:text-sky-600 transition-colors">{useCase.title}</h3>
                  <p className="text-slate-400 text-xs mt-2.5 leading-relaxed">{useCase.desc}</p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-[10px] text-sky-500 font-bold font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section: Accordion FAQ */}
      <section id="faq" className="py-24 bg-[#F4F7FB]/60 border-t border-slate-200/40">
        <div className="max-w-4xl mx-auto px-6 w-full">

          <div className="text-center space-y-4 max-w-xl mx-auto mb-16">
            <h2 className="font-sans font-extrabold text-3xl md:text-5xl text-slate-900 tracking-tight">
              Frequently Asked <span className="font-serif italic font-normal text-sky-500">Questions</span>
            </h2>
            <p className="text-slate-400 text-sm">
              Everything you need to know about the AgentCorp local operating system.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200/40 shadow-sm overflow-hidden transition-all duration-300">
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full py-4 px-5 text-left flex items-center justify-between font-sans font-bold text-slate-800 text-xs md:text-sm cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <div className="px-5 pb-4 text-xs text-slate-500 leading-relaxed border-t border-slate-50 pt-2.5">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-24 max-w-5xl mx-auto px-6 w-full text-center relative">
        <div className="bg-gradient-to-r from-sky-500 to-emerald-400 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden flex flex-col items-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

          <span className="bg-white/20 text-white font-bold text-[10px] uppercase px-3 py-1 rounded-full border border-white/20 tracking-wider">
            GET STARTED NOW
          </span>
          <h2 className="font-sans font-extrabold text-3xl md:text-5xl mt-6 max-w-xl leading-tight">
            Spawn your first virtual team today
          </h2>
          <p className="text-white/80 text-sm mt-3 max-w-md">
            Set objectives, configure secure directories, and launch an entire autonomous workspace.
          </p>

          <button
            onClick={() => router.push('/onboard')}
            className="mt-8 px-6 py-3 bg-white text-slate-900 font-bold text-xs rounded-full hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow shadow-emerald-500/20 cursor-pointer"
          >
            Launch Agent Setup
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16 px-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">

          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-white font-bold text-xs">
                C
              </div>
              <span className="font-sans font-bold text-white text-sm">AgentCorp</span>
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              An innovative workspace of AI agents collaborating in real-time. Just assign goals, and watch your automated workforce research, build, test, and deploy.
            </p>
          </div>

          <div>
            <h4 className="font-sans font-bold text-white text-xs uppercase tracking-wider mb-4">Navigations</h4>
            <ul className="space-y-2.5 text-xs text-slate-500 font-semibold">
              <li><a href="#landscape" className="hover:text-white transition-colors">Ecosystem Map</a></li>
              <li><a href="#teams" className="hover:text-white transition-colors">Agent Teams</a></li>
              <li><a href="#lifecycle" className="hover:text-white transition-colors">Lifecycle Timeline</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-sans font-bold text-white text-xs uppercase tracking-wider mb-4">Community</h4>
            <ul className="space-y-2.5 text-xs text-slate-500 font-semibold">
              <li><a href="https://discord.com" className="hover:text-white transition-colors">Discord Guild</a></li>
              <li><a href="https://github.com" className="hover:text-white transition-colors">GitHub Repository</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Developer SDK</a></li>
            </ul>
          </div>

        </div>

        <div className="max-w-6xl mx-auto border-t border-slate-800/80 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-600 font-semibold">
          <span>&copy; 2026 AgentCorp Inc. All rights reserved.</span>
          <span className="flex gap-4 mt-3 sm:mt-0">
            <a href="#" className="hover:text-slate-400">Privacy Policy</a>
            <a href="#" className="hover:text-slate-400">Terms of Service</a>
          </span>
        </div>
      </footer>

    </div>
  );
}

