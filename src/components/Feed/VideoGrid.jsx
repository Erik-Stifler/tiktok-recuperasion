import React, { useState, useEffect } from 'react';
import { Play, Heart, Grid, AlertCircle } from 'lucide-react';

const API_BASE = '';

export default function VideoGrid({ videos, onSelectVideo }) {
  const [tab, setTab] = useState('all');
  const [likedUrls, setLikedUrls] = useState([]);

  // 🛡️ BLINDAJE CRÍTICO: Garantizamos que safeVideos sea SIEMPRE un array
  const safeVideos = Array.isArray(videos) ? videos : [];

  const fetchLikes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/likes`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) setLikedUrls(data);
    } catch (err) {
      console.warn('Error al cargar la lista de me gusta:', err.message);
    }
  };

  useEffect(() => {
    fetchLikes();
  }, []);

  const isVideoLiked = (item) => {
    const original = typeof item === 'string' ? item : item?.originalUrl;
    return likedUrls.includes(original);
  };

  // 🛡️ Ahora .filter() se ejecuta sobre safeVideos, que sabemos que es un array
  const likedVideosList = safeVideos.filter(isVideoLiked);
  const displayedVideos = tab === 'liked' ? likedVideosList : safeVideos;

  return (
    <div className="w-full h-full bg-black text-white p-4 md:p-8 pt-20 overflow-y-auto">
      {/* Selector de pestañas */}
      <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-3">
        <button
          onClick={() => setTab('all')}
          className={`flex items-center gap-2 text-sm font-semibold pb-1 transition ${
            tab === 'all'
              ? 'text-pink-500 border-b-2 border-pink-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Grid className="w-4 h-4" /> Todos ({safeVideos.length})
        </button>

        <button
          onClick={() => {
            fetchLikes();
            setTab('liked');
          }}
          className={`flex items-center gap-2 text-sm font-semibold pb-1 transition ${
            tab === 'liked'
              ? 'text-pink-500 border-b-2 border-pink-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4 fill-pink-500 text-pink-500" /> Me gusta ({likedVideosList.length})
        </button>
      </div>

      {/* Grid de Videos */}
      {displayedVideos.length === 0 ? (
        <div className="text-center text-gray-500 py-12 text-sm">
          {tab === 'liked'
            ? 'No tienes videos guardados en la base de datos.'
            : 'No hay videos disponibles.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pb-24">
          {displayedVideos.map((item, index) => {
            const streamUrl = typeof item === 'string' ? item : item.streamUrl;
            const originalUrl = typeof item === 'string' ? item : item.originalUrl;
            // Encontramos el índice real en el array original para la navegación
            const originalIndex = safeVideos.indexOf(item);

            return (
              <div
                key={`${originalUrl}-${index}`}
                onClick={() => onSelectVideo(originalIndex)}
                className="relative aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden group cursor-pointer border border-white/10 hover:border-pink-500 transition-all duration-300 shadow-lg"
              >
                {streamUrl ? (
                  <video
                    src={`${streamUrl}#t=0.1`}
                    preload="metadata"
                    muted
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-gray-400 p-2 text-center">
                    <AlertCircle className="w-6 h-6 mb-1 text-yellow-500" />
                    <span className="text-[10px]">Sin vista previa</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />

                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 text-xs font-semibold text-white drop-shadow">
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Video</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}