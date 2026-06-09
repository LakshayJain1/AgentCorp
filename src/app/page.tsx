'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Cpu, Shield, Zap, Sparkles, MessageSquare,
  Layers, Code, Settings, Share2, Compass, CheckCircle2,
  Terminal, Play, ArrowDownToLine, Users, Disc, FileText, Check, Plus, Folder
} from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'delegate' | 'manage' | 'integrate' | 'security'>('delegate');
  const [typingText, setTypingText] = useState('');

  // Custom typing animation for the active tab demo
  useEffect(() => {
    let text = '';
    if (activeTab === 'delegate') text = 'Create a landing page for our new AI tool...';
    else if (activeTab === 'manage') text = 'Refactor authentication & deploy to Vercel...';
    else if (activeTab === 'integrate') text = 'Send a daily summary report to Slack...';
    else if (activeTab === 'security') text = 'Store Vercel credentials securely...';

    setTypingText('');
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < text.length) {
        setTypingText((prev) => prev + text.charAt(idx));
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [activeTab]);

  const tabs = [
    {
      id: 'delegate' as const,
      label: 'Delegate',
      title: 'Execute your tasks online',
      desc: 'Train agents and delegate all your routine work, easily. Let the CEO & PM agents distribute workloads.',
      icon: Cpu,
    },
    {
      id: 'manage' as const,
      label: 'Manage',
      title: 'Manage applications & projects',
      desc: 'Let engineers and QA agents build, test, and package your projects autonomously.',
      icon: Layers,
    },
    {
      id: 'integrate' as const,
      label: 'Integrate',
      title: 'Integrate with platforms',
      desc: 'Sync with GitHub repositories, Vercel deployments, and Slack messaging channels.',
      icon: Share2,
    },
    {
      id: 'security' as const,
      label: 'Data security',
      title: 'Enterprise security & speed',
      desc: 'Maintain local context, run processes locally, and manage credentials securely.',
      icon: Shield,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FBFBFC] text-[#1D1D1F] overflow-x-hidden selection:bg-sky-100">
      {/* Top spacing instead of header */}
      <div className="h-6" />

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 max-w-7xl mx-auto w-full text-center flex flex-col items-center">
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-100 text-sky-600 text-xs font-medium mb-6"
        >
          <Sparkles className="w-3.5 h-3.5" />
          The future of decentralized virtual organizations
        </motion.div>

        {/* Serif Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-serif text-5xl md:text-7xl lg:text-8xl tracking-tight text-gray-900 leading-[1.05]"
        >
          Easily and quickly run your <br className="hidden md:inline" />
          <span className="text-gradient-sky italic font-medium font-serif">company virtually</span> with AgentCorp
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-gray-500 text-base md:text-xl max-w-2xl mt-6 font-normal leading-relaxed"
        >
          An innovative workspace of AI agents collaborating in real-time.
          Just assign goals, and watch your automated workforce research, build, QA, and deploy.
        </motion.p>

        {/* Feature Tabs Selector */}
        <div className="mt-14 w-full max-w-3xl bg-gray-100/80 backdrop-blur-sm p-1.5 rounded-full border border-gray-200/50 flex gap-1 justify-between shadow-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 md:px-5 rounded-full text-xs font-semibold transition-all cursor-pointer ${isSelected
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-sky-500' : 'text-gray-400'}`} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Detail Text */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="mt-6 max-w-xl text-center"
          >
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-1.5">
              {tabs.find(t => t.id === activeTab)?.title}
            </h3>
            <p className="text-sm text-gray-400">
              {tabs.find(t => t.id === activeTab)?.desc}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Dynamic Mockup of Dashboard */}
        <div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-400 to-cyan-400" />

          <div className="w-full rounded-2xl border border-gray-100 overflow-hidden bg-white flex flex-col md:flex-row h-[520px] md:h-[480px]">
            {/* Sidebar Mock */}
            <div className="w-full md:w-56 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100 p-4 flex flex-col shrink-0">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>

              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Messages</div>
              <div className="space-y-1">
                {[
                  { name: 'Alex (CEO)', role: 'ceo', text: 'Define roadmap...', active: activeTab === 'delegate' },
                  { name: 'Sam (PM)', role: 'pm', text: 'Allocate budget...', active: false },
                  { name: 'Mike (Dev)', role: 'engineer', text: 'Auth integration completed', active: activeTab === 'manage' },
                  { name: 'Riley (HR)', role: 'hr', text: 'Triage recruitment', active: false },
                ].map((member, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 p-2 rounded-xl text-left text-xs transition-all ${member.active ? 'bg-sky-50 text-sky-700 font-medium' : 'text-gray-600 hover:bg-gray-100/50'
                      }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${member.role === 'ceo' ? 'bg-red-400' : member.role === 'pm' ? 'bg-cyan-400' : 'bg-yellow-400'
                      }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{member.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{member.text}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-3">Workspace</div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-gray-100 font-medium">
                  <Folder className="w-4 h-4 text-sky-400" />
                  <span>Agent Sandbox</span>
                </div>
                <div className="flex items-center gap-2.5 p-2 rounded-xl text-gray-500 hover:bg-gray-100/50">
                  <Settings className="w-4 h-4" />
                  <span>Integration Config</span>
                </div>
              </div>
            </div>

            {/* Main Interactive Workspace Area */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-xs tracking-tight uppercase text-gray-500">Live Agent Execution</span>
                </div>
                <span className="text-[10px] text-gray-400">TaskID: 8401</span>
              </div>

              {/* Chat/Activity Content Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {activeTab === 'delegate' && (
                  <div className="space-y-4">
                    <div className="flex gap-3 items-start max-w-[80%]">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-semibold text-xs">A</div>
                      <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-xs text-gray-700 shadow-sm leading-relaxed">
                        I am analyzing the product request. Sam (PM), let's schedule a sprint sequence to create a landing page for our new AI tool.
                      </div>
                    </div>
                    <div className="flex gap-3 items-start max-w-[80%] ml-auto flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-500 font-semibold text-xs">S</div>
                      <div className="bg-sky-50 border border-sky-100 p-3 rounded-2xl text-xs text-sky-800 shadow-sm leading-relaxed">
                        Understood. Mike (Engineer) will initialize the React scaffolding. Tina (QA) will run unit tests for each layout block.
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'manage' && (
                  <div className="space-y-4">
                    <div className="flex gap-3 items-start max-w-[80%]">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-semibold text-xs">M</div>
                      <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-xs text-gray-700 shadow-sm">
                        <div className="font-mono text-[10px] text-gray-400 mb-1">$ git checkout -b feature/auth</div>
                        Initializing authentication refactoring module. Setting up Clerk providers.
                      </div>
                    </div>
                    <div className="flex gap-3 items-start max-w-[80%] ml-auto flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-500 font-semibold text-xs">T</div>
                      <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-xs text-emerald-800 shadow-sm">
                        Auth integration verification complete. 12/12 routes secured. Preparing PR review for Sam (PM).
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'integrate' && (
                  <div className="space-y-4">
                    <div className="flex gap-3 items-start max-w-[80%]">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold text-xs">🤖</div>
                      <div className="bg-purple-50/50 border border-purple-100 p-3 rounded-2xl text-xs text-purple-900 shadow-sm leading-relaxed">
                        Slack Connector: Broadcasting daily task metrics... <br />
                        ✅ 15 tasks completed, 0 failed. Deployment success rate at 100%.
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-4">
                    <div className="flex gap-3 items-start max-w-[80%] mx-auto w-full">
                      <div className="bg-amber-50/50 border border-amber-200/80 p-4 rounded-2xl text-xs text-amber-900 w-full flex items-center gap-3">
                        <Shield className="w-8 h-8 text-amber-500 shrink-0" />
                        <div>
                          <div className="font-semibold">Security Vault Isolation</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">All process API tokens are processed locally. Security certificates are sandboxed.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Bar Mock */}
              <div className="bg-white border-t border-gray-100 p-4 flex items-center justify-center shrink-0">
                <div className="flex items-center gap-3 w-full max-w-xl bg-gray-50 border border-gray-200/80 px-4 py-2.5 rounded-2xl">
                  <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
                  <span className="flex-1 text-xs text-gray-800 font-mono select-none">
                    {typingText}
                    <span className="w-1.5 h-3.5 bg-sky-500 inline-block align-middle ml-0.5 animate-pulse" />
                  </span>
                  <button className="bg-sky-500 text-white rounded-xl p-1.5 text-xs hover:bg-sky-600 transition-colors cursor-pointer">
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Details Panel Mock */}
            <div className="hidden lg:flex w-64 border-l border-gray-100 p-4 flex-col bg-gray-50 shrink-0">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Deliverables</div>
              <div className="space-y-2">
                {[
                  { title: 'Customer_Feedback_Spec.md', type: 'doc' },
                  { title: 'AuthRateLimiter.ts', type: 'code' },
                  { title: 'Security_Audit.md', type: 'analysis' },
                ].map((file, i) => (
                  <div key={i} className="bg-white border border-gray-200/60 p-2.5 rounded-xl flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-[11px] font-semibold text-gray-700 truncate">{file.title}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto p-3 bg-white border border-gray-100 rounded-2xl flex flex-col gap-2 shadow-sm">
                <div className="flex justify-between items-center text-[10px] text-gray-400">
                  <span>Vercel Deploy</span>
                  <span className="text-emerald-500 font-semibold">Active</span>
                </div>
                <div className="text-xs font-semibold truncate text-gray-700">agentcorp-app-v2.vercel.app</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Focus / Illustration Section */}
      <section id="workflow" className="py-24 bg-white border-y border-gray-100 flex flex-col items-center justify-center">
        <div className="max-w-7xl mx-auto px-6 w-full flex flex-col items-center">
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-center tracking-tight text-gray-900">
            Focus on what matters — <br />
            <span className="italic font-medium font-serif text-sky-500">leave the rest</span> to AgentCorp!
          </h2>
          <p className="text-gray-400 text-sm md:text-base text-center mt-4 max-w-xl">
            Streamline operations with fully coordinated software engineering, marketing operations, and security agents.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mt-16">
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-200/50 flex flex-col items-start hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center shadow-sm text-sky-500 mb-6">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">100% Agentic Execution</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                Agents autonomously assign tasks, draft plans, write tests, inspect features, and review results.
              </p>
            </div>

            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-200/50 flex flex-col items-start hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center shadow-sm text-indigo-500 mb-6">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Local Integrations</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                Seamless pipelines connecting directly into Slack webhooks, Vercel deployments, and GitHub repo versioning.
              </p>
            </div>

            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-200/50 flex flex-col items-start hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center shadow-sm text-violet-500 mb-6">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Secure Sandboxing</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                Run agent code inside secure sandbox runtimes, safeguarding configurations, keys, and tokens.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Grid Features Section */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto w-full">
        <h2 className="font-serif text-4xl md:text-5xl text-center text-gray-900 tracking-tight mb-16">
          Why choose <span className="italic font-serif text-sky-500 font-medium">AgentCorp?</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Deep Integration',
              desc: 'Works seamlessly with Git modules, API environments, secure tokens, and messengers.',
              color: 'border-sky-200'
            },
            {
              title: 'High Accuracy',
              desc: 'Learns iteratively from execution logs, handles errors, and applies corrections autonomously.',
              color: 'border-indigo-200'
            },
            {
              title: 'Data Security',
              desc: 'Critical logic runs on sandboxed runtimes. Keeps sensitive credentials locally isolated.',
              color: 'border-violet-200'
            },
            {
              title: 'Time-Saving',
              desc: 'Delegates routine tasks in bulk, saving engineering hours and freeing your focus.',
              color: 'border-purple-200'
            },
            {
              title: 'Full Adaptivity',
              desc: 'Tailors execution priorities based on your initial prompt directives and onboarding settings.',
              color: 'border-fuchsia-200'
            },
            {
              title: 'System 1 and System 2',
              desc: 'Combines fast, localized actions with high-level cognitive agent deliberation & reviews.',
              color: 'border-cyan-200',
              badge: 'Reasoning Mode'
            }
          ].map((feature, i) => (
            <div
              key={i}
              className={`bg-white rounded-3xl p-6 border ${feature.color} flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 card-shadow`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-base">{feature.title}</h3>
                  {feature.badge && (
                    <span className="text-[10px] font-semibold bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full border border-sky-100">
                      {feature.badge}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-xs mt-3 leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6 w-full flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1 space-y-6">
            <h2 className="font-serif text-4xl md:text-5xl text-gray-900 tracking-tight leading-tight">
              About AgentCorp
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              AgentCorp is a sensory GUI and orchestrator platform built for complex, multi-agent systems.
              By combining task queues, activity feeds, metrics, and visual simulators, AgentCorp empowers
              teams to orchestrate workflows with high clarity, robust security, and deep local integration.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push('/onboard')}
                className="px-6 py-3 bg-gray-900 text-white font-semibold text-xs rounded-full hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                Launch Agent Setup
              </button>
            </div>
          </div>

          <div className="w-full md:w-80 bg-white p-6 rounded-3xl border border-gray-200/80 card-shadow flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-500 mb-4 animate-bounce">
              <ArrowDownToLine className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-gray-800">Download Agent SDK</h3>
            <p className="text-xs text-gray-400 mt-2">Get the command line runner to configure your local terminal execution sandbox.</p>
            <div className="w-full mt-6 space-y-2">
              <button className="w-full py-2.5 text-xs font-semibold border border-gray-200 hover:bg-gray-50 transition-colors rounded-xl flex items-center justify-center gap-2">
                <span>macOS CLI (Apple Silicon)</span>
              </button>
              <button className="w-full py-2.5 text-xs font-semibold border border-gray-200 hover:bg-gray-50 transition-colors rounded-xl flex items-center justify-center gap-2">
                <span>Windows CLI (x64)</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Pill Menu */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[90%] md:max-w-max">
        <div className="floating-pill px-4 md:px-6 py-3 rounded-full flex items-center gap-4 md:gap-6 shadow-xl">
          {/* Logo */}
          <div className="flex items-center gap-2 border-r border-gray-200 pr-3 md:pr-4 shrink-0">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-sky-500 to-violet-500 flex items-center justify-center text-white shadow-sm shadow-sky-500/10">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-gray-800 hidden sm:inline">AgentCorp</span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-3.5 md:gap-5 text-xs text-gray-500 font-medium">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#workflow" className="hover:text-gray-900 transition-colors">Workflow</a>
            <a href="#about" className="hover:text-gray-900 transition-colors">About</a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 md:gap-3 border-l border-gray-200 pl-3 md:pl-4">
            <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors hidden xs:inline-block"
              title="Join Community"
            >
              <Disc className="w-4 h-4 text-[#5865F2]" />
            </a>
            <button
              onClick={() => router.push('/onboard')}
              className="glow-btn px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold text-xs transition-colors shadow-sm shadow-sky-400/20 cursor-pointer"
            >
              Launch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
