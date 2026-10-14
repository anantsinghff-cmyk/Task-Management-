import express from 'express';
import crypto from 'node:crypto';
import { db, formatTask, logActivity } from '../db.js';
import { authenticate } from '../middleware/auth.js';

export const taskRouter = express.Router();

// Helper to broadcast via Socket.io
function broadcast(req, event, data) {
  const io = req.app.get('io');
  if (io) {
    io.emit(event, data);
  }
}

// 1. GET /api/tasks - List tasks with flexible filtering, search & sorting
taskRouter.get('/', authenticate, (req, res) => {
  try {
    const { status, priority, category, search, sortBy = 'createdAt', order = 'DESC' } = req.query;

    let query = `
      SELECT t.*, u.name as authorName, u.avatar as authorAvatar, u.email as authorEmail
      FROM tasks t
      LEFT JOIN users u ON t.userId = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (priority && priority !== 'all') {
      query += ` AND t.priority = ?`;
      params.push(priority);
    }

    if (category && category !== 'all') {
      query += ` AND t.category = ?`;
      params.push(category);
    }

    if (search && search.trim() !== '') {
      query += ` AND (t.title LIKE ? OR t.description LIKE ? OR t.tags LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    // Safe sort columns
    const allowedSortColumns = {
      createdAt: 't.createdAt',
      updatedAt: 't.updatedAt',
      dueDate: 't.dueDate',
      priority: 'CASE t.priority WHEN "urgent" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END',
      title: 't.title',
      orderIndex: 't.orderIndex'
    };

    const sortColumn = allowedSortColumns[sortBy] || 't.createdAt';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const rows = db.prepare(query).all(...params);
    const tasks = rows.map(formatTask);

    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ message: 'Failed to retrieve tasks.' });
  }
});

// 2. GET /api/tasks/analytics - Productivity analytics & dashboard metrics
taskRouter.get('/meta/analytics', authenticate, (req, res) => {
  try {
    const allRows = db.prepare(`SELECT * FROM tasks`).all();
    const tasks = allRows.map(formatTask);

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const todo = tasks.filter(t => t.status === 'todo').length;

    const todayStr = new Date().toISOString().split('T')[0];
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'completed').length;

    const byPriority = {
      urgent: tasks.filter(t => t.priority === 'urgent').length,
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length
    };

    const byCategory = {};
    tasks.forEach(t => {
      const cat = t.category || 'General';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    let totalSubtasks = 0;
    let completedSubtasks = 0;
    tasks.forEach(t => {
      if (Array.isArray(t.subtasks)) {
        totalSubtasks += t.subtasks.length;
        completedSubtasks += t.subtasks.filter(s => s.completed).length;
      }
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const subtaskRate = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    res.json({
      total,
      completed,
      inProgress,
      review,
      todo,
      overdue,
      completionRate,
      subtaskRate,
      totalSubtasks,
      completedSubtasks,
      byPriority,
      byCategory
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ message: 'Failed to compute task analytics.' });
  }
});

// 3. GET /api/tasks/meta/export - Export all tasks
taskRouter.get('/meta/export', authenticate, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT t.*, u.name as authorName, u.email as authorEmail
      FROM tasks t
      LEFT JOIN users u ON t.userId = u.id
      ORDER BY t.createdAt DESC
    `).all();

    const tasks = rows.map(formatTask);
    const format = req.query.format || 'json';

    if (format === 'csv') {
      const headers = ['ID', 'Title', 'Status', 'Priority', 'Category', 'Due Date', 'Author', 'Created At'];
      const csvLines = [headers.join(',')];

      tasks.forEach(t => {
        const line = [
          `"${t.id}"`,
          `"${(t.title || '').replace(/"/g, '""')}"`,
          `"${t.status}"`,
          `"${t.priority}"`,
          `"${t.category}"`,
          `"${t.dueDate || 'None'}"`,
          `"${t.authorName || 'Unknown'}"`,
          `"${t.createdAt}"`
        ];
        csvLines.push(line.join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="novatask-export.csv"');
      return res.send(csvLines.join('\n'));
    }

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Failed to export tasks.' });
  }
});

// 4. GET /api/tasks/:id - Single task
taskRouter.get('/:id', authenticate, (req, res) => {
  try {
    const row = db.prepare(`
      SELECT t.*, u.name as authorName, u.avatar as authorAvatar, u.email as authorEmail
      FROM tasks t
      LEFT JOIN users u ON t.userId = u.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!row) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    res.json(formatTask(row));
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve task.' });
  }
});

// 5. POST /api/tasks - Create Task
taskRouter.post('/', authenticate, (req, res) => {
  try {
    const {
      title,
      description = '',
      status = 'todo',
      priority = 'medium',
      category = 'General',
      dueDate = null,
      subtasks = [],
      tags = []
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task title is required.' });
    }

    const validStatuses = ['todo', 'in-progress', 'review', 'completed'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];

    const safeStatus = validStatuses.includes(status) ? status : 'todo';
    const safePriority = validPriorities.includes(priority) ? priority : 'medium';

    const taskId = 'tsk_' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    // Prepare subtasks with ids if not present
    const formattedSubtasks = (Array.isArray(subtasks) ? subtasks : []).map(s => ({
      id: s.id || 'st_' + crypto.randomUUID().slice(0, 6),
      title: (typeof s === 'string' ? s : s.title || '').trim(),
      completed: Boolean(s.completed)
    })).filter(s => s.title);

    const formattedTags = Array.isArray(tags)
      ? tags.map(t => String(t).trim()).filter(Boolean)
      : [];

    db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, category, dueDate, subtasks, tags, userId, orderIndex, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      title.trim(),
      description.trim(),
      safeStatus,
      safePriority,
      category.trim() || 'General',
      dueDate || null,
      JSON.stringify(formattedSubtasks),
      JSON.stringify(formattedTags),
      req.user.id,
      0,
      now,
      now
    );

    const createdTask = formatTask(db.prepare(`
      SELECT t.*, u.name as authorName, u.avatar as authorAvatar, u.email as authorEmail
      FROM tasks t
      LEFT JOIN users u ON t.userId = u.id
      WHERE t.id = ?
    `).get(taskId));

    const activity = logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userAvatar: req.user.avatar,
      action: 'Created Task',
      details: `Created task "${createdTask.title}" in ${createdTask.category}`,
      taskId
    });

    // Real-time broadcast
    broadcast(req, 'task:created', { task: createdTask, user: req.user });
    broadcast(req, 'activity:new', activity);

    res.status(201).json(createdTask);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ message: 'Failed to create task.' });
  }
});

// 6. PUT /api/tasks/:id - Update Task
taskRouter.put('/:id', authenticate, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const {
      title,
      description,
      status,
      priority,
      category,
      dueDate,
      subtasks,
      tags,
      orderIndex
    } = req.body;

    const validStatuses = ['todo', 'in-progress', 'review', 'completed'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];

    const newTitle = title !== undefined ? title.trim() : existing.title;
    const newDescription = description !== undefined ? description.trim() : existing.description;
    const newStatus = (status && validStatuses.includes(status)) ? status : existing.status;
    const newPriority = (priority && validPriorities.includes(priority)) ? priority : existing.priority;
    const newCategory = category !== undefined ? category.trim() : existing.category;
    const newDueDate = dueDate !== undefined ? dueDate : existing.dueDate;
    const newOrderIndex = orderIndex !== undefined ? Number(orderIndex) : existing.orderIndex;
    const now = new Date().toISOString();

    let newSubtasks = existing.subtasks;
    if (subtasks !== undefined) {
      const processed = (Array.isArray(subtasks) ? subtasks : []).map(s => ({
        id: s.id || 'st_' + crypto.randomUUID().slice(0, 6),
        title: (typeof s === 'string' ? s : s.title || '').trim(),
        completed: Boolean(s.completed)
      })).filter(s => s.title);
      newSubtasks = JSON.stringify(processed);
    }

    let newTags = existing.tags;
    if (tags !== undefined) {
      newTags = JSON.stringify(Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : []);
    }

    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?, priority = ?, category = ?, dueDate = ?,
          subtasks = ?, tags = ?, orderIndex = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      newTitle,
      newDescription,
      newStatus,
      newPriority,
      newCategory,
      newDueDate,
      newSubtasks,
      newTags,
      newOrderIndex,
      now,
      req.params.id
    );

    const updatedTask = formatTask(db.prepare(`
      SELECT t.*, u.name as authorName, u.avatar as authorAvatar, u.email as authorEmail
      FROM tasks t
      LEFT JOIN users u ON t.userId = u.id
      WHERE t.id = ?
    `).get(req.params.id));

    let changeNote = `Updated task "${updatedTask.title}"`;
    if (existing.status !== newStatus) {
      changeNote = `Moved "${updatedTask.title}" to ${newStatus.replace('-', ' ')}`;
    }

    const activity = logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userAvatar: req.user.avatar,
      action: 'Updated Task',
      details: changeNote,
      taskId: req.params.id
    });

    broadcast(req, 'task:updated', { task: updatedTask, user: req.user });
    broadcast(req, 'activity:new', activity);

    res.json(updatedTask);
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ message: 'Failed to update task.' });
  }
});

// 7. PATCH /api/tasks/:id/status - Quick drag & drop status changer
taskRouter.patch('/:id/status', authenticate, (req, res) => {
  try {
    const { status, orderIndex } = req.body;
    const validStatuses = ['todo', 'in-progress', 'review', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const now = new Date().toISOString();
    const newOrder = orderIndex !== undefined ? Number(orderIndex) : existing.orderIndex;

    db.prepare(`
      UPDATE tasks SET status = ?, orderIndex = ?, updatedAt = ? WHERE id = ?
    `).run(status, newOrder, now, req.params.id);

    const updatedTask = formatTask(db.prepare(`
      SELECT t.*, u.name as authorName, u.avatar as authorAvatar, u.email as authorEmail
      FROM tasks t
      LEFT JOIN users u ON t.userId = u.id
      WHERE t.id = ?
    `).get(req.params.id));

    const activity = logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userAvatar: req.user.avatar,
      action: 'Status Changed',
      details: `Moved "${updatedTask.title}" from ${existing.status} to ${status}`,
      taskId: req.params.id
    });

    broadcast(req, 'task:updated', { task: updatedTask, user: req.user });
    broadcast(req, 'activity:new', activity);

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update task status.' });
  }
});

// 8. PATCH /api/tasks/:id/subtask/:subtaskId/toggle - Toggle subtask checklist item
taskRouter.patch('/:id/subtask/:subtaskId/toggle', authenticate, (req, res) => {
  try {
    const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!taskRow) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const task = formatTask(taskRow);
    const subtasks = task.subtasks || [];
    const target = subtasks.find(s => s.id === req.params.subtaskId);

    if (!target) {
      return res.status(404).json({ message: 'Subtask item not found.' });
    }

    target.completed = !target.completed;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE tasks SET subtasks = ?, updatedAt = ? WHERE id = ?
    `).run(JSON.stringify(subtasks), now, req.params.id);

    const updatedTask = formatTask(db.prepare(`
      SELECT t.*, u.name as authorName, u.avatar as authorAvatar, u.email as authorEmail
      FROM tasks t
      LEFT JOIN users u ON t.userId = u.id
      WHERE t.id = ?
    `).get(req.params.id));

    const activity = logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userAvatar: req.user.avatar,
      action: 'Subtask Toggled',
      details: `${target.completed ? 'Completed' : 'Reopened'} subtask "${target.title}" in "${task.title}"`,
      taskId: req.params.id
    });

    broadcast(req, 'task:updated', { task: updatedTask, user: req.user });
    broadcast(req, 'activity:new', activity);

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ message: 'Failed to toggle subtask.' });
  }
});

// 9. DELETE /api/tasks/:id - Delete Task
taskRouter.delete('/:id', authenticate, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);

    const activity = logActivity({
      userId: req.user.id,
      userName: req.user.name,
      userAvatar: req.user.avatar,
      action: 'Deleted Task',
      details: `Deleted task "${existing.title}"`,
      taskId: req.params.id
    });

    broadcast(req, 'task:deleted', { taskId: req.params.id, title: existing.title, user: req.user });
    broadcast(req, 'activity:new', activity);

    res.json({ message: 'Task deleted successfully.', taskId: req.params.id });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ message: 'Failed to delete task.' });
  }
});
