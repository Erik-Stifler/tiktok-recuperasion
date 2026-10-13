import React, { useState, useEffect } from 'react';
import VideoFeed from './components/Feed/VideoFeed';
import VideoGrid from './components/Feed/VideoGrid';
import AddVideoModal from './components/UI/AddVideoModal';
import { LayoutGrid, Smartphone } from 'lucide-react';

export default function App() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [viewMode, setViewMode] = useState('feed');
  const [initialIndex, setInitialIndex] = useState(0);

  const fetchVideos = (resetToTop = false) => {
    setLoading(true);
    fetch('http://192.168.1.19:5000/api/videos')
      .then((res) => res.json())
      .then((data) => {
        setVideos(data);
        if (resetToTop) {
          setInitialIndex(0); // 👈 Forzar inicio en el video más reciente
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error al conectar con PostgreSQL:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleSelectFromGrid = (index) => {
    setInitialIndex(index);
    setViewMode('feed');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center text-white font-semibold">
        Cargando videos desde PostgreSQL...
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <div className="fixed top-5 right-20 z-50 flex gap-2">
        <button
          onClick={() => setViewMode(viewMode === 'feed' ? 'grid' : 'feed')}
          className="bg-black/70 border border-white/20 text-white p-3 rounded-full backdrop-blur-md shadow-2xl hover:bg-white hover:text-black transition active:scale-90"
          title={viewMode === 'feed' ? 'Ver cuadrícula' : 'Ver reproductor'}
        >
          {viewMode === 'feed' ? <LayoutGrid className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
        </button>
      </div>

      <AddVideoModal onVideoAdded={() => fetchVideos(true)} />

      {viewMode === 'grid' ? (
        <VideoGrid videos={videos} onSelectVideo={handleSelectFromGrid} />
      ) : (
        <VideoFeed 
          videos={videos} 
          isMuted={isMuted} 
          onToggleMute={() => setIsMuted((prev) => !prev)} 
          initialIndex={initialIndex}
        />
      )}
    </div>
  );
}