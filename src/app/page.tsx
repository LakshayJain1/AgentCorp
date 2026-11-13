'use client';

import { useState, useEffect } from 'react';
import BrandLogo from '@/components/BrandLogo'
import { useRouter } from 'next/navigation';
import { useAuthUser } from '@/hooks/useAuthUser';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, ArrowRight, ChevronDown, Heart, PlayCircle, Check, Monitor, Menu } from 'lucide-react';
import HeroOrchestrationPanel from '@/components/HeroOrchestrationPanel';

const SPRING = { type: 'spring', bounce: 0, duration: 0.55 } as const;

export default function LandingPage() {
  const router = useRouter();
  // Signed-in visitors go straight to their workspace (it sends them to onboarding if they have none yet).
  const { user } = useAuthUser();
  const startHref = user ? '/workspace' : '/onboard';
  const [activeTeamTab, setActiveTeamTab] = useState<'engineering' | 'product' | 'marketing' | 'research'>('engineering');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
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
    }, { threshold: 0.12, rootMargin: '0px 0px -48px 0px' });
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

  const lifecycleSteps = [
    { num: '01', title: 'Agent Spawning', desc: 'CEO accepts objectives, creates sandboxed directories, and spawns roles.', detail: 'Morale: 100% | CPU Sandbox Isolated' },
    { num: '02', title: 'Task Decomposition', desc: 'PM splits goal into 5 subtask items in the task queue backlog.', detail: 'Backlog Status: Ready' },
    { num: '03', title: 'Morale & Energy Tracking', desc: 'HR constantly checks performance metrics, energy drain, and burnout.', detail: 'Interval: Every 20 ticks' },
    { num: '04', title: 'Automatic Cooldown', desc: 'Fatigued agents automatically walk to gaming/coffee zones to recharge.', detail: 'Morale recovery: +2.5% / sec' },
    { num: '05', title: 'Knowledge Handoff', desc: 'HR spawns backups. Knowledge transfer is completed via memory sync.', detail: 'Sync rate: 100% lossless' },
    { num: '06', title: 'Validation & Push', desc: 'QA runs compilers, lints routes, and issues pull request approval.', detail: 'Checks: tsc, eslint' },
  ];

  const faqs = [
    { q: "How does AgentCorp write code locally?", a: "AgentCorp runs inside a secure local sandbox workspace. It reads files, decomposes architectural needs, compiles via tsc, and automatically fixes syntax errors, committing directly to your local workspace once validation passes." },
    { q: "What keeps agents from writing buggy code?", a: "Our integrated Quality Assurance (QA) loop runs automated tests and lints (eslint) on every iteration. If an error is detected, the stack trace is fed back to the developer agent to debug." },
    { q: "Can I customise the agent roles?", a: "Yes! During onboarding, you define the company name, goals, and role structures. You can adjust agent energy conservation settings, morale triggers, and local connector access settings." },
    { q: "Do I need online accounts to use AgentCorp?", a: "No. You can run AgentCorp entirely locally. To use advanced AI features, configure your Gemini API Key or OpenRouter fallback token in your local .env.local file." },
  ];

  const navLinks = [
    { href: '#how', label: 'How it works' },
    { href: '#teams', label: 'Agent teams' },
    { href: '#lifecycle', label: 'Lifecycle' },
    { href: '#dashboard', label: 'Dashboard' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <div className="min-h-screen bg-paper text-navy antialiased overflow-x-hidden font-sans">

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[999] focus:bg-ocean focus:text-white focus:px-4 focus:py-2 focus:rounded">Skip to content</a>

      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50">
        <nav className="mx-auto max-w-6xl px-4 md:px-6 mt-3">
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={SPRING}
            className={`glass rounded-full flex items-center justify-between pl-2 pr-2 py-1.5 transition-all duration-500 ${isScrolled ? 'bg-white/75 shadow-[var(--shadow-lift)]' : 'bg-white/40'}`}
          >
            <a href="#main" className="flex items-center gap-2.5 font-display font-bold text-[17px] text-navy pl-2 pr-4">
              <BrandLogo size={32} priority />
              AgentCorp
            </a>

            <ul className="hidden md:flex items-center gap-1 text-[13px] font-medium text-navy/60">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="px-3 py-2 rounded hover:text-navy hover:bg-white/70 transition-colors duration-200">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <a
                href="/download"
                className="hidden md:inline-flex items-center gap-1.5 rounded text-navy/60 text-[13px] font-medium px-3 py-2 hover:text-navy hover:bg-white/70 transition-all cursor-pointer"
              >
                <Monitor className="w-4 h-4" />
                Desktop App
              </a>
              <button
                onClick={() => router.push(startHref)}
                className="rounded bg-navy text-white text-[13px] font-semibold px-4 py-2 hover:bg-ocean-600 transition-colors duration-200 cursor-pointer"
              >
                {user ? 'Open workspace' : 'Get started'}
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
                className="md:hidden p-2 rounded hover:bg-white/70 transition-colors cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="md:hidden mt-2 glass rounded-xl p-2"
              >
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-navy/70 hover:bg-white/70 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <a href="/download" className="block px-4 py-3 rounded-lg text-sm font-medium text-navy/70 hover:bg-white/70 transition-colors">
                  Desktop App
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </header>

      <main id="main">

        {/* HERO */}
        <section className="relative pt-[168px] md:pt-[196px] pb-16 md:pb-24">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="grid lg:grid-cols-[2fr_3fr] gap-10 xl:gap-14 items-center">

              {/* Left: copy */}
              <div>
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                  className="eyebrow text-ocean-600"
                >
                  Autonomous Business Orchestration
                </motion.p>

                <motion.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.65, delay: 0.08 }}
                  className="display-hero text-navy mt-4 leading-[1.06]"
                >
                  One goal.<br />
                  <span className="text-ocean-600">An entire company.</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.6, delay: 0.16 }}
                  className="prose-body mt-5 max-w-sm"
                >
                  Give AgentCorp an objective. Your AI CEO builds the team, delegates the work and gets things done.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.55, delay: 0.24 }}
                  className="mt-8 flex flex-col sm:flex-row gap-3"
                >
                  <button
                    onClick={() => router.push(startHref)}
                    className="btn-primary"
                  >
                    Launch Your First Task
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <a href="#how" className="btn-ghost">
                    See How It Works
                  </a>
                </motion.div>
              </div>

              {/* Right: product panel */}
              <div>
                <HeroOrchestrationPanel />
              </div>

            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="relative section-pad" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="max-w-2xl reveal">
              <span className="eyebrow text-ocean-600">How it works</span>
              <h2 id="how-heading" className="display-title mt-3 text-navy">
                One instruction becomes a running company.
              </h2>
              <p className="prose-body mt-4">Four stages, fully orchestrated.</p>
            </div>

            <div className="mt-16 grid md:grid-cols-2 gap-4">
              {[
                { num: '01', title: 'Describe the outcome', desc: 'Tell your CEO agent the goal in plain language: "launch a landing page" or "run a content sprint." No workflow builder required.' },
                { num: '02', title: 'The CEO agent staffs the org', desc: 'It breaks the goal into functions, spins up manager agents for each, and sets scope, deadlines, and success criteria.' },
                { num: '03', title: 'Specialists execute in parallel', desc: 'Managers brief specialist agents (copy, design, code, research) who work simultaneously and report progress back up the chain.' },
                { num: '04', title: 'Review, approve, ship', desc: 'Work rolls up to a single dashboard. Approve, request changes, or let the CEO agent auto-ship once quality checks pass.' },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ ...SPRING, delay: i * 0.06 }}
                  className="glass rounded-xl p-7 md:p-8 group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center font-display font-bold text-sm ${i === 3 ? 'bg-ocean-600 text-white shadow-sm' : 'bg-white text-ocean-600 shadow-sm border border-navy/5'}`}>
                      {step.num}
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-[17px] text-navy tracking-tight">{step.title}</h3>
                      <p className="prose-sm mt-1.5">{step.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* AGENT TEAMS */}
        <section id="teams" className="relative section-pad bg-gradient-to-b from-transparent via-ocean-50/60 to-transparent" aria-labelledby="teams-heading">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="max-w-2xl reveal">
              <h2 id="teams-heading" className="display-title text-navy">
                Departments that hire themselves.
              </h2>
              <p className="prose-body mt-4">Each team is a self-contained unit: a manager agent plus specialists, spun up on demand.</p>
            </div>

            {/* Tabs */}
            <div className="mt-14 flex justify-center mb-8">
              <div className="flex gap-1 p-1 rounded-full glass">
                {(['engineering', 'product', 'marketing', 'research'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTeamTab(tab)}
                    className={`relative px-4 py-2 text-xs font-semibold rounded-full transition-colors duration-200 capitalize cursor-pointer ${
                      activeTeamTab === tab ? 'text-white' : 'text-navy/50 hover:text-navy/80'
                    }`}
                  >
                    {activeTeamTab === tab && (
                      <motion.span
                        layoutId="teamTab"
                        className="absolute inset-0 bg-navy rounded-full shadow-sm"
                        transition={SPRING}
                      />
                    )}
                    <span className="relative z-10">{tab}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-5 bg-ocean-600 rounded-full" />
                    <h3 className="font-display font-semibold text-[17px] text-navy capitalize">{activeTeamTab} Team</h3>
                  </div>
                  <p className="prose-sm mt-3">
                    This unit processes local source files, crawls repository definitions, and prepares code structures for integration.
                  </p>
                </div>
                <div className="mt-8 pt-4 flex items-center justify-between">
                  <span className="text-[11px] text-navy/40 font-semibold uppercase tracking-wider">Avg. Morale</span>
                  <span className="text-xs font-mono font-bold text-emerald-600">92%</span>
                </div>
              </div>

              <div className="md:col-span-2 glass rounded-xl p-6">
                <h4 className="font-display font-semibold text-sm text-navy mb-4">Active Roster &amp; Tasks</h4>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTeamTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-2.5"
                  >
                    {teamMembers[activeTeamTab].map((member, i) => (
                      <div
                        key={i}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-white/70 border border-navy/5 hover:border-ocean-300/50 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <Cpu className="w-4 h-4 text-ocean-600 shrink-0" />
                          <div>
                            <div className="font-bold text-[13px] text-navy">{member.name}</div>
                            <div className="text-[11px] text-navy/50 mt-0.5">{member.status}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            {member.tools.map((tool, idx) => (
                              <span key={idx} className="text-[10px] font-mono text-navy/50 bg-white border border-navy/5 px-1.5 py-0.5 rounded">{tool}</span>
                            ))}
                          </div>
                          <div className="h-6 w-px bg-navy/10" />
                          <div className="text-[11px] text-emerald-600 font-mono font-bold flex items-center gap-1">
                            <Heart className="w-3 h-3 fill-current text-rose-400" /> {member.morale}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* LIFECYCLE */}
        <section id="lifecycle" className="relative section-pad" aria-labelledby="lifecycle-heading">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="max-w-2xl reveal">
              <h2 id="lifecycle-heading" className="display-title text-navy">
                From brief to shipped, continuously.
              </h2>
              <p className="prose-body mt-4">Six stages run in sequence, fully automated.</p>
            </div>

            <div className="mt-14 grid sm:grid-cols-2 gap-x-10 gap-y-0 reveal">
              {lifecycleSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex gap-5 py-5 border-b border-navy/8 last:border-0 sm:[&:nth-last-child(2)]:border-0"
                >
                  <div className="font-mono text-[11px] font-bold text-ocean-600 w-7 shrink-0 pt-0.5">{step.num}</div>
                  <div className="flex-1">
                    <h3 className="font-display font-semibold text-navy text-[15px]">{step.title}</h3>
                    <p className="prose-sm mt-1">{step.desc}</p>
                    <p className="text-[11px] font-mono text-navy/40 mt-2">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DASHBOARD / COMMAND CENTER */}
        <section id="dashboard" className="relative section-pad bg-navy overflow-hidden" aria-labelledby="dashboard-heading">
          <div className="mx-auto max-w-6xl px-4 md:px-6 relative">
            <div className="grid lg:grid-cols-2 gap-14 items-center">
              <div className="space-y-7 reveal">
                <h2 id="dashboard-heading" className="display-title text-white">
                  Every agent, one screen.
                </h2>
                <p className="text-white/60 text-lg leading-relaxed tracking-[-0.01em]">Watch the org chart work in real time. Zoom into any agent&apos;s task queue, reasoning trace, or output.</p>

                <div className="space-y-5">
                  {[
                    { title: 'Interactive 2D Office Simulator', desc: 'Watch agents navigate between workstations, coffee makers, and meetings.' },
                    { title: 'Live Performance Logs', desc: 'Trace script execution, compiler outputs, and automated PR reviews in real-time.' },
                    { title: 'Integrated Morale Tracking', desc: 'Check agent energy drain levels and automatic replacements instantly.' },
                  ].map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ ...SPRING, delay: idx * 0.08 }}
                      className="flex gap-3.5"
                    >
                      <Check className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-[13px] text-white">{item.title}</h4>
                        <p className="text-[12px] text-white/50 mt-1 leading-normal">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <button
                  onClick={() => router.push(startHref)}
                  className="btn-white text-sm px-5 py-2.5"
                >
                  Start Dashboard Preview
                  <PlayCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Dashboard Mockup */}
              <div className="glass-dark rounded-xl p-2 md:p-3 reveal">
                <div className="flex items-center px-3 py-2.5">
                  <span className="ml-1 text-xs text-white/40 font-mono">agentcorp.ai/dashboard</span>
                </div>

                <div className="grid lg:grid-cols-[200px_1fr] gap-3 p-2">
                  <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-1">
                    <div className="text-[11px] uppercase tracking-wider text-white/35 px-2 mb-2 font-semibold">Active teams</div>
                    <div className="flex items-center gap-2 rounded-lg bg-ocean-500/20 px-2.5 py-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-teal animate-pulseGlow" /> Design <span className="ml-auto text-xs text-white/40">4 tasks</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
                      <span className="h-2 w-2 rounded-full bg-sky" /> Engineering <span className="ml-auto text-xs text-white/40">9 tasks</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
                      <span className="h-2 w-2 rounded-full bg-sky" /> Growth <span className="ml-auto text-xs text-white/40">3 tasks</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
                      <span className="h-2 w-2 rounded-full bg-white/30" /> Support <span className="ml-auto text-xs text-white/40">1 task</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white/5 border border-white/10 p-5">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-display font-semibold text-white">CEO Agent: live reasoning</h3>
                      <span className="text-xs px-2.5 py-1 rounded bg-teal/15 text-teal font-semibold">Running</span>
                    </div>
                    <div className="space-y-3 font-mono text-[13px] text-white/70 leading-relaxed">
                      <p><span className="text-teal">›</span> Reviewed brief: &quot;Launch product landing page&quot;</p>
                      <p><span className="text-teal">›</span> Assigned Design Mgr → wireframe + visual system</p>
                      <p><span className="text-teal">›</span> Assigned Eng Mgr → build + deploy pipeline</p>
                      <p className="text-white/40"><span className="text-teal">›</span> Waiting on: hero copy approval <span className="inline-block h-3 w-1.5 bg-teal ml-1 animate-pulseGlow align-middle" /></p>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-2xl font-display font-bold text-teal">94%</div>
                        <div className="text-xs text-white/40 mt-1">Tasks on schedule</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-2xl font-display font-bold text-sky">17</div>
                        <div className="text-xs text-white/40 mt-1">Active agents</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
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

        {/* USE CASES */}
        <section className="relative section-pad" aria-labelledby="usecases-heading">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="max-w-2xl reveal">
              <h2 id="usecases-heading" className="display-title text-navy">
                Teams that run real operations.
              </h2>
            </div>

            <div className="mt-14 grid md:grid-cols-2 gap-4 reveal-stagger">
              {[
                { title: 'Solo founders', desc: 'Run a full go-to-market motion covering landing page, launch copy, and outreach, without hiring your first employee.' },
                { title: 'Product teams', desc: 'Offload spec-to-ship busywork so your human team spends time on judgment calls, not tickets.' },
                { title: 'Agencies', desc: 'Spin up a dedicated virtual team per client, scoped and billed independently.' },
                { title: 'Internal ops', desc: 'Automate recurring cross-functional work like reporting, content refreshes, and QA sweeps, all on a schedule.' },
              ].map((useCase, idx) => (
                <div key={idx} className="glass rounded-xl p-8 hover:-translate-y-1 transition-transform duration-300">
                  <h3 className="font-display font-semibold text-xl text-navy tracking-tight">{useCase.title}</h3>
                  <p className="prose-body mt-2">{useCase.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="relative section-pad bg-ocean-50/60" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            <div className="text-center reveal">
              <span className="eyebrow text-ocean-600">FAQ</span>
              <h2 id="faq-heading" className="display-title mt-3 text-navy">Questions, answered</h2>
            </div>

            <div className="mt-12 space-y-3 reveal-stagger">
              {faqs.map((faq, idx) => {
                const isOpen = activeFaq === idx;
                return (
                  <div key={idx} className="glass rounded-xl overflow-hidden">
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : idx)}
                      className="w-full py-4 px-6 text-left flex items-center justify-between font-display font-semibold text-navy text-[15px] cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-ocean-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ ...SPRING, duration: 0.35 }}
                        >
                          <div className="px-6 pb-5 prose-sm border-t border-navy/5 pt-4">
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

        {/* CTA */}
        <section className="relative section-pad overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-navy-900 via-navy to-ocean-700" />

          <div className="mx-auto max-w-4xl px-4 md:px-6 relative text-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={SPRING}
            >
              <h2 className="display-hero text-white">
                Ready to run your virtual company?
              </h2>
              <p className="text-white/70 text-lg mt-6 max-w-xl mx-auto leading-relaxed">Set a goal. Watch the org chart build itself. Ship your first project today.</p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push(startHref)}
                  className="btn-white"
                >
                  Spawn Your First Virtual Team
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a href="#how" className="btn-inverse">
                  Explore the ecosystem
                </a>
              </div>
            </motion.div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-navy/10 py-12 bg-paper">
        <div className="mx-auto max-w-6xl px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-navy/50">
          <div className="flex items-center gap-2.5 font-display font-bold text-navy">
            <BrandLogo size={24} />
            AgentCorp
          </div>
          <p className="text-[13px]">&copy; 2026 AgentCorp. Multi-agent orchestration for real work.</p>
          <div className="flex gap-6 text-[13px]">
            <a href="/download" className="hover:text-navy transition-colors">Desktop App</a>
            <a href="#" className="hover:text-navy transition-colors">Privacy</a>
            <a href="#" className="hover:text-navy transition-colors">Terms</a>
            <a href="#" className="hover:text-navy transition-colors">Status</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
