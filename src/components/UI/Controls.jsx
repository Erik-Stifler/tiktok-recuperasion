import React from 'react';
import { Volume2, VolumeX, Download, Music } from 'lucide-react';

export default function Controls({ isMuted, onToggleMute, videoUrl }) {
  return (
    <div className="absolute right-4 bottom-24 z-20 flex flex-col items-center gap-5">
      <button
        onClick={onToggleMute}
        className="p-3.5 rounded-full bg-black/40 border border-white/15 backdrop-blur-xl hover:bg-white/20 active:scale-90 transition shadow-2xl"
      >
        {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-brand-cyan" />}
      </button>

      <a
        href={videoUrl}
        download="video.mp4"
        target="_blank"
        rel="noreferrer"
        className="p-3.5 rounded-full bg-black/40 border border-white/15 backdrop-blur-xl hover:bg-white/20 active:scale-90 transition shadow-2xl"
      >
        <Download className="w-6 h-6 text-white" />
      </a>

      <a
        href={videoUrl}
        download="audio.mp3"
        target="_blank"
        rel="noreferrer"
        className="p-3.5 rounded-full bg-black/40 border border-white/15 backdrop-blur-xl hover:bg-white/20 active:scale-90 transition shadow-2xl"
      >
        <Music className="w-6 h-6 text-brand-cyan" />
      </a>
    </div>
  );
}