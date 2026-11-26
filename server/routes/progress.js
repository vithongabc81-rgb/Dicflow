const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function formatVietnamDate(dateObj) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(dateObj);
}

function getTodayStr() {
  return formatVietnamDate(new Date());
}

function getDateOffsetStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatVietnamDate(d);
}

function updateUserStreak(userId) {
  const user = db.prepare('SELECT streak_count, last_active_date FROM users WHERE id = ?').get(userId);
  if (!user) return 0;

  const today = getTodayStr();
  const yesterday = getDateOffsetStr(1);

  let nextStreak = user.streak_count || 0;
  if (user.last_active_date === today) {
    nextStreak = Math.max(1, nextStreak);
  } else if (user.last_active_date === yesterday) {
    nextStreak = nextStreak + 1;
  } else {
    nextStreak = 1;
  }

  db.prepare('UPDATE users SET streak_count = ?, last_active_date = ? WHERE id = ?').run(
    nextStreak,
    today,
    userId
  );
  return nextStreak;
}

// Record a dictation sentence attempt
router.post('/attempt', requireAuth, (req, res) => {
  try {
    const { lesson_id, sentence_id, user_input = '', accuracy = 0, duration_sec = 15 } = req.body || {};
    const lessonId = Number(lesson_id);
    const sentenceId = Number(sentence_id);
    const acc = Math.max(0, Math.min(100, Math.round(Number(accuracy) || 0)));

    if (!Number.isInteger(lessonId) || !Number.isInteger(sentenceId)) {
      return res.status(400).json({ error: 'Thiếu thông tin bài học hoặc câu luyện tập.' });
    }

    const sentence = db
      .prepare('SELECT id FROM sentences WHERE id = ? AND lesson_id = ?')
      .get(sentenceId, lessonId);
    if (!sentence) {
      return res.status(404).json({ error: 'Không tìm thấy câu cần lưu tiến độ.' });
    }

    const existing = db
      .prepare('SELECT * FROM sentence_attempts WHERE user_id = ? AND sentence_id = ?')
      .get(req.user.id, sentenceId);

    const isMasteredNow = acc >= 92 ? 1 : 0;
    const needsReviewNow = acc < 92 ? 1 : 0;

    if (existing) {
      const nextBest = Math.max(Number(existing.best_accuracy || 0), acc);
      const nextMastered = existing.is_mastered || isMasteredNow ? 1 : 0;
      const nextNeedsReview = acc >= 92 ? 0 : 1;

      db.prepare(
        `UPDATE sentence_attempts
         SET last_input = ?, best_accuracy = ?, last_accuracy = ?,
             attempts_count = attempts_count + 1, is_mastered = ?, needs_review = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(String(user_input), nextBest, acc, nextMastered, nextNeedsReview, existing.id);
    } else {
      db.prepare(
        `INSERT INTO sentence_attempts
           (user_id, lesson_id, sentence_id, last_input, best_accuracy, last_accuracy, attempts_count, is_mastered, needs_review)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).run(req.user.id, lessonId, sentenceId, String(user_input), acc, acc, isMasteredNow, needsReviewNow);
    }

    const today = getTodayStr();
    db.prepare(
      `INSERT INTO practice_logs (user_id, lesson_id, sentence_id, accuracy, duration_sec, practiced_date)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(req.user.id, lessonId, sentenceId, acc, Math.max(5, Math.min(300, Number(duration_sec) || 15)), today);

    const streak = updateUserStreak(req.user.id);

    return res.json({
      ok: true,
      accuracy: acc,
      is_mastered: Boolean(isMasteredNow),
      needs_review: Boolean(needsReviewNow),
      streak_count: streak,
    });
  } catch (err) {
    console.error('Save attempt error:', err);
    return res.status(500).json({ error: 'Không thể lưu tiến độ câu luyện tập.' });
  }
});

// Dashboard summary & analytics
router.get('/summary', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT id, name, daily_goal, streak_count, last_active_date FROM users WHERE id = ?').get(userId);
    const today = getTodayStr();

    const totals = db
      .prepare(
        `SELECT
           COUNT(*) AS total_attempted,
           SUM(CASE WHEN is_mastered = 1 THEN 1 ELSE 0 END) AS total_mastered,
           SUM(CASE WHEN needs_review = 1 THEN 1 ELSE 0 END) AS mistakes_count,
           ROUND(AVG(best_accuracy), 1) AS avg_accuracy
         FROM sentence_attempts
         WHERE user_id = ?`
      )
      .get(userId);

    const todayLogs = db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(duration_sec), 0) AS total_sec
         FROM practice_logs
         WHERE user_id = ? AND practiced_date = ?`
      )
      .get(userId, today);

    const totalPracticeTime = db
      .prepare('SELECT COALESCE(SUM(duration_sec), 0) AS total_sec FROM practice_logs WHERE user_id = ?')
      .get(userId);

    const vocabCount = db
      .prepare(
        `SELECT COUNT(*) AS total,
           SUM(CASE WHEN mastery_level >= 1 THEN 1 ELSE 0 END) AS mastered
         FROM vocabulary WHERE user_id = ?`
      )
      .get(userId);

    // Completed lessons count (where all sentences are mastered)
    const lessonProgress = db
      .prepare(
        `SELECT l.id, l.title, l.topic, l.level,
           (SELECT COUNT(*) FROM sentences s WHERE s.lesson_id = l.id) AS total_s,
           COUNT(a.id) AS attempted_s,
           SUM(CASE WHEN a.is_mastered = 1 THEN 1 ELSE 0 END) AS mastered_s,
           ROUND(AVG(a.best_accuracy), 1) AS avg_acc,
           MAX(a.updated_at) AS last_practiced
         FROM sentence_attempts a
         JOIN lessons l ON l.id = a.lesson_id
         WHERE a.user_id = ?
         GROUP BY l.id
         ORDER BY last_practiced DESC`
      )
      .all(userId);

    const completedLessons = lessonProgress.filter(
      (lp) => lp.total_s > 0 && Number(lp.mastered_s) >= Number(lp.total_s)
    ).length;

    // 7-day chart
    const dailyRows = db
      .prepare(
        `SELECT practiced_date, COUNT(*) AS sentences, ROUND(AVG(accuracy), 1) AS avg_accuracy
         FROM practice_logs
         WHERE user_id = ? AND practiced_date >= ?
         GROUP BY practiced_date`
      )
      .all(userId, getDateOffsetStr(6));

    const dailyMap = new Map(dailyRows.map((r) => [r.practiced_date, r]));
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = getDateOffsetStr(i);
      const row = dailyMap.get(dateStr);
      last7Days.push({
        date: dateStr,
        label: dateStr.slice(5).replace('-', '/'),
        sentences: row ? Number(row.sentences) : 0,
        avg_accuracy: row ? Number(row.avg_accuracy) : 0,
      });
    }

    // Topic breakdown
    const topicStats = db
      .prepare(
        `SELECT l.topic,
           COUNT(a.id) AS sentences_practiced,
           SUM(CASE WHEN a.is_mastered = 1 THEN 1 ELSE 0 END) AS mastered,
           ROUND(AVG(a.best_accuracy), 1) AS avg_accuracy
         FROM sentence_attempts a
         JOIN lessons l ON l.id = a.lesson_id
         WHERE a.user_id = ?
         GROUP BY l.topic`
      )
      .all(userId);

    return res.json({
      streak_count: user?.streak_count || 0,
      daily_goal: user?.daily_goal || 15,
      today_sentences: Number(todayLogs?.count || 0),
      today_minutes: Math.round(Number(todayLogs?.total_sec || 0) / 60),
      total_minutes: Math.round(Number(totalPracticeTime?.total_sec || 0) / 60),
      total_attempted: Number(totals?.total_attempted || 0),
      total_mastered: Number(totals?.total_mastered || 0),
      mistakes_count: Number(totals?.mistakes_count || 0),
      avg_accuracy: Number(totals?.avg_accuracy || 0),
      completed_lessons: completedLessons,
      vocab_total: Number(vocabCount?.total || 0),
      vocab_mastered: Number(vocabCount?.mastered || 0),
      last_7_days: last7Days,
      topic_stats: topicStats,
      recent_lessons: lessonProgress.slice(0, 6),
    });
  } catch (err) {
    console.error('Summary error:', err);
    return res.status(500).json({ error: 'Không thể tải thống kê học tập.' });
  }
});

// List mistakes that need review
router.get('/mistakes', requireAuth, (req, res) => {
  try {
    const mistakes = db
      .prepare(
        `SELECT a.id AS attempt_id, a.last_input, a.last_accuracy, a.best_accuracy, a.attempts_count, a.updated_at,
                s.id AS sentence_id, s.seq_index, s.start_time, s.end_time, s.text_en, s.text_vi,
                l.id AS lesson_id, l.title AS lesson_title, l.topic, l.level, l.media_type, l.youtube_id, l.media_url, l.accent
         FROM sentence_attempts a
         JOIN sentences s ON s.id = a.sentence_id
         JOIN lessons l ON l.id = a.lesson_id
         WHERE a.user_id = ? AND a.needs_review = 1
         ORDER BY a.updated_at DESC`
      )
      .all(req.user.id);

    return res.json({ mistakes });
  } catch (err) {
    console.error('Mistakes error:', err);
    return res.status(500).json({ error: 'Không thể tải danh sách câu hay sai.' });
  }
});

// Mark a mistake resolved
router.post('/mistakes/:sentenceId/resolve', requireAuth, (req, res) => {
  try {
    const sentenceId = Number(req.params.sentenceId);
    const { accuracy = 100, user_input = '' } = req.body || {};
    const existing = db
      .prepare('SELECT * FROM sentence_attempts WHERE user_id = ? AND sentence_id = ?')
      .get(req.user.id, sentenceId);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy mục ôn tập.' });
    }

    const acc = Math.max(92, Math.min(100, Math.round(Number(accuracy) || 100)));
    db.prepare(
      `UPDATE sentence_attempts
       SET last_input = ?, last_accuracy = ?, best_accuracy = MAX(best_accuracy, ?),
           is_mastered = 1, needs_review = 0, attempts_count = attempts_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(String(user_input), acc, acc, existing.id);

    const streak = updateUserStreak(req.user.id);
    return res.json({ ok: true, streak_count: streak });
  } catch (err) {
    console.error('Resolve mistake error:', err);
    return res.status(500).json({ error: 'Không thể cập nhật trạng thái ôn tập.' });
  }
});

module.exports = router;
