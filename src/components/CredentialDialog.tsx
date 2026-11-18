'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Eye, EyeOff, Key, Plug } from 'lucide-react';
import { PROVIDER_LABELS } from '@/ai/actionGuard';

export default function CredentialDialog() {
  const credentialRequest = useGameStore((s) => s.credentialRequest);
  const provideCredential = useGameStore((s) => s.provideCredential);
  const dismissCredentialRequest = useGameStore((s) => s.dismissCredentialRequest);
  const integrationPrompt = useGameStore((s) => s.integrationPrompt);
  const deferIntegrationPrompt = useGameStore((s) => s.deferIntegrationPrompt);
  const cancelIntegrationTask = useGameStore((s) => s.cancelIntegrationTask);
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);

  // Integrations that live in the Integrations tab are connected there, not pasted here.
  if (integrationPrompt) {
    const names = integrationPrompt.providers.map((p) => PROVIDER_LABELS[p] ?? p);
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-label="Connect an integration"
            className="bg-surface border border-navy/10 rounded-2xl card-shadow w-full max-w-md mx-4 overflow-hidden"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400/20 to-indigo-400/20 flex items-center justify-center">
                  <Plug className="w-4 h-4 text-sky-400" />
                </div>
                <h2 className="text-base font-semibold text-navy">Connect {names.join(' and ')} to continue</h2>
              </div>

              <div className="bg-white/[0.06] rounded-xl p-3 mb-4 text-sm text-navy/70 space-y-1">
                <p>
                  <span className="font-semibold text-navy">Task:</span> {integrationPrompt.taskTitle}
                </p>
                <p>
                  <span className="font-semibold text-navy">Needs:</span> {names.join(', ')}
                </p>
              </div>

              <div className="text-xs text-navy/55">
                {names.join(' and ')} {names.length > 1 ? 'aren’t' : 'isn’t'} connected yet. Connect {names.length > 1 ? 'them' : 'it'} in the Integrations tab
                and the task resumes on its own, with nothing to paste here.
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                onClick={cancelIntegrationTask}
                className="px-3 py-1.5 text-xs font-medium text-navy/55 hover:text-navy/80 border border-navy/10 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel task
              </button>
              <button
                onClick={deferIntegrationPrompt}
                className="px-4 py-1.5 text-xs font-medium bg-black text-white rounded-full hover:bg-[#121212] transition-all shadow-sm cursor-pointer"
              >
                Open Integrations
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!credentialRequest || credentialRequest.status !== 'pending') return null;

  const handleSubmit = () => {
    if (!value.trim()) return;
    provideCredential(credentialRequest.credentialKey, value.trim());
    setValue('');
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-surface border border-navy/10 rounded-2xl card-shadow w-full max-w-md mx-4 overflow-hidden"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-400/20 flex items-center justify-center">
                <Key className="w-4 h-4 text-amber-400" />
              </div>
              <h2 className="text-base font-semibold text-navy">Credentials Required</h2>
            </div>

            <div className="bg-white/[0.06] rounded-xl p-3 mb-4 text-sm text-navy/70 space-y-1">
              <p>
                <span className="font-semibold text-navy">Task:</span> {credentialRequest.taskTitle}
              </p>
              <p>
                <span className="font-semibold text-navy">Required:</span> {credentialRequest.credentialLabel}
              </p>
              <p className="text-xs text-navy/40 mt-2">{credentialRequest.reason}</p>
            </div>

            <div className="text-xs text-navy/55 mb-3">
              The PM has identified that this task needs external credentials. Provide them below to continue.
            </div>

            <div className="relative">
              <input
                type={showValue ? 'text' : 'password'}
                // A password manager must not pre-fill this with the user's saved site password.
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore
                name="agentcorp-credential"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`Enter ${credentialRequest.credentialLabel}...`}
                className="w-full px-3 py-2 pr-10 text-sm bg-white/[0.06] border border-navy/10 rounded-xl text-navy placeholder:text-navy/35 outline-none focus:border-sky-500/25 focus:ring-2 focus:ring-sky-500/25 transition-all"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit();
                }}
              />
              <button
                onClick={() => setShowValue(!showValue)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy/70 cursor-pointer"
              >
                {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-5 pb-5">
            <button
              onClick={() => {
                dismissCredentialRequest();
                setValue('');
              }}
              className="px-3 py-1.5 text-xs font-medium text-navy/55 hover:text-navy/80 border border-navy/10 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!value.trim()}
              className="px-4 py-1.5 text-xs font-medium bg-black text-white rounded-full hover:bg-[#121212] disabled:opacity-40 transition-all shadow-sm cursor-pointer"
            >
              Provide & Resume
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
