import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import axios from 'axios';

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// Configuración adaptada para Supabase (en la nube) o local si estás probando en tu PC
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:123@localhost:5432/tiktok_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Inicializar la tabla automaticamente si no existe
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS liked_videos (
        id SERIAL PRIMARY KEY,
        original_url TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Base de datos sincronizada (tabla liked_videos lista)');
  } catch (err) {
    console.error('❌ Error al inicializar la base de datos:', err.message);
  }
};
initDb();

function extractVideoId(url) {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

async function fetchFromTikWM(videoId) {
  try {
    const res = await axios.get(`https://www.tikwm.com/api/?hd=1`, {
      params: { url: `https://www.tiktok.com/@user/video/${videoId}` },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 4000,
    });
    if (res.data?.data?.play) return res.data.data.play;
  } catch (err) {
    return null;
  }
  return null;
}

async function fetchFromTikWMAlternative(videoId) {
  try {
    const res = await axios.post(
      'https://www.tikwm.com/api/',
      new URLSearchParams({ url: `https://www.tiktok.com/@user/video/${videoId}` }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        timeout: 4000,
      }
    );
    if (res.data?.data?.play) return res.data.data.play;
  } catch (err) {
    return null;
  }
  return null;
}

async function getDirectMp4(tiktokUrl) {
  if (tiktokUrl.includes('.mp4')) return tiktokUrl;

  const videoId = extractVideoId(tiktokUrl);
  if (!videoId) return null;

  let mp4 = await fetchFromTikWM(videoId);
  if (!mp4) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    mp4 = await fetchFromTikWMAlternative(videoId);
  }

  return mp4;
}

// Obtener todos los videos
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
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    res.json(videos);
  } catch (err) {
    console.error('❌ Error al consultar PostgreSQL:', err.message);
    res.status(500).json({ error: 'Error en el servidor', details: err.message });
  }
});

// Insertar un nuevo video
app.post('/api/videos', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'La URL es requerida' });
  }

  try {
    await pool.query('INSERT INTO videos (url) VALUES ($1)', [url]);
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

// Dar o quitar "Me gusta" (Toggle)
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Backend corriendo en puerto ${PORT}`);
});