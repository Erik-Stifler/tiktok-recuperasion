import React from 'react';
import { Play, SlidersHorizontal } from 'lucide-react';

export default function Header({ onOpenDrawer }) {
  return (
    <header className="fixed top-0 left-0 w-full z-40 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-cyan to-brand-red p-[2px]">
          <div className="w-full h-full bg-black rounded-full flex items-center justify-center">
            <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
          </div>
        </div>
        <span className="font-extrabold text-base tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
          StreamLoop <span className="text-xs text-brand-cyan">90FPS</span>
        </span>
      </div>

      <button
        onClick={onOpenDrawer}
        className="p-3 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 active:scale-95 transition shadow-lg"
      >
        <SlidersHorizontal className="w-5 h-5 text-white" />
      </button>
    </header>
  );
}