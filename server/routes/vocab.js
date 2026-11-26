const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Built-in quick English -> Vietnamese dictionary for common words
const QUICK_DICT = {
  rut: { phonetic: '/rʌt/', part_of_speech: 'noun', meaning_vi: 'lối mòn, thói quen nhàm chán' },
  habit: { phonetic: '/ˈhæb.ɪt/', part_of_speech: 'noun', meaning_vi: 'thói quen' },
  subtract: { phonetic: '/səbˈtrækt/', part_of_speech: 'verb', meaning_vi: 'trừ đi, loại bỏ' },
  memorable: { phonetic: '/ˈmem.ər.ə.bəl/', part_of_speech: 'adjective', meaning_vi: 'đáng nhớ, khó quên' },
  passion: { phonetic: '/ˈpæʃ.ən/', part_of_speech: 'noun', meaning_vi: 'niềm đam mê' },
  perseverance: { phonetic: '/ˌpɜːr.səˈvɪr.əns/', part_of_speech: 'noun', meaning_vi: 'sự kiên trì, bền bỉ' },
  innovative: { phonetic: '/ˈɪn.ə.veɪ.tɪv/', part_of_speech: 'adjective', meaning_vi: 'đổi mới, sáng tạo' },
  assume: { phonetic: '/əˈsuːm/', part_of_speech: 'verb', meaning_vi: 'giả định, cho rằng' },
  achieve: { phonetic: '/əˈtʃiːv/', part_of_speech: 'verb', meaning_vi: 'đạt được, giành được' },
  defy: { phonetic: '/dɪˈfaɪ/', part_of_speech: 'verb', meaning_vi: 'thách thức, bất chấp' },
  instrument: { phonetic: '/ˈɪn.strə.mənt/', part_of_speech: 'noun', meaning_vi: 'nhạc cụ, công cụ' },
  powerful: { phonetic: '/ˈpaʊə.fəl/', part_of_speech: 'adjective', meaning_vi: 'mạnh mẽ, đầy sức thuyết phục' },
  experience: { phonetic: '/ɪkˈspɪə.ri.əns/', part_of_speech: 'noun', meaning_vi: 'trải nghiệm, kinh nghiệm' },
  suggest: { phonetic: '/səˈdʒest/', part_of_speech: 'verb', meaning_vi: 'đề xuất, gợi ý' },
  demanding: { phonetic: '/dɪˈmæn.dɪŋ/', part_of_speech: 'adjective', meaning_vi: 'đòi hỏi cao, áp lực' },
  receipt: { phonetic: '/rɪˈsiːt/', part_of_speech: 'noun', meaning_vi: 'hóa đơn, biên lai' },
  departure: { phonetic: '/dɪˈpɑːr.tʃər/', part_of_speech: 'noun', meaning_vi: 'giờ khởi hành' },
  reservation: { phonetic: '/ˌrez.ərˈveɪ.ʃən/', part_of_speech: 'noun', meaning_vi: 'sự đặt chỗ trước' },
  collaborate: { phonetic: '/kəˈlæb.ə.reɪt/', part_of_speech: 'verb', meaning_vi: 'hợp tác, phối hợp' },
  retention: { phonetic: '/rɪˈten.ʃən/', part_of_speech: 'noun', meaning_vi: 'sự giữ chân, lưu giữ' },
  milestones: { phonetic: '/ˈmaɪl.stoʊnz/', part_of_speech: 'noun', meaning_vi: 'các cột mốc quan trọng' },
  continuous: { phonetic: '/kənˈtɪn.ju.əs/', part_of_speech: 'adjective', meaning_vi: 'liên tục, không ngừng' },
  procrastinator: { phonetic: '/prəˈkræs.tɪ.neɪ.tər/', part_of_speech: 'noun', meaning_vi: 'người hay trì hoãn' },
  introvert: { phonetic: '/ˈɪn.trə.vɜːrt/', part_of_speech: 'noun', meaning_vi: 'người hướng nội' },
  antisocial: { phonetic: '/ˌæn.tiˈsoʊ.ʃəl/', part_of_speech: 'adjective', meaning_vi: 'ngại giao tiếp, khép kín' },
  challenges: { phonetic: '/ˈtʃæl.ɪn.dʒɪz/', part_of_speech: 'noun', meaning_vi: 'những thử thách' },
  actually: { phonetic: '/ˈæk.tʃu.ə.li/', part_of_speech: 'adverb', meaning_vi: 'thực sự, thực ra' },
  congratulations: { phonetic: '/kənˌɡrætʃ.əˈleɪ.ʃənz/', part_of_speech: 'noun', meaning_vi: 'lời chúc mừng' },
  neighborhood: { phonetic: '/ˈneɪ.bər.hʊd/', part_of_speech: 'noun', meaning_vi: 'khu phố, khu dân cư' },
  residents: { phonetic: '/ˈrez.ɪ.dənts/', part_of_speech: 'noun', meaning_vi: 'cư dân' },
  renew: { phonetic: '/rɪˈnuː/', part_of_speech: 'verb', meaning_vi: 'gia hạn, làm mới' },
};

// Quick word lookup (no auth required so learners can click words anytime)
router.get('/lookup/:word', async (req, res) => {
  const cleanWord = String(req.params.word || '')
    .toLowerCase()
    .replace(/[^a-z'-]/g, '')
    .trim();

  if (!cleanWord) {
    return res.status(400).json({ error: 'Từ cần tra không hợp lệ.' });
  }

  const localEntry = QUICK_DICT[cleanWord] || null;
  let phonetic = localEntry?.phonetic || '';
  let part_of_speech = localEntry?.part_of_speech || '';
  let meaning_vi = localEntry?.meaning_vi || '';
  let definition_en = '';

  // Also check if keyword exists in sentences table
  if (!meaning_vi) {
    const rows = db.prepare('SELECT keywords_json FROM sentences WHERE keywords_json LIKE ? LIMIT 5').all(`%${cleanWord}%`);
    for (const r of rows) {
      try {
        const arr = JSON.parse(r.keywords_json || '[]');
        const found = arr.find((k) => String(k.word).toLowerCase() === cleanWord);
        if (found) {
          phonetic = found.phonetic || phonetic;
          meaning_vi = found.meaning_vi || meaning_vi;
          break;
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  // Enrich from free dictionary API (best-effort, fast timeout)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (response.ok) {
      const data = await response.json();
      const first = Array.isArray(data) ? data[0] : null;
      if (first) {
        if (!phonetic) {
          phonetic =
            first.phonetic ||
            (first.phonetics || []).find((p) => p.text)?.text ||
            '';
        }
        const firstMeaning = (first.meanings || [])[0];
        if (firstMeaning) {
          if (!part_of_speech) part_of_speech = firstMeaning.partOfSpeech || '';
          definition_en = firstMeaning.definitions?.[0]?.definition || '';
        }
      }
    }
  } catch {
    // Graceful offline fallback
  }

  return res.json({
    word: cleanWord,
    phonetic,
    part_of_speech,
    meaning_vi: meaning_vi || definition_en || 'Nhấn chỉnh sửa để thêm nghĩa tiếng Việt của bạn',
    definition_en,
  });
});

// Get user's saved vocabulary
router.get('/', requireAuth, (req, res) => {
  try {
    const { filter = 'all', search = '' } = req.query;
    const conditions = ['user_id = ?'];
    const params = [req.user.id];

    if (filter === 'learning') {
      conditions.push('mastery_level = 0');
    } else if (filter === 'mastered') {
      conditions.push('mastery_level >= 1');
    }
    if (String(search).trim()) {
      const q = `%${String(search).trim().toLowerCase()}%`;
      conditions.push('(LOWER(word) LIKE ? OR LOWER(meaning_vi) LIKE ?)');
      params.push(q, q);
    }

    const items = db
      .prepare(
        `SELECT * FROM vocabulary
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC, id DESC`
      )
      .all(...params);

    return res.json({ vocabulary: items });
  } catch (err) {
    console.error('Get vocab error:', err);
    return res.status(500).json({ error: 'Không thể tải sổ từ vựng.' });
  }
});

// Save a new word (upsert)
router.post('/', requireAuth, (req, res) => {
  try {
    const {
      word,
      phonetic = '',
      part_of_speech = '',
      meaning_vi = '',
      example_en = '',
      lesson_id = null,
    } = req.body || {};

    const cleanWord = String(word || '').trim().toLowerCase();
    if (!cleanWord) {
      return res.status(400).json({ error: 'Vui lòng nhập từ vựng.' });
    }

    const existing = db
      .prepare('SELECT * FROM vocabulary WHERE user_id = ? AND word = ?')
      .get(req.user.id, cleanWord);

    if (existing) {
      db.prepare(
        `UPDATE vocabulary
         SET phonetic = COALESCE(NULLIF(?, ''), phonetic),
             part_of_speech = COALESCE(NULLIF(?, ''), part_of_speech),
             meaning_vi = COALESCE(NULLIF(?, ''), meaning_vi),
             example_en = COALESCE(NULLIF(?, ''), example_en)
         WHERE id = ?`
      ).run(phonetic, part_of_speech, meaning_vi, example_en, existing.id);
      const updated = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(existing.id);
      return res.json({ item: updated, alreadyExisted: true });
    }

    const resInsert = db
      .prepare(
        `INSERT INTO vocabulary (user_id, word, phonetic, part_of_speech, meaning_vi, example_en, lesson_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, cleanWord, phonetic, part_of_speech, meaning_vi, example_en, lesson_id || null);

    const created = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(Number(resInsert.lastInsertRowid));
    return res.status(201).json({ item: created, alreadyExisted: false });
  } catch (err) {
    console.error('Save vocab error:', err);
    return res.status(500).json({ error: 'Không thể lưu từ vựng.' });
  }
});

// Update word or flashcard review status
router.patch('/:id', requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db
      .prepare('SELECT * FROM vocabulary WHERE id = ? AND user_id = ?')
      .get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy từ vựng.' });
    }

    const { meaning_vi, phonetic, part_of_speech, example_en, mastery_level, increment_review } =
      req.body || {};

    const nextMastery =
      mastery_level !== undefined ? Number(mastery_level) : existing.mastery_level;
    const nextReview = increment_review
      ? Number(existing.review_count || 0) + 1
      : existing.review_count;

    db.prepare(
      `UPDATE vocabulary
       SET meaning_vi = ?, phonetic = ?, part_of_speech = ?, example_en = ?,
           mastery_level = ?, review_count = ?
       WHERE id = ?`
    ).run(
      meaning_vi !== undefined ? String(meaning_vi) : existing.meaning_vi,
      phonetic !== undefined ? String(phonetic) : existing.phonetic,
      part_of_speech !== undefined ? String(part_of_speech) : existing.part_of_speech,
      example_en !== undefined ? String(example_en) : existing.example_en,
      nextMastery,
      nextReview,
      id
    );

    const updated = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(id);
    return res.json({ item: updated });
  } catch (err) {
    console.error('Update vocab error:', err);
    return res.status(500).json({ error: 'Không thể cập nhật từ vựng.' });
  }
});

// Delete word
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const resDel = db
      .prepare('DELETE FROM vocabulary WHERE id = ? AND user_id = ?')
      .run(id, req.user.id);
    if (resDel.changes === 0) {
      return res.status(404).json({ error: 'Không tìm thấy từ vựng cần xóa.' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete vocab error:', err);
    return res.status(500).json({ error: 'Không thể xóa từ vựng.' });
  }
});

module.exports = router;
