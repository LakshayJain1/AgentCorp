'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Sparkles, ArrowRight, ChevronDown, Heart, Coffee, Shield, RefreshCw, Layers, PlayCircle, Check } from 'lucide-react';
import AgentEcosystemIllustration from '@/components/AgentEcosystemIllustration';

export default function LandingPage() {
  const router = useRouter();
  const [activeTeamTab, setActiveTeamTab] = useState<'engineering' | 'product' | 'marketing' | 'research'>('engineering');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  const teamMembers = {
    engineering: [
      { name: 'Mike (Engineer)', status: 'Coding React UI', morale: 94, tools: ['git', 'nextjs', 'tsc'] },
      { name: 'Tina (QA)', status: 'Verifying Router tests', morale: 90, tools: ['jest', 'eslint', 'cypress'] },
      { name: 'Dev-2 (Engineer)', status: 'Spare Pool - Ready', morale: 100, tools: ['git', 'nextjs', 'node'] },
    ],
    product: [
      { name: 'Sam (PM)', status: 'Drafting Spec: v3', morale: 88, tools: ['linear', 'figma', 'notion'] },
      { name: 'Alex (CEO)', status: 'Reviewing proposal priority', morale: 92, tools: ['analytics', 'stripe'] },
    ],
    marketing: [
      { name: 'Chloe (Marketer)', status: 'Drafting Launch Spec', morale: 95, tools: ['seo', 'copy', 'trends'] },
      { name: 'Jack (Sales)', status: 'Auditing outbound templates', morale: 85, tools: ['outreach', 'crd'] },
    ],
    research: [
      { name: 'Sarah (Researcher)', status: 'Analyzing logs archive', morale: 96, tools: ['crawler', 'md-gen'] },
    ],
  };

  const steps = [
    { title: 'Agent Spawning', desc: 'CEO accepts objectives, creates sandboxed directories, and spawns roles.', icon: <Sparkles className="w-5 h-5 text-ocean" />, detail: 'Morale: 100% | CPU Sandbox Isolated' },
    { title: 'Task Decomposition', desc: 'PM splits goal into 5 subtask items in the task queue backlog.', icon: <Layers className="w-5 h-5 text-sky" />, detail: 'Backlog Status: Ready' },
    { title: 'Morale & Energy Tracking', desc: 'HR constantly checks performance metrics, energy drain, and burnout.', icon: <Heart className="w-5 h-5 text-rose-400" />, detail: 'Interval: Every 20 ticks' },
    { title: 'Automatic Cooldown', desc: 'Fatigued agents automatically walk to gaming/coffee zones to recharge.', icon: <Coffee className="w-5 h-5 text-amber-400" />, detail: 'Morale recovery: +2.5% / sec' },
    { title: 'Knowledge Handoff', desc: 'HR spawns backups. Knowledge transfer is completed via memory sync.', icon: <RefreshCw className="w-5 h-5 text-emerald-400" />, detail: 'Sync rate: 100% lossless' },
    { title: 'Validation & Push', desc: 'QA runs compilers, lints routes, and issues pull request approval.', icon: <Shield className="w-5 h-5 text-violet-400" />, detail: 'Checks: tsc, eslint' },
  ];

  const faqs = [
    { q: "How does AgentCorp write code locally?", a: "AgentCorp runs inside a secure local sandbox workspace. It reads files, decomposes architectural needs, compiles via tsc, and automatically fixes syntax errors, committing directly to your local workspace once validation passes." },
    { q: "What keeps agents from writing buggy code?", a: "Our integrated Quality Assurance (QA) loop runs automated tests and lints (eslint) on every iteration. If an error is detected, the stack trace is fed back to the developer agent to debug." },
    { q: "Can I customise the agent roles?", a: "Yes! During onboarding, you define the company name, goals, and role structures. You can adjust agent energy conservation settings, morale triggers, and local connector access settings." },
    { q: "Do I need online accounts to use AgentCorp?", a: "No. You can run AgentCorp entirely locally. To use advanced AI features, configure your Gemini API Key or OpenRouter fallback token in your local .env.local file." },
  ];

  return (
    <div className="min-h-screen bg-paper text-navy antialiased overflow-x-hidden">

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[999] focus:bg-ocean focus:text-white focus:px-4 focus:py-2 focus:rounded-full">Skip to content</a>

      {/* ============ NAV ============ */}
      <header className="fixed top-0 inset-x-0 z-50">
        <nav className="mx-auto max-w-7xl px-3 md:px-6 mt-3">
          <div className={`glass rounded-full shadow-[0_8px_40px_rgba(11,30,51,0.08)] flex items-center justify-between px-3 md:px-4 py-2 transition-all duration-300 ${isScrolled ? 'bg-white/70' : ''}`}>
            <a href="#main" className="flex items-center gap-2 font-display font-bold text-lg text-navy">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-ocean to-teal shadow-[0_0_40px_rgba(0,212,255,0.35)]">
                <span className="h-2.5 w-2.5 rounded-full bg-white" />
              </span>
              AgentCorp
            </a>
            <ul className="hidden md:flex items-center gap-7 text-sm font-medium text-navy/70">
              <li><a href="#landscape" className="hover:text-ocean transition-colors">Ecosystem</a></li>
              <li><a href="#teams" className="hover:text-ocean transition-colors">Agent teams</a></li>
              <li><a href="#lifecycle" className="hover:text-ocean transition-colors">Lifecycle</a></li>
              <li><a href="#dashboard" className="hover:text-ocean transition-colors">Dashboard</a></li>
              <li><a href="#faq" className="hover:text-ocean transition-colors">FAQ</a></li>
            </ul>
            <button
              onClick={() => router.push('/onboard')}
              className="rounded-full bg-navy text-white text-sm font-semibold px-4 py-2 hover:bg-ocean transition-colors cursor-pointer"
            >
              Get started
            </button>
          </div>
        </nav>
      </header>

      <main id="main">

        {/* ============ HERO ============ */}
        <section className="relative section-pad pt-[176px] md:pt-[200px] grid-dots overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-sky/25 blur-[120px] animate-driftSlow" />
          <div aria-hidden="true" className="pointer-events-none absolute top-60 -left-32 h-[420px] w-[420px] rounded-full bg-ocean-300/30 blur-[110px] animate-driftSlow" style={{ animationDelay: '-6s' }} />

          <div className="mx-auto max-w-7xl px-3 md:px-6 relative">
            <div className="grid lg:grid-cols-1 gap-10 lg:gap-6 items-center">

              {/* Copy */}
              <div className="reveal">
                <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-semibold tracking-wide text-ocean shadow-[0_8px_40px_rgba(11,30,51,0.08)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal animate-pulseGlow" />
                  NOW ORCHESTRATING v2.0
                </span>

                <h1 className="mt-4 font-display font-bold text-[2.6rem] leading-[1.08] sm:text-5xl md:text-[3.4rem] lg:text-[3.8rem] tracking-tight text-navy max-w-4xl">
                  Run a self-operating business with
                  <span className="font-serif italic text-ocean"> autonomous agents</span>.
                </h1>

                <p className="mt-5 text-lg text-navy/65 leading-relaxed">
                  Spawn a CEO agent. It hires manager agents. They brief specialists.
                  Work gets planned, built, reviewed, and shipped. You set direction from one dashboard.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => router.push('/onboard')}
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-ocean text-white font-display font-semibold px-6 py-3.5 shadow-[0_0_60px_rgba(0,134,255,0.25)] hover:bg-ocean transition-all hover:-translate-y-0.5 cursor-pointer"
                  >
                    Spawn Your First Virtual Team
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                  <a href="#landscape" className="inline-flex items-center justify-center gap-2 rounded-full glass text-navy font-display font-semibold px-6 py-3.5 shadow-[0_8px_40px_rgba(11,30,51,0.08)] hover:bg-white/80 transition-all">
                    See the ecosystem
                  </a>
                </div>

                <div className="mt-10 flex items-center gap-8 text-sm text-navy/50">
                  <div><span className="font-display font-bold text-navy text-2xl">45k+</span> <span className="text-xs">agents spawned</span></div>
                  <div className="h-8 w-px bg-navy/10" />
                  <div><span className="font-display font-bold text-navy text-2xl">340+</span> <span className="text-xs">teams live</span></div>
                  <div className="h-8 w-px bg-navy/10" />
                  <div><span className="font-display font-bold text-navy text-2xl">1.2s</span> <span className="text-xs">cycle freq</span></div>
                </div>
              </div>



            </div>
          </div>
        </section>

        {/* ============ ECOSYSTEM SIMULATOR ============ */}
        <section id="landscape" className="relative section-pad bg-gradient-to-b from-transparent via-ocean-50 to-transparent">
          <div className="mx-auto max-w-7xl px-3 md:px-6">
            <div className="max-w-2xl reveal">
              <span className="text-xs font-display font-bold tracking-[0.2em] text-ocean">LIVING ECOSYSTEM</span>
              <h2 className="mt-3 font-display font-bold text-3xl md:text-[2.6rem] leading-tight text-navy">
                A Living Ecosystem, <span className="font-serif italic text-ocean">Not Just a Dashboard</span>
              </h2>
              <p className="mt-4 text-navy/60 text-lg leading-relaxed">Step away from corporate charts into an autonomous digital village. Watch agents coordinate, rest, and ship.</p>
            </div>
            <div className="mt-14 reveal">
              <AgentEcosystemIllustration />
            </div>
          </div>
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section id="how" className="relative section-pad" aria-labelledby="how-heading">
          <div className="mx-auto max-w-7xl px-3 md:px-6">
            <div className="max-w-2xl reveal">
              <span className="text-xs font-display font-bold tracking-[0.2em] text-ocean">HOW IT WORKS</span>
              <h2 id="how-heading" className="mt-3 font-display font-bold text-3xl md:text-[2.6rem] leading-tight text-navy">
                One instruction becomes a <span className="font-serif italic text-ocean">running company</span>.
              </h2>
              <p className="mt-4 text-navy/60 text-lg leading-relaxed">Four stages, fully orchestrated.</p>
            </div>

            <div className="mt-16 space-y-8">
              {[
                { num: '01', title: 'Describe the outcome', desc: 'Tell your CEO agent the goal in plain language: "launch a landing page" or "run a content sprint." No workflow builder required.' },
                { num: '02', title: 'The CEO agent staffs the org', desc: 'It breaks the goal into functions, spins up manager agents for each, and sets scope, deadlines, and success criteria.' },
                { num: '03', title: 'Specialists execute in parallel', desc: 'Managers brief specialist agents (copy, design, code, research) who work simultaneously and report progress back up the chain.' },
                { num: '04', title: 'Review, approve, ship', desc: 'Work rolls up to a single dashboard. Approve, request changes, or let the CEO agent auto-ship once quality checks pass.' },
              ].map((step, i) => (
                <div key={i} className="reveal grid md:grid-cols-[80px_1fr] gap-5 md:gap-8 items-start">
                  <div className="flex md:flex-col items-center gap-3 md:gap-2">
                    <div className={`h-14 w-14 rounded-full glass shadow-[0_8px_40px_rgba(11,30,51,0.08)] flex items-center justify-center font-display font-bold ${i === 3 ? 'bg-ocean text-white shadow-[0_0_60px_rgba(0,134,255,0.25)]' : 'text-ocean'}`}>
                      {step.num}
                    </div>
                    {i < 3 && <div className="hidden md:block w-px h-24 bg-gradient-to-b from-ocean-300 to-transparent" />}
                  </div>
                  <div className="glass rounded-[24px] p-6 md:p-8 shadow-[0_8px_40px_rgba(11,30,51,0.08)]">
                    <h3 className="font-display font-bold text-xl text-navy">{step.title}</h3>
                    <p className="mt-2 text-navy/60 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ AGENT TEAMS ============ */}
        <section id="teams" className="relative section-pad bg-gradient-to-b from-transparent via-ocean-50 to-transparent" aria-labelledby="teams-heading">
          <div className="mx-auto max-w-7xl px-3 md:px-6">
            <div className="max-w-2xl reveal">
              <span className="text-xs font-display font-bold tracking-[0.2em] text-ocean">AGENT TEAMS</span>
              <h2 id="teams-heading" className="mt-3 font-display font-bold text-3xl md:text-[2.6rem] leading-tight text-navy">
                Departments that <span className="font-serif italic text-ocean">hire themselves</span>.
              </h2>
              <p className="mt-4 text-navy/60 text-lg leading-relaxed">Each team is a self-contained unit: a manager agent plus specialists, spun up on demand.</p>
            </div>

            {/* Tabs */}
            <div className="mt-14 flex justify-center gap-1 mb-8 max-w-md mx-auto bg-white/70 p-1 rounded-full border border-ocean-100/50 shadow-sm">
              {(['engineering', 'product', 'marketing', 'research'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTeamTab(tab)}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-full transition-all capitalize cursor-pointer ${activeTeamTab === tab ? 'bg-white text-navy shadow-sm' : 'text-navy/40 hover:text-navy/70'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass rounded-[24px] p-6 shadow-[0_8px_40px_rgba(11,30,51,0.08)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-6 bg-ocean rounded-full" />
                    <h3 className="font-display font-bold text-lg text-navy capitalize">{activeTeamTab} Team</h3>
                  </div>
                  <p className="text-navy/50 text-xs mt-3 leading-relaxed">
                    This unit processes local source files, crawls repository definitions, and prepares code structures for integration.
                  </p>
                </div>
                <div className="mt-8 pt-4 border-t border-ocean-100/50 flex items-center justify-between">
                  <span className="text-[10px] text-navy/40 font-semibold uppercase tracking-wider">Avg. Morale</span>
                  <span className="text-xs font-mono font-bold text-emerald-600">92%</span>
                </div>
              </div>

              <div className="md:col-span-2 glass rounded-[24px] p-6 shadow-[0_8px_40px_rgba(11,30,51,0.08)]">
                <h4 className="font-display font-bold text-sm text-navy mb-4">Active Roster & Tasks</h4>
                <div className="space-y-3">
                  {teamMembers[activeTeamTab].map((member, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white/70 border border-ocean-100/30 hover:border-ocean-300/50 transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-ocean-100/50 flex items-center justify-center">
                          <Cpu className="w-5 h-5 text-ocean" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-navy">{member.name}</div>
                          <div className="text-[10px] text-navy/50 mt-0.5">{member.status}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {member.tools.map((tool, idx) => (
                            <span key={idx} className="text-[9px] font-mono text-navy/50 bg-white border border-ocean-100/30 px-1.5 py-0.5 rounded-md">{tool}</span>
                          ))}
                        </div>
                        <div className="h-6 w-px bg-ocean-100/50" />
                        <div className="text-[10px] text-emerald-600 font-mono font-bold flex items-center gap-1">
                          <Heart className="w-3 h-3 fill-current text-rose-400" /> {member.morale}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ LIFECYCLE ============ */}
        <section id="lifecycle" className="relative section-pad" aria-labelledby="lifecycle-heading">
          <div className="mx-auto max-w-7xl px-3 md:px-6">
            <div className="max-w-2xl reveal">
              <span className="text-xs font-display font-bold tracking-[0.2em] text-ocean">PROJECT LIFECYCLE</span>
              <h2 id="lifecycle-heading" className="mt-3 font-display font-bold text-3xl md:text-[2.6rem] leading-tight text-navy">
                From brief to shipped, <span className="font-serif italic text-ocean">continuously</span>.
              </h2>
            </div>

            <div className="mt-14 glass rounded-[24px] p-6 md:p-10 shadow-[0_8px_40px_rgba(11,30,51,0.08)] reveal">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {steps.map((step, idx) => (
                  <div key={idx} className="bg-white/70 rounded-3xl p-6 border border-ocean-100/30 flex flex-col justify-between group hover:border-ocean-300/50 transition-all duration-300">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-ocean-100/50">
                          {step.icon}
                        </div>
                        <span className="font-mono text-ocean-100 group-hover:text-ocean-300 text-4xl font-bold transition-colors">0{idx + 1}</span>
                      </div>
                      <h3 className="font-display font-bold text-navy text-base mt-6">{step.title}</h3>
                      <p className="text-navy/50 text-xs mt-2 leading-relaxed">{step.desc}</p>
                    </div>
                    <div className="mt-6 pt-3 border-t border-ocean-100/30 text-[10px] text-navy/40 font-semibold font-mono flex items-center justify-between">
                      <span>Audit Parameter</span>
                      <span className="text-ocean font-bold">{step.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============ DASHBOARD ============ */}
        <section id="dashboard" className="relative section-pad bg-navy overflow-hidden" aria-labelledby="dashboard-heading">
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] bg-ocean-500/20 blur-[140px]" />

          <div className="mx-auto max-w-7xl px-3 md:px-6 relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 reveal">
                <span className="text-xs font-display font-bold tracking-[0.2em] text-teal">COMMAND CENTER</span>
                <h2 id="dashboard-heading" className="font-display font-bold text-3xl md:text-[2.6rem] leading-tight text-white">
                  Every agent, <span className="font-serif italic text-sky">one screen</span>.
                </h2>
                <p className="text-white/60 text-lg leading-relaxed">Watch the org chart work in real time. Zoom into any agent's task queue, reasoning trace, or output.</p>

                <div className="space-y-4">
                  {[
                    { title: 'Interactive 2D Office Simulator', desc: 'Watch agents navigate between workstations, coffee makers, and meetings.' },
                    { title: 'Live Performance Logs', desc: 'Trace script execution, compiler outputs, and automated PR reviews in real-time.' },
                    { title: 'Integrated Morale Tracking', desc: 'Check agent energy drain levels and automatic replacements instantly.' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 text-teal" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white">{item.title}</h4>
                        <p className="text-[10px] text-white/50 mt-0.5 leading-normal">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.push('/onboard')}
                  className="px-5 py-2.5 bg-white text-navy font-bold text-xs rounded-full transition-all flex items-center gap-1.5 hover:bg-white/90 cursor-pointer"
                >
                  Start Dashboard Preview
                  <PlayCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Dashboard Mockup */}
              <div className="glass-dark rounded-[24px] shadow-2xl p-2 md:p-3 reveal">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                  <span className="ml-3 text-xs text-white/40 font-mono">agentcorp.ai/dashboard</span>
                </div>

                <div className="grid lg:grid-cols-[200px_1fr] gap-3 p-2">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
                    <div className="text-[11px] uppercase tracking-wider text-white/35 px-2 mb-2 font-semibold">Active teams</div>
                    <div className="flex items-center gap-2 rounded-lg bg-ocean/20 px-2.5 py-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-teal animate-pulseGlow" /> Design <span className="ml-auto text-xs text-white/40">4 tasks</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/5">
                      <span className="h-2 w-2 rounded-full bg-sky" /> Engineering <span className="ml-auto text-xs text-white/40">9 tasks</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/5">
                      <span className="h-2 w-2 rounded-full bg-sky" /> Growth <span className="ml-auto text-xs text-white/40">3 tasks</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/5">
                      <span className="h-2 w-2 rounded-full bg-white/30" /> Support <span className="ml-auto text-xs text-white/40">1 task</span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-display font-semibold text-white">CEO Agent: live reasoning</h3>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-teal/15 text-teal font-semibold">Running</span>
                    </div>
                    <div className="space-y-3 font-mono text-[13px] text-white/70 leading-relaxed">
                      <p><span className="text-teal">›</span> Reviewed brief: "Launch product landing page"</p>
                      <p><span className="text-teal">›</span> Assigned Design Mgr → wireframe + visual system</p>
                      <p><span className="text-teal">›</span> Assigned Eng Mgr → build + deploy pipeline</p>
                      <p className="text-white/40"><span className="text-teal">›</span> Waiting on: hero copy approval <span className="inline-block h-3 w-1.5 bg-teal ml-1 animate-pulseGlow align-middle" /></p>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-white/5 p-3">
                        <div className="text-2xl font-display font-bold text-teal">94%</div>
                        <div className="text-xs text-white/40 mt-1">Tasks on schedule</div>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3">
                        <div className="text-2xl font-display font-bold text-sky">17</div>
                        <div className="text-xs text-white/40 mt-1">Active agents</div>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3">
                        <div className="text-2xl font-display font-bold text-white">2.3h</div>
                        <div className="text-xs text-white/40 mt-1">Avg. task time</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ USE CASES ============ */}
        <section className="relative section-pad" aria-labelledby="usecases-heading">
          <div className="mx-auto max-w-7xl px-3 md:px-6">
            <div className="max-w-2xl reveal">
              <span className="text-xs font-display font-bold tracking-[0.2em] text-ocean">USE CASES</span>
              <h2 id="usecases-heading" className="mt-3 font-display font-bold text-3xl md:text-[2.6rem] leading-tight text-navy">
                Built for <span className="font-serif italic text-ocean">real work</span>, not demos.
              </h2>
            </div>

            <div className="mt-14 grid md:grid-cols-2 gap-6 reveal-stagger">
              {[
                { title: 'Solo founders', desc: 'Run a full go-to-market motion covering landing page, launch copy, and outreach, without hiring your first employee.' },
                { title: 'Product teams', desc: 'Offload spec-to-ship busywork so your human team spends time on judgment calls, not tickets.' },
                { title: 'Agencies', desc: 'Spin up a dedicated virtual team per client, scoped and billed independently.' },
                { title: 'Internal ops', desc: 'Automate recurring cross-functional work like reporting, content refreshes, and QA sweeps, all on a schedule.' },
              ].map((useCase, idx) => (
                <div key={idx} className="glass rounded-[24px] p-8 shadow-[0_8px_40px_rgba(11,30,51,0.08)] hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(0,134,255,0.25)] transition-all duration-300">
                  <h3 className="font-display font-bold text-xl text-navy">{useCase.title}</h3>
                  <p className="mt-2 text-navy/60 leading-relaxed">{useCase.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id="faq" className="relative section-pad bg-ocean-50/60" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl px-3 md:px-6">
            <div className="text-center reveal">
              <span className="text-xs font-display font-bold tracking-[0.2em] text-ocean">FAQ</span>
              <h2 id="faq-heading" className="mt-3 font-display font-bold text-3xl md:text-4xl text-navy">Questions, answered</h2>
            </div>

            <div className="mt-12 space-y-3 reveal-stagger">
              {faqs.map((faq, idx) => {
                const isOpen = activeFaq === idx;
                return (
                  <div key={idx} className="glass rounded-[24px] shadow-[0_8px_40px_rgba(11,30,51,0.08)] overflow-hidden transition-all duration-300">
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : idx)}
                      className="w-full py-4 px-6 text-left flex items-center justify-between font-display font-semibold text-navy text-sm cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-ocean transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <div className="px-6 pb-4 text-xs text-navy/60 leading-relaxed border-t border-ocean-100/30 pt-2.5">
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

        {/* ============ CTA ============ */}
        <section className="relative section-pad overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-ocean via-ocean to-navy" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-10 h-72 w-72 rounded-full bg-teal/30 blur-[100px] animate-driftSlow" />

          <div className="mx-auto max-w-4xl px-3 md:px-6 relative text-center reveal">
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white leading-tight">
              Ready to run your <span className="font-serif italic text-sky">virtual company</span>?
            </h2>
            <p className="mt-5 text-white/70 text-lg max-w-xl mx-auto">Set a goal. Watch the org chart build itself. Ship your first project today.</p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push('/onboard')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-ocean font-display font-bold px-7 py-4 shadow-2xl hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(0,212,255,0.35)] transition-all cursor-pointer"
              >
                Spawn Your First Virtual Team
                <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#landscape" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 text-white font-display font-semibold px-7 py-4 hover:bg-white/10 transition-all">
                Explore the ecosystem
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-navy/10 py-10 bg-paper">
        <div className="mx-auto max-w-7xl px-3 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-navy/50">
          <div className="flex items-center gap-2 font-display font-bold text-navy">
            <span className="h-6 w-6 rounded-full bg-gradient-to-br from-ocean to-teal" />
            AgentCorp
          </div>
          <p>&copy; 2026 AgentCorp. Multi-agent orchestration for real work.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-ocean transition-colors">Privacy</a>
            <a href="#" className="hover:text-ocean transition-colors">Terms</a>
            <a href="#" className="hover:text-ocean transition-colors">Status</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
