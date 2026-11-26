const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const { CURATED_LESSONS, DEMO_VOCAB } = require('./seedData');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'dictation.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      daily_goal INTEGER DEFAULT 15,
      streak_count INTEGER DEFAULT 0,
      last_active_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      topic TEXT NOT NULL,
      level TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'youtube',
      youtube_id TEXT,
      media_url TEXT,
      thumbnail_url TEXT,
      duration_sec INTEGER DEFAULT 180,
      accent TEXT DEFAULT 'US',
      speaker TEXT DEFAULT '',
      is_official INTEGER DEFAULT 0,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sentences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      seq_index INTEGER NOT NULL,
      start_time REAL NOT NULL DEFAULT 0,
      end_time REAL NOT NULL DEFAULT 5,
      text_en TEXT NOT NULL,
      text_vi TEXT DEFAULT '',
      keywords_json TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS sentence_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      sentence_id INTEGER NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
      last_input TEXT DEFAULT '',
      best_accuracy REAL DEFAULT 0,
      last_accuracy REAL DEFAULT 0,
      attempts_count INTEGER DEFAULT 1,
      is_mastered INTEGER DEFAULT 0,
      needs_review INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, sentence_id)
    );

    CREATE TABLE IF NOT EXISTS practice_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      sentence_id INTEGER NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
      accuracy REAL NOT NULL,
      duration_sec INTEGER DEFAULT 15,
      practiced_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vocabulary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      word TEXT NOT NULL,
      phonetic TEXT DEFAULT '',
      part_of_speech TEXT DEFAULT '',
      meaning_vi TEXT DEFAULT '',
      example_en TEXT DEFAULT '',
      lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
      mastery_level INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, word)
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sentences_lesson ON sentences(lesson_id, seq_index);
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON sentence_attempts(user_id, lesson_id);
    CREATE INDEX IF NOT EXISTS idx_logs_user_date ON practice_logs(user_id, practiced_date);
    CREATE INDEX IF NOT EXISTS idx_vocab_user ON vocabulary(user_id);
  `);
}

function formatDateOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}

const SEED_VERSION = 'v2-clean-captions';

function seedDatabase() {
  const prevSeedVer = db.prepare("SELECT value FROM app_meta WHERE key = 'seed_version'").get()?.value;
  const forceRefreshOfficial = prevSeedVer !== SEED_VERSION;

  // 1. Seed or refresh curated lessons inside a single transaction (super fast for 4,000+ sentences)
  const checkLesson = db.prepare(
    `SELECT l.id,
       (SELECT COUNT(*) FROM sentences s WHERE s.lesson_id = l.id) AS sent_count,
       (SELECT s.text_en FROM sentences s WHERE s.lesson_id = l.id ORDER BY s.seq_index ASC LIMIT 1) AS first_text
     FROM lessons l WHERE l.slug = ?`
  );
  const insertLesson = db.prepare(`
    INSERT INTO lessons (
      slug, title, description, topic, level, media_type, youtube_id,
      media_url, thumbnail_url, duration_sec, accent, speaker, is_official, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
  `);
  const updateLessonMeta = db.prepare(`
    UPDATE lessons
    SET title = ?, description = ?, duration_sec = ?, youtube_id = ?, thumbnail_url = ?, speaker = ?
    WHERE id = ?
  `);
  const deleteLessonSentences = db.prepare('DELETE FROM sentences WHERE lesson_id = ?');
  const insertSentence = db.prepare(`
    INSERT INTO sentences (lesson_id, seq_index, start_time, end_time, text_en, text_vi, keywords_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN;');
  try {
    for (const lesson of CURATED_LESSONS) {
      const thumb =
        lesson.thumbnail_url ||
        (lesson.youtube_id ? `https://i.ytimg.com/vi/${lesson.youtube_id}/hqdefault.jpg` : '');
      const existing = checkLesson.get(lesson.slug);

      if (existing) {
        // Refresh sentences if SEED_VERSION bumped, count changed, or first sentence changed
        const expectedFirst = lesson.sentences[0]?.text_en || '';
        if (
          forceRefreshOfficial ||
          Number(existing.sent_count) !== lesson.sentences.length ||
          existing.first_text !== expectedFirst
        ) {
          updateLessonMeta.run(
            lesson.title,
            lesson.description,
            lesson.duration_sec || 180,
            lesson.youtube_id || null,
            thumb,
            lesson.speaker || '',
            existing.id
          );
          deleteLessonSentences.run(existing.id);
          lesson.sentences.forEach((s, idx) => {
            insertSentence.run(
              existing.id,
              idx,
              s.start_time,
              s.end_time,
              s.text_en,
              s.text_vi || '',
              JSON.stringify(s.keywords || [])
            );
          });
        }
        continue;
      }

      const res = insertLesson.run(
        lesson.slug,
        lesson.title,
        lesson.description,
        lesson.topic,
        lesson.level,
        lesson.media_type,
        lesson.youtube_id || null,
        lesson.media_url || null,
        thumb,
        lesson.duration_sec || 180,
        lesson.accent || 'US',
        lesson.speaker || ''
      );

      const lessonId = Number(res.lastInsertRowid);
      lesson.sentences.forEach((s, idx) => {
        insertSentence.run(
          lessonId,
          idx,
          s.start_time,
          s.end_time,
          s.text_en,
          s.text_vi || '',
          JSON.stringify(s.keywords || [])
        );
      });
    }
    db.prepare(
      "INSERT INTO app_meta (key, value) VALUES ('seed_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(SEED_VERSION);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  // 2. Seed Demo Account with realistic progress, mistakes & flashcards
  const demoEmail = 'demo@dictaflow.vn';
  const existingDemo = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);
  if (!existingDemo) {
    const hash = bcrypt.hashSync('demo123456', 10);
    const today = formatDateOffset(0);
    const userRes = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, daily_goal, streak_count, last_active_date)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run('Minh Anh (Demo)', demoEmail, hash, 15, 5, today);

    const demoUserId = Number(userRes.lastInsertRowid);

    // Populate demo vocab
    const insertVocab = db.prepare(`
      INSERT OR IGNORE INTO vocabulary (user_id, word, phonetic, part_of_speech, meaning_vi, example_en, mastery_level, review_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const v of DEMO_VOCAB) {
      insertVocab.run(
        demoUserId,
        v.word,
        v.phonetic,
        v.part_of_speech,
        v.meaning_vi,
        v.example_en,
        v.mastery_level,
        v.review_count
      );
    }

    // Populate demo progress & mistakes from first two lessons
    const firstLesson = db.prepare('SELECT id FROM lessons ORDER BY id ASC LIMIT 1').get();
    const secondLesson = db.prepare('SELECT id FROM lessons ORDER BY id ASC LIMIT 1 OFFSET 1').get();

    const insertAttempt = db.prepare(`
      INSERT OR IGNORE INTO sentence_attempts
        (user_id, lesson_id, sentence_id, last_input, best_accuracy, last_accuracy, attempts_count, is_mastered, needs_review)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertLog = db.prepare(`
      INSERT INTO practice_logs (user_id, lesson_id, sentence_id, accuracy, duration_sec, practiced_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    if (firstLesson) {
      const sents = db
        .prepare('SELECT id, text_en FROM sentences WHERE lesson_id = ? ORDER BY seq_index ASC')
        .all(firstLesson.id);

      sents.slice(0, 5).forEach((s, idx) => {
        const isMistake = idx === 2 || idx === 4;
        const acc = isMistake ? 72 : 100;
        const sampleInput = isMistake
          ? s.text_en.split(' ').slice(0, -2).join(' ')
          : s.text_en;
        insertAttempt.run(
          demoUserId,
          firstLesson.id,
          s.id,
          sampleInput,
          acc,
          acc,
          isMistake ? 2 : 1,
          isMistake ? 0 : 1,
          isMistake ? 1 : 0
        );
        insertLog.run(demoUserId, firstLesson.id, s.id, acc, 22, formatDateOffset(idx % 5));
      });
    }

    if (secondLesson) {
      const sents = db
        .prepare('SELECT id, text_en FROM sentences WHERE lesson_id = ? ORDER BY seq_index ASC')
        .all(secondLesson.id);

      sents.slice(0, 3).forEach((s, idx) => {
        const isMistake = idx === 1;
        const acc = isMistake ? 68 : 96;
        const sampleInput = isMistake
          ? s.text_en.split(' ').slice(0, -3).join(' ')
          : s.text_en;
        insertAttempt.run(
          demoUserId,
          secondLesson.id,
          s.id,
          sampleInput,
          acc,
          acc,
          1,
          isMistake ? 0 : 1,
          isMistake ? 1 : 0
        );
        insertLog.run(demoUserId, secondLesson.id, s.id, acc, 28, formatDateOffset(idx));
      });
    }
  }
}

module.exports = {
  db,
  initSchema,
  seedDatabase,
};
