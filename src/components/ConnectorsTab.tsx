'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { GitBranch, Play, Bell, Key, ChevronDown, Check, Info, ShieldAlert } from 'lucide-react';

export default function ConnectorsTab() {
  const { connectors, updateConnectors } = useGameStore();
  const [activeAccordion, setActiveAccordion] = useState<string | null>('github');

  const [ghRepo, setGhRepo] = useState(connectors.github.repoUrl);
  const [ghToken, setGhToken] = useState(connectors.github.token);
  const [ghCommit, setGhCommit] = useState(connectors.github.autoCommit);

  const [vToken, setVToken] = useState(connectors.vercel.token);
  const [vDeploy, setVDeploy] = useState(connectors.vercel.autoDeploy);

  const [sUrl, setSUrl] = useState(connectors.slack.webhookUrl);
  const [sBroadcast, setSBroadcast] = useState(connectors.slack.broadcastEvents);

  const [aiProvider, setAiProvider] = useState(connectors.ai.provider);
  const [aiKey, setAiKey] = useState(connectors.ai.apiKey);

  const handleSaveGithub = () => {
    updateConnectors({
      github: {
        connected: !!ghRepo,
        repoUrl: ghRepo,
        token: ghToken,
        autoCommit: ghCommit,
      },
    });
  };

  const handleSaveVercel = () => {
    updateConnectors({
      vercel: {
        connected: !!vToken,
        token: vToken,
        autoDeploy: vDeploy,
      },
    });
  };

  const handleSaveSlack = () => {
    updateConnectors({
      slack: {
        connected: !!sUrl,
        webhookUrl: sUrl,
        broadcastEvents: sBroadcast,
      },
    });
  };

  const handleSaveAI = () => {
    updateConnectors({
      ai: {
        provider: aiProvider,
        apiKey: aiKey,
      },
    });
  };

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  return (
    <div className="space-y-4 font-sans text-text">
      {/* Title block */}
      <div className="p-4 rounded-xl bg-card border border-border/30 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00f5ff] to-purple-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
          🔌 Platform Integrations
        </h3>
        <p className="text-xs text-subtle mt-1 leading-relaxed">
          Link Agent Corp to your active product lifecycle environments to let AI developers push commits, trigger deployment checks, and broadcast operational alerts.
        </p>
      </div>

      {/* Accordion list */}
      <div className="space-y-3">
        {/* GitHub */}
        <div className="rounded-xl border border-border/40 bg-surface/50 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-cyan-500/30">
          <button
            onClick={() => toggleAccordion('github')}
            className="w-full flex items-center justify-between p-3 text-left focus:outline-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/10 text-white">
                <GitBranch size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold font-mono tracking-wide text-white/90">GitHub Repository</h4>
                <p className="text-[10px] text-subtle mt-0.5">
                  {connectors.github.connected ? `Linked to ${connectors.github.repoUrl.replace('https://github.com/', '')}` : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectors.github.connected ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#00f5ff]/10 text-[#00f5ff] border border-[#00f5ff]/30">
                  CONNECTED
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-muted/10 text-muted border border-muted/20">
                  DISCONNECTED
                </span>
              )}
              <ChevronDown
                size={14}
                className={`text-subtle transition-transform duration-300 ${activeAccordion === 'github' ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {activeAccordion === 'github' && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-border/20 bg-black/20"
              >
                <div className="p-3.5 space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-subtle uppercase mb-1">Repository URL</label>
                    <input
                      type="text"
                      placeholder="e.g. https://github.com/username/project"
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-border/40 rounded-lg text-white text-xs outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-subtle uppercase mb-1">Access Token / Personal Secret</label>
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxx"
                      value={ghToken}
                      onChange={(e) => setGhToken(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-border/40 rounded-lg text-white text-xs outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-border/10">
                    <div>
                      <h5 className="font-bold text-[11px] text-white/95">Auto-Commit Commenced Tasks</h5>
                      <p className="text-[10px] text-subtle">Authorize developer agents to submit pull requests on QA success.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ghCommit}
                        onChange={(e) => setGhCommit(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-muted/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#00f5ff]"></div>
                    </label>
                  </div>
                  <button
                    onClick={handleSaveGithub}
                    className="w-full py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Check size={12} /> Save Github Config
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Vercel */}
        <div className="rounded-xl border border-border/40 bg-surface/50 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-purple-500/30">
          <button
            onClick={() => toggleAccordion('vercel')}
            className="w-full flex items-center justify-between p-3 text-left focus:outline-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/10 text-white">
                <Play size={14} className="rotate-90 fill-white" />
              </div>
              <div>
                <h4 className="text-xs font-bold font-mono tracking-wide text-white/90">Vercel Deployments</h4>
                <p className="text-[10px] text-subtle mt-0.5">
                  {connectors.vercel.connected ? 'Active deploy hooks enabled' : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectors.vercel.connected ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  CONNECTED
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-muted/10 text-muted border border-muted/20">
                  DISCONNECTED
                </span>
              )}
              <ChevronDown
                size={14}
                className={`text-subtle transition-transform duration-300 ${activeAccordion === 'vercel' ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {activeAccordion === 'vercel' && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-border/20 bg-black/20"
              >
                <div className="p-3.5 space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-subtle uppercase mb-1">Vercel API Token</label>
                    <input
                      type="password"
                      placeholder="ver_xxxxxxxxxxxxxxxx"
                      value={vToken}
                      onChange={(e) => setVToken(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-border/40 rounded-lg text-white text-xs outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-border/10">
                    <div>
                      <h5 className="font-bold text-[11px] text-white/95">Automated Previews</h5>
                      <p className="text-[10px] text-subtle">Automatically push deployment check updates to preview environments.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vDeploy}
                        onChange={(e) => setVDeploy(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-muted/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                  </div>
                  <button
                    onClick={handleSaveVercel}
                    className="w-full py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Check size={12} /> Save Vercel Config
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Slack */}
        <div className="rounded-xl border border-border/40 bg-surface/50 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-amber-500/30">
          <button
            onClick={() => toggleAccordion('slack')}
            className="w-full flex items-center justify-between p-3 text-left focus:outline-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/10 text-white">
                <Bell size={14} />
              </div>
              <div>
                <h4 className="text-xs font-bold font-mono tracking-wide text-white/90">Slack Broadcast</h4>
                <p className="text-[10px] text-subtle mt-0.5">
                  {connectors.slack.connected ? 'Push alerts enabled' : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectors.slack.connected ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  CONNECTED
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-muted/10 text-muted border border-muted/20">
                  DISCONNECTED
                </span>
              )}
              <ChevronDown
                size={14}
                className={`text-subtle transition-transform duration-300 ${activeAccordion === 'slack' ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {activeAccordion === 'slack' && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-border/20 bg-black/20"
              >
                <div className="p-3.5 space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-subtle uppercase mb-1">Webhook URL</label>
                    <input
                      type="text"
                      placeholder="https://hooks.slack.com/services/..."
                      value={sUrl}
                      onChange={(e) => setSUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-border/40 rounded-lg text-white text-xs outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-border/10">
                    <div>
                      <h5 className="font-bold text-[11px] text-white/95">Morale & HR Alerts</h5>
                      <p className="text-[10px] text-subtle">Broadcast operational tasks and manager reviews to your channels.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sBroadcast}
                        onChange={(e) => setSBroadcast(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-muted/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  <button
                    onClick={handleSaveSlack}
                    className="w-full py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Check size={12} /> Save Slack Config
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Models API Key (Advanced) */}
        <div className="rounded-xl border border-border/40 bg-surface/50 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-[#00f5ff]/30">
          <button
            onClick={() => toggleAccordion('ai')}
            className="w-full flex items-center justify-between p-3 text-left focus:outline-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/10 text-white">
                <Key size={14} />
              </div>
              <div>
                <h4 className="text-xs font-bold font-mono tracking-wide text-white/90">AI Model Provider API</h4>
                <p className="text-[10px] text-subtle mt-0.5">
                  Using {aiProvider === 'gemini' ? 'Direct Gemini' : 'OpenRouter Proxy'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectors.ai.apiKey ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#00f5ff]/10 text-[#00f5ff] border border-[#00f5ff]/30">
                  KEY SET
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  USING FALLBACK
                </span>
              )}
              <ChevronDown
                size={14}
                className={`text-subtle transition-transform duration-300 ${activeAccordion === 'ai' ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {activeAccordion === 'ai' && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-border/20 bg-black/20"
              >
                <div className="p-3.5 space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-subtle uppercase mb-1">Provider</label>
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-border/40 rounded-lg text-white text-xs outline-none focus:border-cyan-500/50"
                    >
                      <option value="gemini">Google Gemini API (Recommended)</option>
                      <option value="openrouter">OpenRouter API</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-subtle uppercase mb-1">API Key override</label>
                    <input
                      type="password"
                      placeholder="AI_xxxxxxxxxxxxxxxx"
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-black/40 border border-border/40 rounded-lg text-white text-xs outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <button
                    onClick={handleSaveAI}
                    className="w-full py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Check size={12} /> Save AI credentials
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
