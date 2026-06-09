'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';

export default function EasterEgg() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'e') {
        setVisible(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  return (
    <>
      {visible && (
        <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-50">
          <div className="bg-white p-6 rounded-2xl card-shadow text-center max-w-sm mx-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 via-cyan-400 to-green-400 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Easter Egg Unlocked!</h2>
            <p className="text-sm text-gray-500 mb-4">You found the secret feature!</p>
            <button
              onClick={() => setVisible(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
