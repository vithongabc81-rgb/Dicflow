const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initSchema, seedDatabase } = require('./db');

const authRoutes = require('./routes/auth');
const lessonsRoutes = require('./routes/lessons');
const progressRoutes = require('./routes/progress');
const vocabRoutes = require('./routes/vocab');

// Initialize SQLite schema and seed curated data + demo account
initSchema();
seedDatabase();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploaded media files
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const uploadsDir = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'DictaFlow', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/vocab', vocabRoutes);

// Serve built frontend in production if present
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Lỗi máy chủ không xác định.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DictaFlow server listening on http://0.0.0.0:${PORT}`);
});
