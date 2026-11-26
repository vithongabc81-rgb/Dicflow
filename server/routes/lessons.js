const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { extractYouTubeId, parseSubtitles } = require('../utils/subtitleParser');
const { fetchYouTubeCaptions } = require('../utils/youtubeCaptions');

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..');
const uploadDir = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 120 * 1024 * 1024 }, // 120 MB
});

// Auto-fetch YouTube video metadata + English captions
router.post('/fetch-youtube', requireAuth, async (req, res) => {
  try {
    const { youtube_url = '' } = req.body || {};
    const videoId = extractYouTubeId(youtube_url);
    if (!videoId) {
      return res.status(400).json({
        error: 'Link YouTube không hợp lệ. Vui lòng dán link dạng https://www.youtube.com/watch?v=...',
      });
    }
    const result = await fetchYouTubeCaptions(videoId);
    // Return 200 even if YouTube cloud IP blocked captions so frontend can auto-fill title/author & show helpful guidance
    return res.json(result);
  } catch (err) {
    console.error('Fetch YouTube captions error:', err);
    return res.status(500).json({
      error: 'Không thể kết nối lấy phụ đề từ YouTube lúc này. Bạn có thể dán phụ đề thủ công bên dưới.',
    });
  }
});

// Preview subtitle parsing without saving
router.post('/parse-subtitles', upload.single('subtitleFile'), (req, res) => {
  try {
    let rawText = req.body?.subtitleText || '';
    if (req.file) {
      rawText = fs.readFileSync(req.file.path, 'utf8');
      fs.unlink(req.file.path, () => {});
    }
    const sentences = parseSubtitles(rawText);
    return res.json({ sentences, count: sentences.length });
  } catch (err) {
    console.error('Subtitle parse error:', err);
    return res.status(400).json({ error: 'Không thể đọc định dạng phụ đề. Vui lòng kiểm tra file .srt/.vtt.' });
  }
});

// List lessons with optional filters & user progress
router.get('/', optionalAuth, (req, res) => {
  try {
    const { topic, level, media_type, search, mine } = req.query;
    const userId = req.user ? req.user.id : null;

    const conditions = [];
    const params = [];

    if (mine === '1' && userId) {
      conditions.push('l.user_id = ?');
      params.push(userId);
    } else if (userId) {
      conditions.push('(l.is_official = 1 OR l.user_id = ?)');
      params.push(userId);
    } else {
      conditions.push('l.is_official = 1');
    }

    if (topic && topic !== 'all') {
      conditions.push('l.topic = ?');
      params.push(String(topic));
    }
    if (level && level !== 'all') {
      conditions.push('l.level = ?');
      params.push(String(level));
    }
    if (media_type && media_type !== 'all') {
      conditions.push('l.media_type = ?');
      params.push(String(media_type));
    }
    if (search && String(search).trim()) {
      const q = `%${String(search).trim().toLowerCase()}%`;
      conditions.push('(LOWER(l.title) LIKE ? OR LOWER(l.description) LIKE ? OR LOWER(l.speaker) LIKE ?)');
      params.push(q, q, q);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const lessons = db
      .prepare(
        `SELECT l.*,
          (SELECT COUNT(*) FROM sentences s WHERE s.lesson_id = l.id) AS sentence_count
         FROM lessons l
         ${whereClause}
         ORDER BY l.is_official ASC, l.id DESC`
      )
      .all(...params);

    // Attach progress if authenticated
    let progressMap = new Map();
    if (userId) {
      const rows = db
        .prepare(
          `SELECT lesson_id,
            COUNT(*) AS attempted_count,
            SUM(CASE WHEN is_mastered = 1 THEN 1 ELSE 0 END) AS mastered_count,
            ROUND(AVG(best_accuracy), 1) AS avg_accuracy
           FROM sentence_attempts
           WHERE user_id = ?
           GROUP BY lesson_id`
        )
        .all(userId);
      for (const r of rows) {
        progressMap.set(r.lesson_id, r);
      }
    }

    const enriched = lessons.map((l) => {
      const p = progressMap.get(l.id);
      const total = l.sentence_count || 0;
      const mastered = p ? Number(p.mastered_count || 0) : 0;
      const attempted = p ? Number(p.attempted_count || 0) : 0;
      return {
        ...l,
        progress: {
          attempted_count: attempted,
          mastered_count: mastered,
          total_sentences: total,
          percent: total > 0 ? Math.round((mastered / total) * 100) : 0,
          avg_accuracy: p ? Number(p.avg_accuracy || 0) : 0,
        },
      };
    });

    return res.json({ lessons: enriched });
  } catch (err) {
    console.error('List lessons error:', err);
    return res.status(500).json({ error: 'Không thể tải danh sách bài học.' });
  }
});

// Get single lesson with all sentences + user attempts
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const lessonId = Number(req.params.id);
    if (!Number.isInteger(lessonId)) {
      return res.status(400).json({ error: 'ID bài học không hợp lệ.' });
    }

    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: 'Không tìm thấy bài học.' });
    }
    if (!lesson.is_official && (!req.user || lesson.user_id !== req.user.id)) {
      return res.status(403).json({ error: 'Bạn không có quyền xem bài học riêng tư này.' });
    }

    const sentences = db
      .prepare('SELECT * FROM sentences WHERE lesson_id = ? ORDER BY seq_index ASC')
      .all(lessonId);

    const attemptMap = new Map();
    if (req.user) {
      const attempts = db
        .prepare('SELECT * FROM sentence_attempts WHERE user_id = ? AND lesson_id = ?')
        .all(req.user.id, lessonId);
      for (const a of attempts) {
        attemptMap.set(a.sentence_id, a);
      }
    }

    const formattedSentences = sentences.map((s) => {
      let keywords = [];
      try {
        keywords = JSON.parse(s.keywords_json || '[]');
      } catch {
        keywords = [];
      }
      const attempt = attemptMap.get(s.id) || null;
      return {
        id: s.id,
        lesson_id: s.lesson_id,
        seq_index: s.seq_index,
        start_time: s.start_time,
        end_time: s.end_time,
        text_en: s.text_en,
        text_vi: s.text_vi,
        keywords,
        attempt: attempt
          ? {
              last_input: attempt.last_input,
              best_accuracy: attempt.best_accuracy,
              last_accuracy: attempt.last_accuracy,
              attempts_count: attempt.attempts_count,
              is_mastered: Boolean(attempt.is_mastered),
              needs_review: Boolean(attempt.needs_review),
            }
          : null,
      };
    });

    return res.json({ lesson, sentences: formattedSentences });
  } catch (err) {
    console.error('Get lesson error:', err);
    return res.status(500).json({ error: 'Không thể tải chi tiết bài học.' });
  }
});

// Create custom lesson (YouTube link or uploaded video/audio + SRT/VTT or JSON sentences)
router.post(
  '/',
  requireAuth,
  upload.fields([
    { name: 'mediaFile', maxCount: 1 },
    { name: 'subtitleFile', maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const {
        title,
        description = '',
        topic = 'daily',
        level = 'B1',
        media_type = 'youtube',
        youtube_url = '',
        accent = 'US',
        speaker = '',
        subtitleText = '',
        sentencesJson = '',
      } = req.body || {};

      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập tiêu đề bài học.' });
      }

      let finalMediaType = media_type;
      let youtubeId = null;
      let mediaUrl = null;
      let thumbnailUrl = '';

      const uploadedMedia = req.files?.mediaFile?.[0];
      const uploadedSub = req.files?.subtitleFile?.[0];

      if (media_type === 'youtube') {
        youtubeId = extractYouTubeId(youtube_url);
        if (!youtubeId) {
          return res.status(400).json({ error: 'Link YouTube không hợp lệ. Vui lòng dán link YouTube đầy đủ.' });
        }
        thumbnailUrl = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
      } else if (media_type === 'upload_video' || media_type === 'upload_audio') {
        if (!uploadedMedia) {
          return res.status(400).json({ error: 'Vui lòng chọn file video hoặc audio để tải lên.' });
        }
        mediaUrl = `/uploads/${uploadedMedia.filename}`;
        const mime = (uploadedMedia.mimetype || '').toLowerCase();
        finalMediaType = mime.startsWith('video/') ? 'upload_video' : 'upload_audio';
      } else {
        finalMediaType = 'audio_tts';
      }

      // Determine sentences
      let parsedSentences = [];
      if (sentencesJson) {
        try {
          const arr = JSON.parse(sentencesJson);
          if (Array.isArray(arr)) {
            parsedSentences = arr
              .filter((s) => s && String(s.text_en || '').trim())
              .map((s, idx) => ({
                start_time: Number(s.start_time) || idx * 5,
                end_time: Math.max((Number(s.start_time) || idx * 5) + 1, Number(s.end_time) || (idx + 1) * 5),
                text_en: String(s.text_en).trim(),
                text_vi: String(s.text_vi || '').trim(),
              }));
          }
        } catch {
          return res.status(400).json({ error: 'Dữ liệu danh sách câu không hợp lệ.' });
        }
      }

      if (parsedSentences.length === 0) {
        let rawSub = subtitleText || '';
        if (uploadedSub) {
          rawSub = fs.readFileSync(uploadedSub.path, 'utf8');
          fs.unlink(uploadedSub.path, () => {});
        }
        parsedSentences = parseSubtitles(rawSub);
      } else if (uploadedSub) {
        fs.unlink(uploadedSub.path, () => {});
      }

      if (parsedSentences.length === 0) {
        return res.status(400).json({
          error: 'Bài học cần có ít nhất 1 câu phụ đề (nhập trực tiếp hoặc tải file .srt/.vtt).',
        });
      }

      const maxEnd = parsedSentences.reduce((acc, s) => Math.max(acc, Number(s.end_time) || 0), 0);
      const durationSec = Math.max(30, Math.round(maxEnd));

      const insertLesson = db.prepare(`
        INSERT INTO lessons (
          slug, title, description, topic, level, media_type, youtube_id,
          media_url, thumbnail_url, duration_sec, accent, speaker, is_official, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);

      const slug = `custom-${req.user.id}-${Date.now()}`;
      const resLesson = insertLesson.run(
        slug,
        String(title).trim(),
        String(description).trim(),
        String(topic),
        String(level),
        finalMediaType,
        youtubeId,
        mediaUrl,
        thumbnailUrl,
        durationSec,
        accent,
        speaker || req.user.name,
        req.user.id
      );

      const lessonId = Number(resLesson.lastInsertRowid);
      const insertSentence = db.prepare(`
        INSERT INTO sentences (lesson_id, seq_index, start_time, end_time, text_en, text_vi, keywords_json)
        VALUES (?, ?, ?, ?, ?, ?, '[]')
      `);

      parsedSentences.forEach((s, idx) => {
        insertSentence.run(lessonId, idx, s.start_time, s.end_time, s.text_en, s.text_vi || '');
      });

      const created = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
      return res.status(201).json({
        lesson: { ...created, sentence_count: parsedSentences.length },
      });
    } catch (err) {
      console.error('Create lesson error:', err);
      return res.status(500).json({ error: 'Không thể tạo bài học mới.' });
    }
  }
);

// Delete user's own custom lesson
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const lessonId = Number(req.params.id);
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
    if (!lesson) return res.status(404).json({ error: 'Không tìm thấy bài học.' });
    if (lesson.is_official || lesson.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Bạn chỉ có thể xóa bài học do mình tạo.' });
    }

    if (lesson.media_url && lesson.media_url.startsWith('/uploads/')) {
      const filePath = path.join(uploadDir, path.basename(lesson.media_url));
      fs.unlink(filePath, () => {});
    }

    db.prepare('DELETE FROM lessons WHERE id = ?').run(lessonId);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete lesson error:', err);
    return res.status(500).json({ error: 'Không thể xóa bài học.' });
  }
});

module.exports = router;
