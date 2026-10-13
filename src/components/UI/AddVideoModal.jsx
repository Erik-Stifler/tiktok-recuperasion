import React, { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';

export default function AddVideoModal({ onVideoAdded }) {
  const [isOpen, setIsOpen] = useState(false);
  const [urlsText, setUrlsText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!urlsText.trim()) return;

    // Procesa el texto en bloque para extraer solo los enlaces válidos
    const urlsArray = urlsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        if (line.toLowerCase().startsWith('enlace:')) {
          return line.replace(/^enlace:\s*/i, '').trim();
        }
        return line;
      })
      .filter((line) => {
        if (line.toLowerCase().includes('fecha:')) return false;
        return line.startsWith('http://') || line.startsWith('https://');
      });

    if (urlsArray.length === 0) {
      alert('No se encontraron enlaces válidos para procesar.');
      return;
    }

    setLoading(true);

    // URL dinámica: Toma la de Render si está configurada, de lo contrario usa localhost para desarrollo
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

    try {
      // Envía cada enlace válido al servidor en bucle
      for (const url of urlsArray) {
        await fetch(`${BACKEND_URL}/api/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
      }

      setUrlsText('');
      setIsOpen(false);
      if (onVideoAdded) onVideoAdded(); // Recarga la lista en la app
    } catch (err) {
      console.error('Error al guardar los videos:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón flotante para abrir modal */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-5 left-5 z-50 bg-pink-600 hover:bg-pink-500 text-white p-3 rounded-full shadow-2xl transition active:scale-90 flex items-center justify-center"
        title="Agregar nuevos videos"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modal / Formulario */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative text-white shadow-2xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-4">Agregar Videos en Masa</h3>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Pega tu lista (el sistema ignorará las fechas y extraerá los enlaces)
                </label>
                <textarea
                  required
                  rows={8}
                  placeholder="Fecha: 2023-11-12 20:43:53 UTC&#10;Enlace: https://www.tiktokv.com/share/video/...&#10;&#10;Fecha: 2023-11-12 20:45:00 UTC&#10;Enlace: https://www.tiktokv.com/share/video/..."
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-pink-500 resize-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-600 to-red-500 font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Guardando todos...
                  </>
                ) : (
                  'Guardar en PostgreSQL'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}