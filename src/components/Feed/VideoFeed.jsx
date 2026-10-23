import React, { useRef, useEffect, useCallback, useState } from 'react';
import VideoCard from './VideoCard';
import { useIntersection } from '../../hooks/useIntersection';
import { Play, ChevronUp, ChevronDown } from 'lucide-react';

export default function VideoFeed({ 
  videos = [], 
  isMuted, 
  onToggleMute, 
  onError, 
  onOpenDrawer,
  initialIndex = 0 
}) {
  const containerRef = useRef(null);
  const videoRefs = useRef([]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const safeVideos = Array.isArray(videos) ? videos : [];

  useIntersection(containerRef, videoRefs, isMuted, safeVideos);

  const getCurrentIndex = useCallback(() => {
    const container = containerRef.current;
    if (!container || !safeVideos.length) return 0;

    const scrollTop = container.scrollTop;
    const children = Array.from(container.children);
    
    if (!children.length) return 0;

    let closestIndex = 0;
    let minDistance = Infinity;

    children.forEach((child, idx) => {
      const distance = Math.abs(child.offsetTop - scrollTop);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = idx;
      }
    });

    return closestIndex;
  }, [safeVideos.length]);

  const handleScroll = useCallback(() => {
    const current = getCurrentIndex();
    setActiveIndex((prev) => (prev !== current ? current : prev));
  }, [getCurrentIndex]);

  const scrollToIndex = useCallback((targetIndex) => {
    const container = containerRef.current;
    if (!container || safeVideos.length === 0) return;

    const validIndex = Math.max(0, Math.min(targetIndex, safeVideos.length - 1));
    const targetElement = container.children[validIndex];

    if (targetElement) {
      container.scrollTo({
        top: targetElement.offsetTop,
        behavior: 'auto',
      });
    }
  }, [safeVideos.length]);

  // Posicionar en el video seleccionado de la cuadrícula al montar el feed
  useEffect(() => {
    if (initialIndex > 0) {
      const timer = setTimeout(() => {
        scrollToIndex(initialIndex);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [initialIndex, scrollToIndex]);

  const scrollNext = useCallback(() => {
    const current = getCurrentIndex();
    if (current < safeVideos.length - 1) {
      scrollToIndex(current + 1);
    }
  }, [getCurrentIndex, scrollToIndex, safeVideos.length]);

  const scrollPrev = useCallback(() => {
    const current = getCurrentIndex();
    if (current > 0) {
      scrollToIndex(current - 1);
    }
  }, [getCurrentIndex, scrollToIndex]);

  const handleContainerClick = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) {
      return;
    }
    const current = getCurrentIndex();
    const currentVideo = videoRefs.current[current];
    if (currentVideo) {
      if (currentVideo.paused) {
        currentVideo.play().catch(() => {});
      } else {
        currentVideo.pause();
      }
    }
  };

  useEffect(() => {
    if (safeVideos.length === 0) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        scrollNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        scrollPrev();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        const current = getCurrentIndex();
        const currentVideo = videoRefs.current[current];
        if (currentVideo) {
          if (currentVideo.paused) currentVideo.play().catch(() => {});
          else currentVideo.pause();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onToggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [safeVideos.length, scrollNext, scrollPrev, getCurrentIndex, onToggleMute]);

  if (safeVideos.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center text-center p-6 bg-slate-950">
        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-2xl">
          <Play className="w-8 h-8 text-cyan-400 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-gray-200">Sin videos cargados</h2>
      </div>
    );
  }
    return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4 pointer-events-auto">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
          className="p-3.5 rounded-full bg-black/70 border border-white/20 text-white hover:bg-cyan-500 hover:text-black transition-all duration-200 shadow-2xl active:scale-90 backdrop-blur-md cursor-pointer group"
          title="Video anterior"
        >
          <ChevronUp className="w-6 h-6 transition-transform group-hover:-translate-y-0.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); scrollNext(); }}
          className="p-3.5 rounded-full bg-black/70 border border-white/20 text-white hover:bg-cyan-500 hover:text-black transition-all duration-200 shadow-2xl active:scale-90 backdrop-blur-md cursor-pointer group"
          title="Siguiente video"
        >
          <ChevronDown className="w-6 h-6 transition-transform group-hover:translate-y-0.5" />
        </button>
      </div>

      <main
        ref={containerRef}
        onScroll={handleScroll}
        onClick={handleContainerClick}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar touch-pan-y"
      >
        {/* ✅ MAPEO CORREGIDO Y SEGURO */}
        {safeVideos.map((item, index) => {
          const streamUrl = typeof item === 'string' ? item : item.streamUrl;
          const originalUrl = typeof item === 'string' ? item : item.originalUrl;
          const title = typeof item === 'string' ? 'Video' : (item.title || 'Video de TikTok');
          
          const isNearby = Math.abs(activeIndex - index) <= 1;
          const preloadStrategy = isNearby ? 'auto' : 'metadata';

          return (
            <VideoCard
              key={`${originalUrl}-${index}`}
              url={streamUrl}
              originalUrl={originalUrl}
              title={title}
              index={index}
              isMuted={isMuted}
              onToggleMute={onToggleMute}
              onError={onError}
              preload={preloadStrategy}
              ref={(el) => (videoRefs.current[index] = el)}
            />
          );
        })}
      </main>
    </div>
  );
}

  