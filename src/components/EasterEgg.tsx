'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

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
        <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <div className="bg-white p-5 rounded-lg shadow-lg text-center">
            <h2 className="text-lg font-bold mb-2">🎉 Easter Egg Unlocked! 🎉</h2>
            <p className="mb-4">You found the secret feature!</p>
            <button
              onClick={() => setVisible(false)}
              className="flex items-center justify-center p-2 bg-red-500 text-white rounded-lg"
            >
              <X className="mr-2" />
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}