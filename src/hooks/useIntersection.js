import { useEffect } from 'react';

export function useIntersection(containerRef, videoRefs, isMuted, videos) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !videos.length) return;

    const options = {
      root: container,
      threshold: 0.6, // Se activa cuando el video cubre más del 60% de la pantalla
    };

    const handleIntersection = (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;

        if (entry.isIntersecting) {
          // El video entra en pantalla: reproduce con sonido/mute según estado
          video.muted = isMuted;
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {});
          }
        } else {
          // El video sale de pantalla: se pausa y SE REINICIA al segundo 0
          video.pause();
          video.currentTime = 0; // 👈 Reinicia desde el principio
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, options);

    videoRefs.current.forEach((videoEl) => {
      if (videoEl) observer.observe(videoEl);
    });

    return () => {
      observer.disconnect();
    };
  }, [containerRef, videoRefs, isMuted, videos]);
}