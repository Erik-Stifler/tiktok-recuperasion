import { useState, useCallback } from 'react';

export const useVideoManager = () => {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const resolveTikTokUrl = async (url) => {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();

    // Enlaces directos de video o streams
    if (
      cleanUrl.endsWith('.mp4') ||
      cleanUrl.endsWith('.webm') ||
      cleanUrl.endsWith('.mov') ||
      cleanUrl.includes('.mp4?') ||
      cleanUrl.includes('.webm?') ||
      cleanUrl.startsWith('blob:')
    ) {
      return cleanUrl;
    }

    const match = cleanUrl.match(/(\d{18,20})/);
    if (!match) {
      // Si es una URL http/https genérica, intentar cargarla como video directo
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        return cleanUrl;
      }
      return null;
    }

    const videoId = match[1];
    const targetUrl = `https://www.tiktok.com/@video/video/${videoId}`;

    // Intento 1: Servidor Directo
    try {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`);
      const data = await res.json();
      if (data?.data?.play) return data.data.play;
    } catch {
      // Ignorar e intentar con el proxy
    }

    // Intento 2: Servidor de Respaldo Proxy
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`)}`;
      const res = await fetch(proxyUrl);
      const data = await res.json();
      if (data?.data?.play) return data.data.play;
    } catch {
      console.warn('Error al cargar video de TikTok con ID:', videoId);
    }

    return null;
  };

  const loadUrls = useCallback(async (urlList) => {
    if (!urlList || urlList.length === 0) return;
    setIsLoading(true);

    // Peticiones paralelas para respuesta instantánea
    const promises = urlList.map((url) => resolveTikTokUrl(url));
    const results = await Promise.all(promises);
    const validVideos = results.filter(Boolean);

    setVideos(validVideos);
    setIsLoading(false);
  }, []);

  const removeBrokenVideo = useCallback((index) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return {
    videos,
    isLoading,
    isMuted,
    loadUrls,
    removeBrokenVideo,
    toggleMute,
  };
};