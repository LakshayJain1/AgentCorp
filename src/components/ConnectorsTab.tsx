'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  GitBranch, Bell, Key, ChevronDown, Check, AlertTriangle,
  Zap, Database, MessageSquare, Cloud, Code2, Bot, Globe,
  ExternalLink, Lock, RefreshCw
} from 'lucide-react';

type ConnectorId =
  | 'github' | 'vercel' | 'slack' | 'ai'
  | 'linear' | 'notion' | 'supabase' | 'railway'
  | 'discord' | 'openai' | 'jira';

interface ConnectorDef {
  id: ConnectorId;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  badgeColor: string;
  comingSoon?: boolean;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    type?: 'text' | 'password' | 'url';
  }[];
}

const CONNECTORS: ConnectorDef[] = [
  {
    id: 'github',
    label: 'GitHub',
    desc: 'Commit code, open PRs, push agent-generated code to your repo',
    icon: <GitBranch size={15} />,
    color: 'hover:border-gray-400',
    badgeColor: 'bg-gray-100 text-gray-700 border-gray-300',
    fields: [
      { key: 'repoUrl', label: 'Repository URL', placeholder: 'https://github.com/username/repo', type: 'url' },
      { key: 'token', label: 'Personal Access Token', placeholder: 'ghp_xxxxxxxxxxxxxxxx', type: 'password' },
    ],
  },
  {
    id: 'vercel',
    label: 'Vercel',
    desc: 'Auto-deploy deliverables, trigger preview builds, monitor deployment status',
    icon: <Cloud size={15} />,
    color: 'hover:border-gray-800',
    badgeColor: 'bg-gray-900 text-white border-gray-700',
    fields: [
      { key: 'token', label: 'Vercel API Token', placeholder: 'ver_xxxxxxxxxxxxxxxx', type: 'password' },
      { key: 'projectId', label: 'Project ID (optional)', placeholder: 'prj_xxxxxxxx', type: 'text' },
    ],
  },
  {
    id: 'slack',
    label: 'Slack',
    desc: 'Broadcast task completions, agent activity, and daily summaries to your team',
    icon: <Bell size={15} />,
    color: 'hover:border-amber-400',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', placeholder: 'https://hooks.slack.com/services/...', type: 'url' },
    ],
  },
  {
    id: 'discord',
    label: 'Discord',
    desc: 'Post live agent updates and deployment alerts to a Discord channel',
    icon: <MessageSquare size={15} />,
    color: 'hover:border-indigo-400',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    fields: [
      { key: 'webhookUrl', label: 'Discord Webhook URL', placeholder: 'https://discord.com/api/webhooks/...', type: 'url' },
    ],
  },
  {
    id: 'linear',
    label: 'Linear',
    desc: 'Sync tasks with Linear issues — agents create tickets and update statuses automatically',
    icon: <Zap size={15} />,
    color: 'hover:border-violet-400',
    badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
    fields: [
      { key: 'apiKey', label: 'Linear API Key', placeholder: 'lin_api_xxxxxxxxxxxxxxxx', type: 'password' },
      { key: 'teamId', label: 'Team ID', placeholder: 'e.g. TEAM-1 or UUID', type: 'text' },
    ],
  },
  {
    id: 'notion',
    label: 'Notion',
    desc: 'Write reports, specs, and meeting notes directly into your Notion workspace',
    icon: <Globe size={15} />,
    color: 'hover:border-gray-400',
    badgeColor: 'bg-gray-100 text-gray-700 border-gray-300',
    fields: [
      { key: 'token', label: 'Integration Token', placeholder: 'secret_xxxxxxxxxxxxxxxx', type: 'password' },
      { key: 'databaseId', label: 'Database ID', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'text' },
    ],
  },
  {
    id: 'supabase',
    label: 'Supabase',
    desc: 'Read/write data, run migrations, and manage your Supabase project via agents',
    icon: <Database size={15} />,
    color: 'hover:border-emerald-400',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    fields: [
      { key: 'url', label: 'Project URL', placeholder: 'https://xxxx.supabase.co', type: 'url' },
      { key: 'serviceKey', label: 'Service Role Key', placeholder: 'eyJhbGciOiJ...', type: 'password' },
    ],
  },
  {
    id: 'railway',
    label: 'Railway',
    desc: 'Deploy backend services, manage environments and trigger builds via Railway API',
    icon: <RefreshCw size={15} />,
    color: 'hover:border-purple-400',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    fields: [
      { key: 'token', label: 'Railway API Token', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'password' },
    ],
  },
  {
    id: 'ai',
    label: 'AI Model Provider',
    desc: 'Override the default AI model used by all agents — supports Gemini, OpenAI, Anthropic, OpenRouter',
    icon: <Bot size={15} />,
    color: 'hover:border-sky-400',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    fields: [
      { key: 'provider', label: 'Provider', placeholder: 'gemini | openai | anthropic | openrouter', type: 'text' },
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-... / AIza...', type: 'password' },
      { key: 'model', label: 'Model name (optional)', placeholder: 'e.g. gpt-4o / claude-3-5-sonnet-latest', type: 'text' },
    ],
  },
  {
    id: 'jira',
    label: 'Jira',
    desc: 'Sync sprint boards, auto-assign issues to agents, and post completion comments',
    icon: <Code2 size={15} />,
    color: 'hover:border-blue-400',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    fields: [
      { key: 'domain', label: 'Atlassian Domain', placeholder: 'yourorg.atlassian.net', type: 'url' },
      { key: 'email', label: 'Account Email', placeholder: 'you@company.com', type: 'text' },
      { key: 'apiToken', label: 'API Token', placeholder: 'ATATxxxxxxxxxxxxxxxx', type: 'password' },
    ],
  },
];

export default function ConnectorsTab() {
  const { updateConnectors } = useGameStore();
  const [activeAccordion, setActiveAccordion] = useState<ConnectorId | null>(null);
  const [savedStates, setSavedStates] = useState<Record<string, boolean>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, string>>>({});

  const toggleAccordion = (id: ConnectorId) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  const getFieldValue = (connectorId: string, fieldKey: string) =>
    fieldValues[connectorId]?.[fieldKey] ?? '';

  const setFieldValue = (connectorId: string, fieldKey: string, value: string) => {
    setFieldValues((prev) => ({
      ...prev,
      [connectorId]: { ...(prev[connectorId] ?? {}), [fieldKey]: value },
    }));
  };

  const handleSave = (connector: ConnectorDef) => {
    const vals = fieldValues[connector.id] ?? {};
    // Persist known connectors to store
    if (connector.id === 'github') {
      updateConnectors({
        github: {
          connected: !!(vals.repoUrl && vals.token),
          repoUrl: vals.repoUrl ?? '',
          token: vals.token ?? '',
          autoCommit: true,
        },
      });
    } else if (connector.id === 'vercel') {
      updateConnectors({
        vercel: {
          connected: !!(vals.token),
          token: vals.token ?? '',
          autoDeploy: true,
        },
      });
    } else if (connector.id === 'slack') {
      updateConnectors({
        slack: {
          connected: !!(vals.webhookUrl),
          webhookUrl: vals.webhookUrl ?? '',
          broadcastEvents: true,
        },
      });
    } else if (connector.id === 'ai') {
      updateConnectors({
        ai: {
          provider: (vals.provider as 'gemini' | 'openrouter') ?? 'gemini',
          apiKey: vals.apiKey ?? '',
        },
      });
    }
    setSavedStates((prev) => ({ ...prev, [connector.id]: true }));
    setTimeout(() => setSavedStates((prev) => ({ ...prev, [connector.id]: false })), 2000);
  };

  const connectedCount = Object.values(fieldValues).filter((v) =>
    Object.values(v).some((val) => val.length > 0)
  ).length;

  return (
    <div className="space-y-3 text-gray-900">
      {/* Header */}
      <div className="p-4 rounded-xl bg-white border border-gray-100 soft-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-28 h-28 bg-violet-100/40 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-violet-500 uppercase tracking-wider">
              Integrations
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {connectedCount} of {CONNECTORS.length} connected
            </p>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-semibold text-emerald-600 uppercase">Live</span>
          </div>
        </div>

        {/* Beta disclaimer */}
        <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-700 leading-relaxed">
            <strong>Beta:</strong> Integrations may behave unexpectedly. Agents can push commits, send messages, and trigger deploys — <strong>use at your own risk</strong> on test environments only.
          </p>
        </div>
      </div>

      {/* Connector Cards */}
      <div className="space-y-2">
        {CONNECTORS.map((connector) => {
          const vals = fieldValues[connector.id] ?? {};
          const isConnected = Object.values(vals).some((v) => v.length > 0);
          const isOpen = activeAccordion === connector.id;
          const isSaved = savedStates[connector.id];

          return (
            <div
              key={connector.id}
              className={`rounded-xl border bg-white soft-shadow overflow-hidden transition-all duration-200 ${connector.color} ${isConnected ? 'border-emerald-200' : 'border-gray-100'}`}
            >
              <button
                onClick={() => toggleAccordion(connector.id)}
                className="w-full flex items-center justify-between p-3 text-left focus:outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100'}`}>
                    {connector.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                      {connector.label}
                      {connector.comingSoon && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-gray-100 text-gray-400 font-medium uppercase">Soon</span>
                      )}
                    </h4>
                    <p className="text-[9px] text-gray-400 mt-0.5 line-clamp-1 max-w-[180px]">{connector.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isConnected ? (
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase">
                      Set
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-gray-50 text-gray-400 border border-gray-200 uppercase">
                      Off
                    </span>
                  )}
                  <ChevronDown
                    size={13}
                    className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden border-t border-gray-100"
                  >
                    <div className="p-3 space-y-2.5 bg-gray-50/60">
                      <p className="text-[10px] text-gray-500 leading-relaxed">{connector.desc}</p>

                      {connector.fields.map((field) => (
                        <div key={field.key}>
                          <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            {field.label}
                          </label>
                          <div className="relative">
                            {field.type === 'password' && (
                              <Lock size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                            )}
                            <input
                              type={field.type ?? 'text'}
                              placeholder={field.placeholder}
                              value={getFieldValue(connector.id, field.key)}
                              onChange={(e) => setFieldValue(connector.id, field.key, e.target.value)}
                              className={`w-full py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-[11px] outline-none focus:border-sky-400/70 transition-all ${field.type === 'password' ? 'pl-7 pr-2.5' : 'px-2.5'}`}
                            />
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-2 pt-1">
                        <a
                          href="#"
                          className="flex items-center gap-1 text-[9px] text-sky-500 hover:text-sky-700 font-medium transition-colors"
                          onClick={(e) => e.preventDefault()}
                        >
                          <ExternalLink size={9} /> Docs
                        </a>
                        <button
                          onClick={() => handleSave(connector)}
                          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-600 font-semibold text-[10px] transition-colors cursor-pointer"
                        >
                          {isSaved ? (
                            <><Check size={11} /> Saved!</>
                          ) : (
                            <><Check size={11} /> Save</>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="text-[9px] text-gray-400 text-center leading-relaxed px-2">
        All credentials are stored locally in your browser session and never sent to external servers beyond the target integration.
      </p>
    </div>
  );
}
