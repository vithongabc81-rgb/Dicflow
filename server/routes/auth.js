const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    daily_goal: u.daily_goal || 15,
    streak_count: u.streak_count || 0,
    last_active_date: u.last_active_date || null,
    created_at: u.created_at,
  };
}

router.post('/register', (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    if (cleanName.length < 2) {
      return res.status(400).json({ error: 'Họ tên phải có ít nhất 2 ký tự.' });
    }
    if (!cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'Email không hợp lệ.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (exists) {
      return res.status(409).json({ error: 'Email này đã được đăng ký. Vui lòng đăng nhập.' });
    }

    const hash = bcrypt.hashSync(String(password), 10);
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(cleanName, cleanEmail, hash);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid));
    const token = signToken(user);

    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng ký tài khoản.' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
    }

    const token = signToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập.' });
  }
});

router.post('/demo', (_req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('demo@dictaflow.vn');
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản Demo.' });
    }
    const token = signToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Demo login error:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập Demo.' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
  }
  return res.json({ user: sanitizeUser(user) });
});

router.put('/profile', requireAuth, (req, res) => {
  try {
    const { name, daily_goal } = req.body || {};
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!current) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });

    const nextName = name ? String(name).trim() : current.name;
    const nextGoal = Number.isFinite(Number(daily_goal))
      ? Math.max(5, Math.min(100, Number(daily_goal)))
      : current.daily_goal;

    db.prepare('UPDATE users SET name = ?, daily_goal = ? WHERE id = ?').run(
      nextName,
      nextGoal,
      req.user.id
    );
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    return res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Không thể cập nhật hồ sơ.' });
  }
});

module.exports = router;
