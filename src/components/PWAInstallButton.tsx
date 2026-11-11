import React from 'react';
import { usePWAInstall } from '../game/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, promptInstall } = usePWAInstall();

  if (!isInstallable) return null;

  return (
    <button
      type="button"
      onClick={promptInstall}
      className="min-h-[44px] px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 shadow-lg"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden="true"
      >
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
        <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
      <span>Install Android Game</span>
    </button>
  );
};
