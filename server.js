import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Configuración adaptada para Supabase (en la nube) o local si estás probando en tu PC
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:123@localhost:5432/tiktok_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Inicializar las tablas automáticamente si no existen
const initDb = async () => {
  try {
    // 1. Tabla para los videos principales
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Tabla separada para los "Me gusta"
    await pool.query(`
      CREATE TABLE IF NOT EXISTS liked_videos (
        id SERIAL PRIMARY KEY,
        original_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Base de datos sincronizada (tablas "videos" y "liked_videos" listas)');
  } catch (err) {
    console.error('❌ Error al inicializar la base de datos:', err.message);
  }
};
initDb();

// Función robusta con 3 alternativas gratuitas en cascada
async function getDirectMp4(tiktokUrl) {
  if (!tiktokUrl) return null;
  
  // Si ya es un enlace directo .mp4, lo devolvemos tal cual
  if (tiktokUrl.includes('.mp4') || tiktokUrl.includes('.webm')) {
    return tiktokUrl;
  }

  // Lista de APIs gratuitas y de código abierto
  const apis = [
    {
      name: 'TikWM (Principal)',
      url: `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`,
      extract: (data) => data?.data?.play || data?.data?.hdplay
    },
    {
      name: 'TiklyDown (Alternativa 1)',
      url: `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(tiktokUrl)}`,
      extract: (data) => data?.data?.video?.url || data?.data?.video?.no_watermark || data?.data?.video
    },
    {
      name: 'SL-BJS Workers (Alternativa 2)',
      url: `https://tdownv4.sl-bjs.workers.dev/?down=${encodeURIComponent(tiktokUrl)}`,
      extract: (data) => data?.data?.video_url || data?.data?.url || data?.url
    }
  ];

  for (const api of apis) {
    try {
      console.log(`🔄 Intentando extraer video con: ${api.name}...`);
      
      const res = await axios.get(api.url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeout: 8000, // 8 segundos de tiempo límite
      });
      
      const playUrl = api.extract(res.data);
      
      // Validamos que sea una URL válida
      if (playUrl && typeof playUrl === 'string' && playUrl.startsWith('http')) {
        console.log(`✅ ¡Éxito! Video obtenido con ${api.name}`);
        return playUrl;
      }
    } catch (err) {
      console.warn(`⚠️ ${api.name} falló:`, err.message);
      // Continúa con la siguiente API en la lista
    }
  }

  console.error(`❌ Todas las APIs gratuitas fallaron para: ${tiktokUrl}`);
  return null;
}

// ================= RUTAS DE LA API (DEBEN IR PRIMERO) =================

// Obtener todos los videos
// Obtener todos los videos (VERSIÓN CORREGIDA Y ROBUSTA)
// Obtener todos los videos - VERSIÓN CORREGIDA
app.get('/api/videos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, url, title, created_at 
      FROM videos 
      ORDER BY created_at DESC
    `);
    
    const videos = [];
    for (const row of result.rows) {
      let streamUrl = null;
      
      if (row.url.includes('.mp4') || row.url.includes('.webm')) {
        streamUrl = row.url;
      } else {
        streamUrl = await getDirectMp4(row.url);
      }

      videos.push({
        id: row.id,
        originalUrl: row.url,
        title: row.title || 'Video de TikTok',
        streamUrl: streamUrl, // Se envía aunque sea null (el frontend lo manejará)
        created_at: row.created_at
      });
      
      // Pausa de 150ms para no saturar las APIs gratuitas
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    res.json({ success: true, count: videos.length, videos });
  } catch (err) {
    console.error('❌ Error en /api/videos:', err.message);
    res.status(500).json({ success: false, error: err.message, videos: [] });
  }
}); 
// Insertar un nuevo video de forma segura (evita duplicados sin requerir índice UNIQUE)
app.post('/api/videos', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'La URL es requerida' });
  }

  try {
    // Verificamos si ya existe antes de insertar
    const check = await pool.query('SELECT id FROM videos WHERE url = $1', [url]);
    if (check.rows.length === 0) {
      await pool.query('INSERT INTO videos (url) VALUES ($1)', [url]);
    }
    
    res.status(201).json({ message: 'Video guardado con éxito' });
  } catch (err) {
    console.error('❌ Error al insertar video:', err.message);
    res.status(500).json({ error: 'Error en la base de datos', details: err.message });
  }
});

// Obtener la lista de enlaces originales guardados en "Me gusta"
app.get('/api/likes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT original_url FROM liked_videos ORDER BY created_at DESC'
    );
    const likes = result.rows.map((row) => row.original_url);
    res.json(likes);
  } catch (err) {
    console.error('❌ Error al obtener likes:', err.message);
    res.json([]);
  }
});

// Dar o quitar "Me gusta" (Toggle) en la tabla 'liked_videos'
app.post('/api/likes/toggle', async (req, res) => {
  const { originalUrl } = req.body;
  if (!originalUrl) {
    return res.status(400).json({ error: 'La URL original es requerida' });
  }

  try {
    const check = await pool.query(
      'SELECT id FROM liked_videos WHERE original_url = $1',
      [originalUrl]
    );

    if (check.rows.length > 0) {
      await pool.query('DELETE FROM liked_videos WHERE original_url = $1', [
        originalUrl,
      ]);
      res.json({ liked: false });
    } else {
      await pool.query(
        'INSERT INTO liked_videos (original_url) VALUES ($1)',
        [originalUrl]
      );
      res.json({ liked: true });
    }
  } catch (err) {
    console.error('❌ Error al procesar me gusta:', err.message);
    res.status(500).json({ error: 'Error en el servidor', details: err.message });
  }
});

// ================= CONFIGURACIÓN DEL FRONTEND / CATCH-ALL (AL FINAL) =================

app.use(express.static(path.join(__dirname, 'dist')));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ================= INICIO DEL SERVIDOR =================

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Backend y Frontend corriendo en puerto ${PORT}`);
});