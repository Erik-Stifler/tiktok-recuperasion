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
        url TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Tabla separada para los "Me gusta"
    await pool.query(`
      CREATE TABLE IF NOT EXISTS liked_videos (
        id SERIAL PRIMARY KEY,
        original_url TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Base de datos sincronizada (tablas "videos" y "liked_videos" listas)');
  } catch (err) {
    console.error('❌ Error al inicializar la base de datos:', err.message);
  }
};
initDb();

// Función robusta para extraer el enlace .mp4 real mediante TikWM
async function getDirectMp4(tiktokUrl) {
  if (!tiktokUrl) return null;
  if (tiktokUrl.includes('.mp4') && !tiktokUrl.includes('tiktokv.com')) return tiktokUrl;

  try {
    // Petición GET a TikWM
    const res = await axios.get(`https://www.tikwm.com/api/?hd=1`, {
      params: { url: tiktokUrl },
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tikwm.com/'
      },
      timeout: 6000,
    });
    
    const playUrl = res.data?.data?.play || res.data?.data?.hdplay;
    if (playUrl) {
      return playUrl.startsWith('http') ? playUrl : `https://www.tikwm.com${playUrl}`;
    }

    // Petición POST alternativa si el GET no devuelve el play
    const resAlt = await axios.post(
      'https://www.tikwm.com/api/',
      new URLSearchParams({ url: tiktokUrl }),
      {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 6000,
      }
    );
    
    const playUrlAlt = resAlt.data?.data?.play || resAlt.data?.data?.hdplay;
    if (playUrlAlt) {
      return playUrlAlt.startsWith('http') ? playUrlAlt : `https://www.tikwm.com${playUrlAlt}`;
    }
  } catch (err) {
    console.warn(`⚠️ No se pudo obtener el MP4 directo para: ${tiktokUrl}`);
  }

  // Si todo falla, devolvemos null para evitar el bloqueo CORB de tiktokv
  return null;
}

// ================= RUTAS DE LA API (DEBEN IR PRIMERO) =================

// Obtener todos los videos filtrando solo los que tienen enlace de reproducción válido
app.get('/api/videos', async (req, res) => {
  try {
    const result = await pool.query('SELECT url FROM videos ORDER BY id DESC');
    const rawUrls = result.rows.map((row) => row.url);

    const videos = [];
    for (const url of rawUrls) {
      const streamUrl = await getDirectMp4(url);
      if (streamUrl) {
        videos.push({
          originalUrl: url,
          streamUrl: streamUrl,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    res.json(videos);
  } catch (err) {
    console.error('❌ Error al consultar PostgreSQL:', err.message);
    res.json([]);
  }
});

// Insertar un nuevo video en la tabla 'videos'
app.post('/api/videos', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'La URL es requerida' });
  }

  try {
    await pool.query(
      'INSERT INTO videos (url) VALUES ($1) ON CONFLICT (url) DO NOTHING',
      [url]
    );
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