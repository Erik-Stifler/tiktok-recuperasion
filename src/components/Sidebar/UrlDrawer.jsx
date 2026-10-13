import React, { useState } from 'react';
import { FileText, X, AlertCircle } from 'lucide-react';
import { parseTxtContent, readFileAsText } from '../../utils/txtParser';

export default function UrlDrawer({ isOpen, onClose, onLoadUrls }) {
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      setInputText(content);
    } catch (err) {
      console.error('Error al leer el archivo:', err);
    }
  };

  const handleSubmit = () => {
    const urls = parseTxtContent(inputText);
    onLoadUrls(urls);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-md">
      <aside className="w-full sm:w-96 h-full bg-slate-900 border-r border-white/10 p-6 flex flex-col justify-between shadow-2xl">
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-cyan" /> Cargar Enlaces (.txt)
            </h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <label className="block p-4 border border-dashed border-white/20 rounded-2xl hover:border-brand-cyan bg-white/5 cursor-pointer text-center transition mb-4">
            <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <span className="text-xs font-semibold text-slate-300">Seleccionar bloc de notas (.txt)</span>
            <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
          </label>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="O pega aquí los enlaces directos (un enlace por línea)..."
            className="w-full h-48 bg-slate-950 border border-white/10 rounded-2xl p-3.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-cyan resize-none mb-4 no-scrollbar"
          />

          <button
            onClick={handleSubmit}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-red to-pink-600 font-bold text-sm shadow-lg shadow-brand-red/30 active:scale-98 transition"
          >
            Cargar a Reproducción
          </button>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/10">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-yellow-400" /> Videos borrados se descartarán automáticamente
          </p>
        </div>
      </aside>
    </div>
  );
}