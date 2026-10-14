import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db, logActivity } from '../db.js';
import { authenticate, JWT_SECRET } from '../middleware/auth.js';

export const authRouter = express.Router();

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// User Registration
authRouter.post('/register', (req, res) => {
  try {
    const { name, email, password, avatar, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const defaultAvatar = avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=4f46e5,7c3aed,2563eb`;

    db.prepare(`
      INSERT INTO users (id, name, email, password, avatar, role, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name.trim(), email.toLowerCase().trim(), passwordHash, defaultAvatar, role || 'Member', now);

    const user = {
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      avatar: defaultAvatar,
      role: role || 'Member',
      createdAt: now
    };

    const token = generateToken(user);

    logActivity({
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      action: 'User Registered',
      details: `${user.name} joined NovaTask workspace.`
    });

    res.status(201).json({ user, token, message: 'Account created successfully!' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Internal server error while registering user.' });
  }
});

// User Login
authRouter.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt
    };

    const token = generateToken(safeUser);

    res.json({ user: safeUser, token, message: 'Logged in successfully!' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error while authenticating.' });
  }
});

// Quick Demo Login (for easy evaluation)
authRouter.post('/demo', (req, res) => {
  try {
    const targetEmail = req.body?.account === 'sarah' ? 'sarah@novatask.io' : 'alex@novatask.io';
    const user = db.prepare('SELECT id, name, email, avatar, role, createdAt FROM users WHERE email = ?').get(targetEmail);

    if (!user) {
      return res.status(404).json({ message: 'Demo account not initialized.' });
    }

    const token = generateToken(user);
    res.json({ user, token, message: `Logged in as demo user: ${user.name}` });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ message: 'Failed to authenticate demo user.' });
  }
});

// Current User Profile
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Update Profile
authRouter.put('/profile', authenticate, (req, res) => {
  try {
    const { name, avatar, role } = req.body;
    const current = req.user;

    const newName = name?.trim() || current.name;
    const newAvatar = avatar || current.avatar;
    const newRole = role || current.role;

    db.prepare(`
      UPDATE users SET name = ?, avatar = ?, role = ? WHERE id = ?
    `).run(newName, newAvatar, newRole, current.id);

    const updatedUser = {
      ...current,
      name: newName,
      avatar: newAvatar,
      role: newRole
    };

    const token = generateToken(updatedUser);
    res.json({ user: updatedUser, token, message: 'Profile updated successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile.' });
  }
});

// List all team members
authRouter.get('/users', authenticate, (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, avatar, role FROM users ORDER BY name ASC').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load team users.' });
  }
});
