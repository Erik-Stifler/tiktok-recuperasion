import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { Heart, Volume2, VolumeX, Info, Copy, Check, X } from 'lucide-react';

// Declaración de la API Base usando el hostname actual para compatibilidad local y de red
const API_BASE = `http://${window.location.hostname}:5000`;

const VideoCard = forwardRef(({ url, originalUrl, isMuted, onToggleMute }, ref) => {
  const [isLiked, setIsLiked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const internalRef = useRef(null);

  const videoRef = ref || internalRef;
  const targetLink = originalUrl || url;

  // Consultar a la base de datos si el video actual tiene "Me gusta"
  useEffect(() => {
    if (!targetLink) return;

    fetch(`${API_BASE}/api/likes`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((likedUrls) => {
        if (Array.isArray(likedUrls)) {
          setIsLiked(likedUrls.includes(targetLink));
        }
      })
      .catch((err) => console.warn('Error al verificar like:', err.message));
  }, [targetLink]);

  // Dar o quitar "Me gusta"
  const handleToggleLike = async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/api/likes/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl: targetLink }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIsLiked(data.liked);
    } catch (err) {
      console.error('Error al guardar me gusta:', err.message);
    }
  };

  const handleCopyLink = async (e) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(targetLink);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = targetLink;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  const handleTimeUpdate = (e) => {
    const video = e.target;
    if (video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] snap-start bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src={url}
        loop
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        className="w-full h-full object-contain bg-black"
      />

      {/* Botones de acción lateral */}
      <div className="absolute right-3 bottom-24 z-40 flex flex-col items-center gap-5 text-white">
        <button onClick={handleToggleLike} className="flex flex-col items-center gap-1">
          <div className="p-3 rounded-full bg-black/60 backdrop-blur-md border border-white/10 active:scale-90 transition">
            <Heart
              className={`w-6 h-6 ${
                isLiked ? 'fill-red-500 text-red-500' : 'text-white'
              }`}
            />
          </div>
          <span className="text-[10px] font-semibold drop-shadow">
            {isLiked ? 'Guardado' : 'Me gusta'}
          </span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(true);
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className="p-3 rounded-full bg-black/60 backdrop-blur-md border border-white/10 active:scale-90 transition">
            <Info className="w-6 h-6 text-white" />
          </div>
          <span className="text-[10px] font-semibold drop-shadow">Detalles</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className="p-3 rounded-full bg-black/60 backdrop-blur-md border border-white/10 active:scale-90 transition">
            {isMuted ? (
              <VolumeX className="w-6 h-6 text-red-400" />
            ) : (
              <Volume2 className="w-6 h-6 text-white" />
            )}
          </div>
          <span className="text-[10px] font-semibold drop-shadow">
            {isMuted ? 'Mute' : 'Audio'}
          </span>
        </button>
      </div>

      {/* Barra de Progreso */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-40">
        <div
          className="h-full bg-pink-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Modal de Detalles */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 relative text-white shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-pink-500" /> Detalles del Video
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Enlace original de TikTok:</p>
                <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 text-xs font-mono break-all text-gray-300 max-h-24 overflow-y-auto">
                  {targetLink}
                </div>
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full bg-pink-600 hover:bg-pink-500 font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition active:scale-95 text-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" /> ¡Enlace Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copiar Enlace Original
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

VideoCard.displayName = 'VideoCard';
export default VideoCard;