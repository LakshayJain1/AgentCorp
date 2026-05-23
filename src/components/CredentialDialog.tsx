'use client';

import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export default function CredentialDialog() {
  const credentialRequest = useGameStore((s) => s.credentialRequest);
  const provideCredential = useGameStore((s) => s.provideCredential);
  const dismissCredentialRequest = useGameStore((s) => s.dismissCredentialRequest);
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);

  if (!credentialRequest || credentialRequest.status !== 'pending') return null;

  const handleSubmit = () => {
    if (!value.trim()) return;
    provideCredential(credentialRequest.credentialKey, value.trim());
    setValue('');
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-panel border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🔑</span>
              <h2 className="text-base font-semibold text-text">Credentials Required</h2>
            </div>

            <div className="bg-surface rounded-lg p-3 mb-4 text-sm text-text/80 space-y-1">
              <p>
                <span className="font-medium text-text">Task:</span> {credentialRequest.taskTitle}
              </p>
              <p>
                <span className="font-medium text-text">Required:</span> {credentialRequest.credentialLabel}
              </p>
              <p className="text-xs text-text/60 mt-2">{credentialRequest.reason}</p>
            </div>

            <div className="text-xs text-text/60 mb-3">
              The PM has identified that this task needs external credentials. Provide them below to continue.
            </div>

            <div className="relative">
              <input
                type={showValue ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`Enter ${credentialRequest.credentialLabel}...`}
                className="w-full px-3 py-2 pr-10 text-sm bg-surface border border-border rounded-lg text-text placeholder-text/30 outline-none focus:border-[#00f5ff]/50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit();
                }}
              />
              <button
                onClick={() => setShowValue(!showValue)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text/40 hover:text-text/70 text-xs"
              >
                {showValue ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-5 pb-5">
            <button
              onClick={() => {
                dismissCredentialRequest();
                setValue('');
              }}
              className="px-3 py-1.5 text-xs font-medium text-text/60 hover:text-text/80 border border-border rounded-lg hover:bg-surface/50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!value.trim()}
              className="px-4 py-1.5 text-xs font-medium bg-[#00f5ff]/20 border border-[#00f5ff]/50 text-[#00f5ff] rounded-lg hover:bg-[#00f5ff]/30 disabled:opacity-30"
            >
              Provide & Resume
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
