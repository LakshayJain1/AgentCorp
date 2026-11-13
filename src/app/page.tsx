'use client';

import { useState, useEffect } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '@/hooks/useAuthUser';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Plus, Monitor, Menu, X } from 'lucide-react';
import HeroOrchestrationPanel from '@/components/HeroOrchestrationPanel';

// Conicorn motion: quick, plain `ease`, nothing slower than ~0.35s for UI.
const EASE = { duration: 0.35, ease: 'easeOut' } as const;

// The "conic" in Conicorn: the four gradient stops from the design system.
const CONIC = 'conic-gradient(from 210deg at 50% 55%, #C9AAFF, #FEFFBC, #FFCDFD, #B3E2FF, #C9AAFF)';

const MIST = 'bg-mist text-[#1A1A1A]';

export default function LandingPage() {
  const router = useRouter();
  // Signed-in visitors go straight to their workspace (it sends them to onboarding if they have none yet).
  const { user } = useAuthUser();
  const startHref = user ? '/workspace' : '/onboard';
  const [activeTeamTab, setActiveTeamTab] = useState<'engineering' | 'product' | 'marketing' | 'research'>('engineering');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
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
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -48px 0px' });
    revealEls.forEach((el) => io.observe(el));
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
    { q: 'How does AgentCorp write code locally?', a: 'AgentCorp runs inside a secure local sandbox workspace. It reads files, decomposes architectural needs, compiles via tsc, and automatically fixes syntax errors, committing directly to your local workspace once validation passes.' },
    { q: 'What keeps agents from writing buggy code?', a: 'Our integrated Quality Assurance (QA) loop runs automated tests and lints (eslint) on every iteration. If an error is detected, the stack trace is fed back to the developer agent to debug.' },
    { q: 'Can I customise the agent roles?', a: 'Yes! During onboarding, you define the company name, goals, and role structures. You can adjust agent energy conservation settings, morale triggers, and local connector access settings.' },
    { q: 'Do I need online accounts to use AgentCorp?', a: 'No. You can run AgentCorp entirely locally. To use advanced AI features, configure your Gemini API Key or OpenRouter fallback token in your local .env.local file.' },
  ];

  const navLinks = [
    { href: '#how', label: 'How it works' },
    { href: '#teams', label: 'Agent teams' },
    { href: '#lifecycle', label: 'Lifecycle' },
    { href: '#dashboard', label: 'Dashboard' },
    { href: '#faq', label: 'FAQ' },
  ];

  const go = () => router.push(startHref);

  return (
    <div className="min-h-screen bg-paper text-white antialiased overflow-x-hidden font-sans">

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[999] focus:bg-white focus:text-[#1A1A1A] focus:px-4 focus:py-2 focus:rounded-full">Skip to content</a>

      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50">
        <nav className="mx-auto max-w-6xl px-4 md:px-6 mt-4">
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={EASE}
            className={`rounded-full flex items-center justify-between pl-3 pr-2 py-2 border border-white/10 backdrop-blur-xl transition-colors duration-200 ${isScrolled ? 'bg-black/80' : 'bg-black/40'}`}
          >
            <a href="#main" className="flex items-center gap-2.5 font-display font-semibold text-[17px] text-white pr-4">
              <BrandLogo size={30} priority />
              AgentCorp
            </a>

            <ul className="hidden md:flex items-center gap-1 text-[14px] font-medium text-white/60">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="px-4 py-2 rounded-full hover:text-white hover:bg-white/10 transition-colors duration-200">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-1.5">
              <a
                href="/download"
                className="hidden md:inline-flex items-center gap-1.5 rounded-full text-white/60 text-[14px] font-medium px-4 py-2 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Monitor className="w-4 h-4" />
                Desktop
              </a>
              <button
                onClick={go}
                className="rounded-full bg-white text-[#1A1A1A] text-[14px] font-medium h-10 px-5 hover:bg-white/85 transition-colors duration-200 cursor-pointer"
              >
                {user ? 'Open workspace' : 'Get started'}
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
                className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </motion.div>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="md:hidden mt-2 rounded-[28px] border border-white/10 bg-black/90 backdrop-blur-xl p-2"
              >
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-5 py-3 rounded-full text-[15px] font-medium text-white/70 hover:bg-white/10 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <a href="/download" className="block px-5 py-3 rounded-full text-[15px] font-medium text-white/70 hover:bg-white/10 transition-colors">
                  Desktop app
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </header>

      <main id="main">

        {/* HERO */}
        <section className="relative pt-[148px] md:pt-[176px] pb-10 md:pb-16">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="text-center max-w-4xl mx-auto">
              <motion.span
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={EASE}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[14px] font-medium text-white/70"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Autonomous business orchestration
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...EASE, delay: 0.05 }}
                className="display-hero mt-7"
              >
                One goal.<br />
                <span className="text-white/45">An entire company.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...EASE, delay: 0.1 }}
                className="prose-body mt-7 max-w-md mx-auto"
              >
                Give AgentCorp an objective. Your AI CEO builds the team, delegates the work and gets things done.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...EASE, delay: 0.15 }}
                className="mt-9 flex flex-col sm:flex-row gap-3 justify-center items-center"
              >
                <button onClick={go} className="btn-primary">
                  Launch your first task
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a href="#how" className="btn-white">
                  See how it works
                </a>
              </motion.div>
            </div>

            {/* Product frame: conic gradient behind a light card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...EASE, delay: 0.2 }}
              className="mt-16 md:mt-20 rounded-[32px] md:rounded-[80px] p-5 md:p-14 border border-white/10"
              style={{ background: CONIC }}
            >
              <div className="mx-auto max-w-3xl">
                <HeroOrchestrationPanel />
              </div>
            </motion.div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="relative section-pad" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="max-w-3xl reveal">
              <span className="eyebrow">How it works</span>
              <h2 id="how-heading" className="display-title mt-4">
                One instruction becomes a running company.
              </h2>
              <p className="prose-body mt-6">Four stages, fully orchestrated.</p>
            </div>

            <div className="mt-16 grid md:grid-cols-2 gap-4 md:gap-5">
              {[
                { num: '01', title: 'Describe the outcome', desc: 'Tell your CEO agent the goal in plain language: "launch a landing page" or "run a content sprint." No workflow builder required.' },
                { num: '02', title: 'The CEO agent staffs the org', desc: 'It breaks the goal into functions, spins up manager agents for each, and sets scope, deadlines, and success criteria.' },
                { num: '03', title: 'Specialists execute in parallel', desc: 'Managers brief specialist agents (copy, design, code, research) who work simultaneously and report progress back up the chain.' },
                { num: '04', title: 'Review, approve, ship', desc: 'Work rolls up to a single dashboard. Approve, request changes, or let the CEO agent auto-ship once quality checks pass.' },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ ...EASE, delay: i * 0.05 }}
                  className={`${i % 3 === 0 ? 'card-mist' : 'bg-surface border border-white/10'} rounded-[40px] md:rounded-[56px] p-8 md:p-10 min-h-[280px] flex flex-col justify-between`}
                >
                  <span className={`font-mono text-[14px] ${i % 3 === 0 ? 'text-[#1A1A1A]/50' : 'text-white/40'}`}>{step.num}</span>
                  <div>
                    <h3 className="text-[32px] leading-[1.05] font-medium tracking-[-0.04em]">{step.title}</h3>
                    <p className={`mt-4 text-[16px] leading-[1.4] max-w-sm ${i % 3 === 0 ? 'text-[#1A1A1A]/60' : 'text-white/55'}`}>{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* AGENT TEAMS */}
        <section id="teams" className="relative section-pad" aria-labelledby="teams-heading">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="max-w-3xl reveal">
              <span className="eyebrow">Agent teams</span>
              <h2 id="teams-heading" className="display-title mt-4">
                Departments that hire themselves.
              </h2>
              <p className="prose-body mt-6">Each team is a self-contained unit: a manager agent plus specialists, spun up on demand.</p>
            </div>

            <div className="mt-12 mb-6 flex">
              <div className="flex flex-wrap gap-1 p-1 rounded-full border border-white/10 bg-white/5">
                {(['engineering', 'product', 'marketing', 'research'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTeamTab(tab)}
                    className={`relative px-5 h-10 text-[14px] font-medium rounded-full transition-colors duration-200 capitalize cursor-pointer ${
                      activeTeamTab === tab ? 'text-[#1A1A1A]' : 'text-white/55 hover:text-white'
                    }`}
                  >
                    {activeTeamTab === tab && (
                      <motion.span
                        layoutId="teamTab"
                        className="absolute inset-0 bg-white rounded-full"
                        transition={EASE}
                      />
                    )}
                    <span className="relative z-10">{tab}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
              <div className="card-mist rounded-[40px] md:rounded-[56px] p-8 md:p-9 flex flex-col justify-between min-h-[300px]">
                <div>
                  <h3 className="text-[32px] leading-[1.05] font-medium tracking-[-0.04em] capitalize">{activeTeamTab} team</h3>
                  <p className="mt-4 text-[16px] leading-[1.4] text-[#1A1A1A]/60">
                    This unit processes local source files, crawls repository definitions, and prepares code structures for integration.
                  </p>
                </div>
                <div className="mt-8 flex items-end justify-between">
                  <span className="text-[14px] text-[#1A1A1A]/50">Avg. morale</span>
                  <span className="text-[56px] leading-none font-medium tracking-[-0.05em]">92%</span>
                </div>
              </div>

              <div className="md:col-span-2 bg-surface border border-white/10 rounded-[40px] md:rounded-[56px] p-6 md:p-8">
                <h4 className="text-[14px] font-medium text-white/50 mb-4 px-2">Active roster &amp; tasks</h4>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTeamTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2.5"
                  >
                    {teamMembers[activeTeamTab].map((member, i) => (
                      <div
                        key={i}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 rounded-[28px] bg-black border border-white/10"
                      >
                        <div>
                          <div className="text-[16px] font-medium">{member.name}</div>
                          <div className="text-[14px] text-white/50 mt-0.5">{member.status}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex gap-1.5">
                            {member.tools.map((tool, idx) => (
                              <span key={idx} className="text-[12px] font-mono text-white/55 border border-white/10 px-2.5 py-1 rounded-full">{tool}</span>
                            ))}
                          </div>
                          <div className="text-[14px] font-mono text-white tabular-nums">{member.morale}%</div>
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
            <div className="max-w-3xl reveal">
              <span className="eyebrow">Lifecycle</span>
              <h2 id="lifecycle-heading" className="display-title mt-4">
                From brief to shipped, continuously.
              </h2>
              <p className="prose-body mt-6">Six stages run in sequence, fully automated.</p>
            </div>

            <div className="mt-16 border-t border-white/10 reveal">
              {lifecycleSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="grid md:grid-cols-[100px_1fr_1fr_auto] gap-x-8 gap-y-2 py-8 border-b border-white/10 items-baseline"
                >
                  <div className="font-mono text-[14px] text-white/40">{step.num}</div>
                  <h3 className="text-[32px] leading-[1.05] font-medium tracking-[-0.04em]">{step.title}</h3>
                  <p className="text-[16px] leading-[1.4] text-white/55 max-w-md">{step.desc}</p>
                  <p className="text-[12px] font-mono text-white/35 md:text-right">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DASHBOARD / COMMAND CENTER */}
        <section id="dashboard" className="relative section-pad" aria-labelledby="dashboard-heading">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="bg-black border border-white/10 rounded-[40px] md:rounded-[80px] p-6 md:p-14 overflow-hidden">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8 reveal">
                  <h2 id="dashboard-heading" className="display-title">
                    Every agent, one screen.
                  </h2>
                  <p className="prose-body">Watch the org chart work in real time. Zoom into any agent&apos;s task queue, reasoning trace, or output.</p>

                  <div className="space-y-4">
                    {[
                      { title: 'Interactive 2D office simulator', desc: 'Watch agents navigate between workstations, coffee makers, and meetings.' },
                      { title: 'Live performance logs', desc: 'Trace script execution, compiler outputs, and automated PR reviews in real-time.' },
                      { title: 'Integrated morale tracking', desc: 'Check agent energy drain levels and automatic replacements instantly.' },
                    ].map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ ...EASE, delay: idx * 0.06 }}
                        className="flex gap-4 items-start border-t border-white/10 pt-4"
                      >
                        <span className="font-mono text-[12px] text-white/35 pt-1">0{idx + 1}</span>
                        <div>
                          <h4 className="text-[16px] font-medium">{item.title}</h4>
                          <p className="text-[14px] text-white/50 mt-1 leading-[1.5]">{item.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <button onClick={go} className="btn-white">
                    Start dashboard preview
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Dashboard mockup */}
                <div className="bg-surface border border-white/10 rounded-[32px] p-3 reveal">
                  <div className="flex items-center gap-1.5 px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    <span className="ml-3 text-[12px] text-white/40 font-mono">agentcorp.ai/dashboard</span>
                  </div>

                  <div className="grid sm:grid-cols-[170px_1fr] gap-3 p-1">
                    <div className="rounded-[24px] bg-black border border-white/10 p-4 space-y-1">
                      <div className="text-[12px] text-white/35 px-2 mb-2">Active teams</div>
                      {[
                        { name: 'Design', n: '4 tasks', on: true },
                        { name: 'Engineering', n: '9 tasks', on: false },
                        { name: 'Growth', n: '3 tasks', on: false },
                        { name: 'Support', n: '1 task', on: false },
                      ].map((t) => (
                        <div key={t.name} className={`flex items-center gap-2 rounded-full px-3 py-2 text-[14px] ${t.on ? 'bg-white text-[#1A1A1A]' : 'text-white/65'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${t.on ? 'bg-[#1A1A1A]' : 'bg-white/35'}`} />
                          {t.name}
                          <span className={`ml-auto text-[11px] ${t.on ? 'text-[#1A1A1A]/50' : 'text-white/35'}`}>{t.n}</span>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-[24px] bg-black border border-white/10 p-5">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-[16px] font-medium">CEO agent: live reasoning</h3>
                        <span className="text-[12px] px-3 py-1 rounded-full border border-white/15 text-white/70">Running</span>
                      </div>
                      <div className="space-y-2.5 font-mono text-[13px] text-white/65 leading-relaxed">
                        <p><span className="text-white/35">›</span> Reviewed brief: &quot;Launch product landing page&quot;</p>
                        <p><span className="text-white/35">›</span> Assigned Design Mgr → wireframe + visual system</p>
                        <p><span className="text-white/35">›</span> Assigned Eng Mgr → build + deploy pipeline</p>
                        <p className="text-white/40"><span className="text-white/35">›</span> Waiting on: hero copy approval <span className="inline-block h-3 w-1.5 bg-white ml-1 animate-pulseGlow align-middle" /></p>
                      </div>
                      <div className="mt-6 grid grid-cols-3 gap-2.5">
                        {[
                          { v: '94%', l: 'On schedule' },
                          { v: '17', l: 'Active agents' },
                          { v: '2.3h', l: 'Avg. task time' },
                        ].map((m) => (
                          <div key={m.l} className="rounded-[20px] bg-white/5 border border-white/10 p-3">
                            <div className="text-[28px] leading-none font-medium tracking-[-0.04em]">{m.v}</div>
                            <div className="text-[12px] text-white/40 mt-2">{m.l}</div>
                          </div>
                        ))}
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
            <div className="max-w-3xl reveal">
              <span className="eyebrow">Use cases</span>
              <h2 id="usecases-heading" className="display-title mt-4">
                Teams that run real operations.
              </h2>
            </div>

            <div className="mt-16 grid md:grid-cols-2 gap-4 md:gap-5 reveal-stagger">
              {[
                { title: 'Solo founders', desc: 'Run a full go-to-market motion covering landing page, launch copy, and outreach, without hiring your first employee.' },
                { title: 'Product teams', desc: 'Offload spec-to-ship busywork so your human team spends time on judgment calls, not tickets.' },
                { title: 'Agencies', desc: 'Spin up a dedicated virtual team per client, scoped and billed independently.' },
                { title: 'Internal ops', desc: 'Automate recurring cross-functional work like reporting, content refreshes, and QA sweeps, all on a schedule.' },
              ].map((useCase, idx) => (
                <div
                  key={idx}
                  className={`${(idx === 1 || idx === 2) ? 'card-mist' : 'bg-surface border border-white/10'} rounded-[40px] md:rounded-[56px] p-8 md:p-10 min-h-[240px] flex flex-col justify-between`}
                >
                  <h3 className="text-[32px] leading-[1.05] font-medium tracking-[-0.04em]">{useCase.title}</h3>
                  <p className={`mt-8 text-[16px] leading-[1.4] max-w-sm ${(idx === 1 || idx === 2) ? 'text-[#1A1A1A]/60' : 'text-white/55'}`}>{useCase.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="relative section-pad" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-4xl px-4 md:px-6">
            <div className="reveal">
              <span className="eyebrow">FAQ</span>
              <h2 id="faq-heading" className="display-title mt-4">Questions, answered.</h2>
            </div>

            <div className="mt-14 border-t border-white/10 reveal">
              {faqs.map((faq, idx) => {
                const isOpen = activeFaq === idx;
                return (
                  <div key={idx} className="border-b border-white/10">
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : idx)}
                      className="w-full py-7 text-left flex items-center justify-between gap-6 text-[24px] md:text-[28px] leading-[1.1] font-medium tracking-[-0.035em] cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span>{faq.q}</span>
                      <span className={`h-11 w-11 shrink-0 rounded-full border border-white/15 flex items-center justify-center transition-transform duration-200 ${isOpen ? 'rotate-45 bg-white text-[#1A1A1A]' : ''}`}>
                        <Plus className="w-5 h-5" />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <p className="pb-8 pr-16 text-[18px] leading-[1.35] text-white/55 max-w-2xl">{faq.a}</p>
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
        <section className="relative pb-24 md:pb-32">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={EASE}
              className={`${MIST} rounded-[48px] md:rounded-[120px] px-6 py-20 md:py-28 text-center relative overflow-hidden`}
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-1/2 opacity-70"
                style={{ background: `linear-gradient(to top, #FFCDFD99, transparent), ${CONIC}`, maskImage: 'linear-gradient(to top, #000, transparent)', WebkitMaskImage: 'linear-gradient(to top, #000, transparent)' }}
              />
              <div className="relative">
                <h2 className="display-hero max-w-3xl mx-auto">
                  Ready to run your virtual company?
                </h2>
                <p className="mt-7 text-[18px] leading-[1.3] text-[#1A1A1A]/60 max-w-md mx-auto">Set a goal. Watch the org chart build itself. Ship your first project today.</p>

                <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <button onClick={go} className="btn-primary">
                    Spawn your first virtual team
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <a href="#how" className="inline-flex items-center justify-center h-12 px-7 rounded-full border border-[#1A1A1A]/20 text-[#1A1A1A] font-medium hover:bg-[#1A1A1A]/5 transition-colors">
                    Explore the ecosystem
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-12">
        <div className="mx-auto max-w-6xl px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-5 text-white/50">
          <div className="flex items-center gap-2.5 font-display font-semibold text-white text-[17px]">
            <BrandLogo size={24} />
            AgentCorp
          </div>
          <p className="text-[14px]">&copy; 2026 AgentCorp. Multi-agent orchestration for real work.</p>
          <div className="flex gap-6 text-[14px]">
            <a href="/download" className="hover:text-white transition-colors">Desktop app</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Status</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
