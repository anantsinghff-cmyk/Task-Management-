import express from 'express';
import { db } from '../db.js';
import { authenticate } from '../middleware/auth.js';

export const activityRouter = express.Router();

// GET /api/activities - Retrieve latest activities
activityRouter.get('/', authenticate, (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const rows = db.prepare(`
      SELECT * FROM activities
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ message: 'Failed to retrieve activities.' });
  }
});
