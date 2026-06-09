'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { GitBranch, Play, Bell, Key, ChevronDown, Check } from 'lucide-react';

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
    <div className="space-y-4 text-gray-900">
      <div className="p-4 rounded-xl bg-white border border-gray-100 soft-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-violet-100/50 rounded-full blur-xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-100/50 rounded-full blur-2xl pointer-events-none" />
        <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-violet-500 flex items-center gap-1.5 uppercase tracking-wider">
          Platform Integrations
        </h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Link Agent Corp to your active product lifecycle environments to let AI developers push commits, trigger deployment checks, and broadcast operational alerts.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-gray-100 bg-white soft-shadow overflow-hidden transition-all duration-300 hover:border-sky-200">
          <button
            onClick={() => toggleAccordion('github')}
            className="w-full flex items-center justify-between p-3 text-left focus:outline-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <GitBranch size={16} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900">GitHub Repository</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {connectors.github.connected ? `Linked to ${connectors.github.repoUrl.replace('https://github.com/', '')}` : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectors.github.connected ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-sky-50 text-sky-600 border border-sky-200">
                  CONNECTED
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-gray-50 text-gray-400 border border-gray-200">
                  DISCONNECTED
                </span>
              )}
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform duration-300 ${activeAccordion === 'github' ? 'rotate-180' : ''}`}
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
                className="overflow-hidden border-t border-gray-100 bg-gray-50/50"
              >
                <div className="p-3.5 space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Repository URL</label>
                    <input
                      type="text"
                      placeholder="e.g. https://github.com/username/project"
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-sky-400/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Access Token</label>
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxx"
                      value={ghToken}
                      onChange={(e) => setGhToken(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-sky-400/50 transition-all"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-gray-100">
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900">Auto-Commit</h5>
                      <p className="text-[10px] text-gray-500">Authorize agents to submit pull requests on QA success.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ghCommit}
                        onChange={(e) => setGhCommit(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-400"></div>
                    </label>
                  </div>
                  <button
                    onClick={handleSaveGithub}
                    className="w-full py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-600 font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check size={12} /> Save Config
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white soft-shadow overflow-hidden transition-all duration-300 hover:border-violet-200">
          <button
            onClick={() => toggleAccordion('vercel')}
            className="w-full flex items-center justify-between p-3 text-left focus:outline-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <Play size={14} className="rotate-90" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900">Vercel Deployments</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {connectors.vercel.connected ? 'Active deploy hooks enabled' : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectors.vercel.connected ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-violet-50 text-violet-600 border border-violet-200">
                  CONNECTED
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-gray-50 text-gray-400 border border-gray-200">
                  DISCONNECTED
                </span>
              )}
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform duration-300 ${activeAccordion === 'vercel' ? 'rotate-180' : ''}`}
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
                className="overflow-hidden border-t border-gray-100 bg-gray-50/50"
              >
                <div className="p-3.5 space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Vercel API Token</label>
                    <input
                      type="password"
                      placeholder="ver_xxxxxxxxxxxxxxxx"
                      value={vToken}
                      onChange={(e) => setVToken(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-violet-400/50 transition-all"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-gray-100">
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900">Automated Previews</h5>
                      <p className="text-[10px] text-gray-500">Auto-push deployment check updates to preview environments.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vDeploy}
                        onChange={(e) => setVDeploy(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-violet-400"></div>
                    </label>
                  </div>
                  <button
                    onClick={handleSaveVercel}
                    className="w-full py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-600 font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check size={12} /> Save Config
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white soft-shadow overflow-hidden transition-all duration-300 hover:border-amber-200">
          <button
            onClick={() => toggleAccordion('slack')}
            className="w-full flex items-center justify-between p-3 text-left focus:outline-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <Bell size={14} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900">Slack Broadcast</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {connectors.slack.connected ? 'Push alerts enabled' : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectors.slack.connected ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                  CONNECTED
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-gray-50 text-gray-400 border border-gray-200">
                  DISCONNECTED
                </span>
              )}
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform duration-300 ${activeAccordion === 'slack' ? 'rotate-180' : ''}`}
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
                className="overflow-hidden border-t border-gray-100 bg-gray-50/50"
              >
                <div className="p-3.5 space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Webhook URL</label>
                    <input
                      type="text"
                      placeholder="https://hooks.slack.com/services/..."
                      value={sUrl}
                      onChange={(e) => setSUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-amber-400/50 transition-all"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-gray-100">
                    <div>
                      <h5 className="font-semibold text-xs text-gray-900">Morale & HR Alerts</h5>
                      <p className="text-[10px] text-gray-500">Broadcast operational tasks and manager reviews.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sBroadcast}
                        onChange={(e) => setSBroadcast(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-400"></div>
                    </label>
                  </div>
                  <button
                    onClick={handleSaveSlack}
                    className="w-full py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check size={12} /> Save Config
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white soft-shadow overflow-hidden transition-all duration-300 hover:border-sky-200">
          <button
            onClick={() => toggleAccordion('ai')}
            className="w-full flex items-center justify-between p-3 text-left focus:outline-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <Key size={14} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900">AI Model Provider</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Using {aiProvider === 'gemini' ? 'Direct Gemini' : 'OpenRouter Proxy'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectors.ai.apiKey ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-sky-50 text-sky-600 border border-sky-200">
                  KEY SET
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-rose-50 text-rose-500 border border-rose-200">
                  USING FALLBACK
                </span>
              )}
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform duration-300 ${activeAccordion === 'ai' ? 'rotate-180' : ''}`}
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
                className="overflow-hidden border-t border-gray-100 bg-gray-50/50"
              >
                <div className="p-3.5 space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Provider</label>
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-sky-400/50 transition-all"
                    >
                      <option value="gemini">Google Gemini API (Recommended)</option>
                      <option value="openrouter">OpenRouter API</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">API Key</label>
                    <input
                      type="password"
                      placeholder="AI_xxxxxxxxxxxxxxxx"
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-xs outline-none focus:border-sky-400/50 transition-all"
                    />
                  </div>
                  <button
                    onClick={handleSaveAI}
                    className="w-full py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-600 font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check size={12} /> Save Config
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
