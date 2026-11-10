'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  Bell,
  Zap,
  ChevronDown,
  Check,
  AlertTriangle,
  MessageSquare,
  Cloud,
  Code2,
  Bot,
  Globe,
  Database,
  RefreshCw,
  ExternalLink,
  Loader2,
  Lock,
  Unplug,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import type { UseIntegrations } from '@/hooks/useIntegrations';

interface OAuthConnectorDef {
  id: 'github' | 'slack' | 'linear' | 'vercel';
  label: string;
  desc: string;
  icon: ReactNode;
  color: string;
  accent: string;
  scopes: string;
  configuredKey: 'githubOAuthConfigured' | 'slackOAuthConfigured' | 'linearOAuthConfigured' | 'vercelOAuthConfigured';
}

const OAUTH_CONNECTORS: OAuthConnectorDef[] = [
  {
    id: 'github',
    label: 'GitHub',
    desc: 'Read files, create branches, and open pull requests on your repos.',
    icon: <GitBranch size={15} />,
    color: 'hover:border-gray-400',
    accent: 'bg-[rgba(23,23,31,0.05)] text-navy/80',
    scopes: 'repo · read:user',
    configuredKey: 'githubOAuthConfigured',
  },
  {
    id: 'slack',
    label: 'Slack',
    desc: 'Post task completions and agent activity to a channel.',
    icon: <Bell size={15} />,
    color: 'hover:border-amber-400',
    accent: 'bg-amber-50 text-amber-700',
    scopes: 'chat:write · channels:read',
    configuredKey: 'slackOAuthConfigured',
  },
  {
    id: 'linear',
    label: 'Linear',
    desc: 'Create issues and keep task status in sync with your team.',
    icon: <Zap size={15} />,
    color: 'hover:border-violet-400',
    accent: 'bg-violet-50 text-violet-700',
    scopes: 'read · write',
    configuredKey: 'linearOAuthConfigured',
  },
  {
    id: 'vercel',
    label: 'Vercel',
    desc: 'View deployments, check project status, and trigger builds.',
    icon: <Cloud size={15} />,
    color: 'hover:border-slate-400',
    accent: 'bg-slate-50 text-slate-700',
    scopes: 'read · write · deploy',
    configuredKey: 'vercelOAuthConfigured',
  },
];

const COMING_SOON = [
  { id: 'notion', label: 'Notion', icon: <Globe size={15} /> },
  { id: 'supabase', label: 'Supabase', icon: <Database size={15} /> },
  { id: 'railway', label: 'Railway', icon: <RefreshCw size={15} /> },
  { id: 'discord', label: 'Discord', icon: <MessageSquare size={15} /> },
  { id: 'jira', label: 'Jira', icon: <Code2 size={15} /> },
];

interface PlatformStatus {
  githubOAuthConfigured: boolean;
  slackOAuthConfigured: boolean;
  linearOAuthConfigured: boolean;
  vercelOAuthConfigured: boolean;
  integrationStorageConfigured: boolean;
  aiConfigured: boolean;
  needed: string[];
}

interface ConnectorsTabProps {
  integrations: UseIntegrations;
}

export default function ConnectorsTab({ integrations }: ConnectorsTabProps) {
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [platform, setPlatform] = useState<PlatformStatus | null>(null);

  // Platform status is fetched once; it only gates the Connect buttons.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/connectors/status')
      .then((r) => r.json())
      .then((d: PlatformStatus) => {
        if (!cancelled) setPlatform(d);
      })
      .catch(() => {
        if (!cancelled) setPlatform(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync OAuth connection status into the game store so the orchestrator
  // and IntentClassifier can see which providers are actually connected.
  // This is what allows agents to execute integration tasks directly
  // without being blocked by a credential prompt.
  useEffect(() => {
    const { syncOAuthConnections } = useGameStore.getState();
    syncOAuthConnections(integrations.connections);
  }, [integrations.connections]);

  // The OAuth callback returns to /workspace?integration=…&provider=…&reason=…
  // Surface the outcome once, then strip the params so a reload cannot replay it.
  const refresh = integrations.refresh;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('integration');
    if (!outcome) return;

    const provider = params.get('provider') ?? 'integration';
    const reason = params.get('reason');
    const timer = window.setTimeout(() => {
      if (outcome === 'connected') {
        setBanner({ kind: 'ok', text: `${provider} connected.` });
        void refresh();
      } else {
        setBanner({
          kind: 'error',
          text: `${provider} connection failed${reason ? ` (${reason.replace(/_/g, ' ')})` : ''}.`,
        });
      }
    }, 0);

    const url = new URL(window.location.href);
    url.searchParams.delete('integration');
    url.searchParams.delete('provider');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', url.toString());

    return () => window.clearTimeout(timer);
  }, [refresh]);

  const connectedByProvider = new Map(
    integrations.connections.map((c) => [c.provider, c] as const),
  );
  const connectedCount = integrations.connections.length;

  const handleDisconnect = async (id: string, label: string) => {
    setBusy(id);
    const ok = await integrations.disconnect(id);
    setBusy(null);
    setBanner(ok ? { kind: 'ok', text: `${label} disconnected and tokens revoked.` } : null);
    if (ok) setTimeout(() => setBanner(null), 3000);
  };

  return (
    <div className="space-y-3 text-navy">
      <div className="p-4 rounded-xl bg-white border border-navy/5 soft-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-28 h-28 bg-violet-100/40 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-ocean-600 to-violet-500 uppercase tracking-wider">
              Integrations
            </h3>
            <p className="text-[10px] text-navy/40 mt-0.5">
              {connectedCount} of {OAUTH_CONNECTORS.length} connected
            </p>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-semibold text-emerald-600 uppercase">Live</span>
          </div>
        </div>

        {integrations.error && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2">
            <AlertTriangle size={12} className="text-rose-500 shrink-0 mt-0.5" />
            <div className="text-[10px] text-rose-700 leading-relaxed">
              {integrations.error}
              {integrations.code === 'server_not_configured' && (
                <span className="block mt-1">
                  Add the integration storage env vars, then reload.
                </span>
              )}
            </div>
          </div>
        )}

        {banner && (
          <div
            className={`mt-3 p-2.5 rounded-lg border flex items-start gap-2 ${
              banner.kind === 'ok'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-rose-50 border-rose-200'
            }`}
          >
            {banner.kind === 'ok' ? (
              <Check size={12} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={12} className="text-rose-500 shrink-0 mt-0.5" />
            )}
            <span
              className={`text-[10px] leading-relaxed ${
                banner.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {banner.text}
            </span>
          </div>
        )}

        {platform && platform.needed.length > 0 && (
          <div className="mt-3 p-2.5 rounded-lg bg-sky-50 border border-sky-200 flex items-start gap-2">
            <AlertTriangle size={12} className="text-sky-500 shrink-0 mt-0.5" />
            <div className="text-[10px] text-sky-700 leading-relaxed">
              <strong>Setup needed (platform owner):</strong>
              <ul className="list-disc ml-3 mt-1 space-y-0.5">
                {platform.needed.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-700 leading-relaxed">
            <strong>Beta:</strong> agents can push commits, send messages, and create issues.{' '}
            <strong>Use at your own risk</strong> on test environments only.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {OAUTH_CONNECTORS.map((connector) => {
          const connection = connectedByProvider.get(connector.id);
          const isConnected = Boolean(connection);
          const isOpen = active === connector.id;
          const configured = platform ? platform[connector.configuredKey] : true;
          const isBusy = busy === connector.id;

          return (
            <div
              key={connector.id}
              className={`rounded-xl border bg-white soft-shadow overflow-hidden transition-all duration-200 ${connector.color} ${
                isConnected ? 'border-emerald-200' : 'border-navy/5'
              }`}
            >
              <button
                onClick={() => setActive(isOpen ? null : connector.id)}
                className="w-full flex items-center justify-between p-3 text-left focus:outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isConnected ? 'bg-emerald-50 text-emerald-600' : connector.accent
                    }`}
                  >
                    {connector.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-navy">{connector.label}</h4>
                    <p className="text-[9px] text-navy/40 mt-0.5 line-clamp-1 max-w-[180px]">
                      {connection?.accountId ?? connector.desc}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isConnected ? (
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase">
                      Connected
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-white/70 text-navy/40 border border-navy/10 uppercase">
                      Off
                    </span>
                  )}
                  <ChevronDown
                    size={13}
                    className={`text-navy/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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
                    className="overflow-hidden border-t border-navy/5"
                  >
                    <div className="p-3 space-y-2.5 bg-white/70">
                      <p className="text-[10px] text-navy/55 leading-relaxed">{connector.desc}</p>

                      {isConnected && connection ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {connection.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="px-1.5 py-0.5 rounded bg-[rgba(23,23,31,0.04)] text-[8px] font-medium text-navy/50"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                          <p className="text-[9px] text-navy/35">
                            Connected {new Date(connection.connectedAt).toLocaleDateString()}
                            {connection.expiresAt
                              ? ` · token refreshes before ${new Date(connection.expiresAt).toLocaleTimeString()}`
                              : ' · token does not expire'}
                          </p>
                          <button
                            onClick={() => handleDisconnect(connector.id, connector.label)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-semibold text-[10px] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isBusy ? (
                              <><Loader2 size={11} className="animate-spin" /> Disconnecting…</>
                            ) : (
                              <><Unplug size={11} /> Disconnect</>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-[9px] text-navy/40">
                            <Lock size={9} />
                            <span>Scopes: {connector.scopes}</span>
                          </div>
                          {configured ? (
                            <a
                              href={`/api/oauth/${connector.id}/start`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ocean-50 hover:bg-ocean-100 border border-ocean-200 text-ocean-600 font-semibold text-[10px] transition-colors"
                            >
                              <ExternalLink size={11} /> Connect {connector.label}
                            </a>
                          ) : (
                            <p className="text-[9px] text-amber-600">
                              Platform OAuth credentials are not configured yet.
                            </p>
                          )}
                          <p className="text-[9px] text-navy/35 leading-relaxed">
                            You&apos;ll be redirected to {connector.label} to approve access. AgentCorp
                            never sees your password.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        <div className="rounded-xl border border-navy/5 bg-white/60 p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-ocean-50 text-ocean-600 flex items-center justify-center">
              <Bot size={15} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-navy">AI Model Provider</h4>
              <p className="text-[9px] text-navy/40 mt-0.5">
                {platform?.aiConfigured
                  ? 'Server key configured'
                  : 'No server key — mock responses'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-navy/5 bg-white/50 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-navy/35 mb-2">
            Coming soon
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMING_SOON.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[rgba(23,23,31,0.03)] text-[9px] text-navy/40"
              >
                {c.icon}
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[9px] text-navy/40 text-center leading-relaxed px-2">
        OAuth tokens are encrypted server-side with AES-256-GCM and never stored in your browser.
      </p>
    </div>
  );
}
