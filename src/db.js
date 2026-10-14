import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'novatask.db');

export const db = new DatabaseSync(dbPath);

// Initialize database schema
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT,
      role TEXT DEFAULT 'Member',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('todo', 'in-progress', 'review', 'completed')),
      priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      category TEXT NOT NULL,
      dueDate TEXT,
      subtasks TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      userId TEXT NOT NULL,
      orderIndex INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      userId TEXT,
      userName TEXT,
      userAvatar TEXT,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      taskId TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  seedInitialData();
}

// Seed initial users & rich task data
function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
  if (userCount > 0) return;

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('Password123!', salt);
  const now = new Date().toISOString();

  const alexId = 'usr_alex_01';
  const sarahId = 'usr_sarah_02';

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password, avatar, role, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    alexId,
    'Alex Rivera',
    'alex@novatask.io',
    passwordHash,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    'Product Lead',
    now
  );

  insertUser.run(
    sarahId,
    'Sarah Chen',
    'sarah@novatask.io',
    passwordHash,
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
    'Senior Engineer',
    now
  );

  const sampleTasks = [
    {
      id: 'tsk_01',
      title: 'Architect Real-Time Synchronization Engine',
      description: 'Implement WebSocket bidirectional broadcasting for instant task state updates across all connected team sessions without polling.',
      status: 'in-progress',
      priority: 'urgent',
      category: 'Engineering',
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      subtasks: JSON.stringify([
        { id: 'st_1', title: 'Attach Socket.io to Express HTTP Server', completed: true },
        { id: 'st_2', title: 'Broadcast task:created and task:updated events', completed: true },
        { id: 'st_3', title: 'Add connection retry & presence heartbeat', completed: false }
      ]),
      tags: JSON.stringify(['WebSockets', 'Realtime', 'NodeJS']),
      userId: alexId,
      orderIndex: 0
    },
    {
      id: 'tsk_02',
      title: 'Design Glassmorphism Dashboard & Brand Palette',
      description: 'Craft high-contrast accessibility compliant theme tokens, sleek status badges, interactive Kanban dropzones, and dark-mode gradients.',
      status: 'completed',
      priority: 'high',
      category: 'Design',
      dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      subtasks: JSON.stringify([
        { id: 'st_4', title: 'Select deep slate and vivid indigo hues', completed: true },
        { id: 'st_5', title: 'Style Kanban drag shadow indicators', completed: true },
        { id: 'st_6', title: 'Design SVG milestone celebrations', completed: true }
      ]),
      tags: JSON.stringify(['UI/UX', 'DesignSystem', 'Tailwind']),
      userId: alexId,
      orderIndex: 1
    },
    {
      id: 'tsk_03',
      title: 'Implement Interactive Kanban Drag & Drop System',
      description: 'Native HTML5 drag and drop matrix with smooth column dropzones, optimistic status updates, and audio-visual haptic feedback.',
      status: 'review',
      priority: 'high',
      category: 'Frontend',
      dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
      subtasks: JSON.stringify([
        { id: 'st_7', title: 'Setup onDragStart and onDragOver events', completed: true },
        { id: 'st_8', title: 'Sync state with backend on drop', completed: true },
        { id: 'st_9', title: 'Mobile fallback tap-to-move selector', completed: false }
      ]),
      tags: JSON.stringify(['Kanban', 'React', 'Interactivity']),
      userId: alexId,
      orderIndex: 0
    },
    {
      id: 'tsk_04',
      title: 'Build Productivity Analytics & Metrics Engine',
      description: 'Calculate real-time completion velocity, overdue task warnings, weekly throughput ratios, and priority breakdown graphs.',
      status: 'todo',
      priority: 'medium',
      category: 'Analytics',
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      subtasks: JSON.stringify([
        { id: 'st_10', title: 'SQL aggregation endpoint for task statuses', completed: false },
        { id: 'st_11', title: 'Circular completion dial component', completed: false },
        { id: 'st_12', title: 'Priority distribution histogram', completed: false }
      ]),
      tags: JSON.stringify(['Analytics', 'Metrics', 'SQL']),
      userId: alexId,
      orderIndex: 0
    },
    {
      id: 'tsk_05',
      title: 'Comprehensive Subtask Progress & Checklist Tracking',
      description: 'Allow users to break down complex initiatives into bite-sized actionable items with real-time percentage indicators.',
      status: 'in-progress',
      priority: 'medium',
      category: 'Productivity',
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      subtasks: JSON.stringify([
        { id: 'st_13', title: 'Subtask toggle API handler', completed: true },
        { id: 'st_14', title: 'Dynamic progress bar calculation', completed: true },
        { id: 'st_15', title: 'Add subtask keyboard shortcut (Enter)', completed: false }
      ]),
      tags: JSON.stringify(['Productivity', 'UX']),
      userId: sarahId,
      orderIndex: 1
    },
    {
      id: 'tsk_06',
      title: 'Automated CSV & JSON Data Export Pipeline',
      description: 'Enable export of tasks with full metadata, subtasks completion rates, and timestamps for external reporting and backup.',
      status: 'todo',
      priority: 'low',
      category: 'Engineering',
      dueDate: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
      subtasks: JSON.stringify([
        { id: 'st_16', title: 'Format tasks into CSV structure', completed: false },
        { id: 'st_17', title: 'Trigger browser blob download', completed: false }
      ]),
      tags: JSON.stringify(['Export', 'Data']),
      userId: sarahId,
      orderIndex: 1
    }
  ];

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, description, status, priority, category, dueDate, subtasks, tags, userId, orderIndex, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of sampleTasks) {
    insertTask.run(
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.category,
      t.dueDate,
      t.subtasks,
      t.tags,
      t.userId,
      t.orderIndex,
      now,
      now
    );
  }

  // Initial activities
  const insertActivity = db.prepare(`
    INSERT INTO activities (id, userId, userName, userAvatar, action, details, taskId, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertActivity.run(
    crypto.randomUUID(),
    alexId,
    'Alex Rivera',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    'Project Initialized',
    'Created NovaTask workspace with 6 baseline roadmap tasks',
    'tsk_01',
    new Date(Date.now() - 3600000 * 4).toISOString()
  );

  insertActivity.run(
    crypto.randomUUID(),
    sarahId,
    'Sarah Chen',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
    'Completed Milestone',
    'Completed design tokens and glassmorphism styling setup',
    'tsk_02',
    new Date(Date.now() - 3600000 * 2).toISOString()
  );
}

// Log activity helper
export function logActivity({ userId, userName, userAvatar, action, details, taskId }) {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO activities (id, userId, userName, userAvatar, action, details, taskId, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId || 'system', userName || 'System', userAvatar || '', action, details, taskId || null, timestamp);

  return { id, userId, userName, userAvatar, action, details, taskId, timestamp };
}

// Helper to format task row from DB
export function formatTask(row) {
  if (!row) return null;
  return {
    ...row,
    subtasks: typeof row.subtasks === 'string' ? JSON.parse(row.subtasks || '[]') : row.subtasks,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : row.tags
  };
}
