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

// Inicializar las tablas automáticamente con soporte para stream_url
const initDb = async () => {
  try {
    // 1. Tabla para los videos principales (con columna stream_url para optimizar)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        stream_url TEXT,
        title VARCHAR,
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

// Función para obtener el MP4 directo desde TikWM
async function getDirectMp4(tiktokUrl) {
  if (tiktokUrl && tiktokUrl.includes('.mp4')) return tiktokUrl;

  try {
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
    console.warn(`⚠️ Error al obtener MP4 para: ${tiktokUrl}`);
  }

  return null;
}

// ================= RUTAS DE LA API (DEBEN IR PRIMERO) =================

// Obtener todos los videos de forma ultra rápida desde la base de datos
app.get('/api/videos', async (req, res) => {
  try {
    const result = await pool.query('SELECT url, stream_url FROM videos ORDER BY id DESC');
    
    const videos = result.rows.map((row) => ({
      originalUrl: row.url,
      streamUrl: row.stream_url || row.url, // Si no hay stream guardado, usa la URL como respaldo
    }));

    res.json(videos);
  } catch (err) {
    console.error('❌ Error al consultar PostgreSQL:', err.message);
    res.status(500).json({ error: 'Error en el servidor', details: err.message });
  }
});

// Insertar un nuevo video: resuelve el MP4 una sola vez al guardar
app.post('/api/videos', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'La URL es requerida' });
  }

  try {
    // Obtenemos el link directo MP4 antes de guardar
    const streamUrl = await getDirectMp4(url);

    await pool.query(
      `INSERT INTO videos (url, stream_url) VALUES ($1, $2) 
       ON CONFLICT (url) DO UPDATE SET stream_url = EXCLUDED.stream_url`,
      [url, streamUrl]
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
    res.status(500).json({ error: 'Error al obtener likes', details: err.message });
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