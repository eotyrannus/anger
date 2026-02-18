const { Router } = require('express');
const { getDb } = require('../db');

const router = Router();

// List issues (filter by board_id, sprint_id, status)
router.get('/', (req, res) => {
  const db = getDb();
  const { board_id, sprint_id, status } = req.query;

  let sql = 'SELECT i.*, b.name AS board_name, s.name AS sprint_name FROM issues i LEFT JOIN boards b ON i.board_id = b.id LEFT JOIN sprints s ON i.sprint_id = s.id WHERE 1=1';
  const params = [];

  if (board_id) {
    sql += ' AND i.board_id = ?';
    params.push(board_id);
  }
  if (sprint_id) {
    sql += ' AND i.sprint_id = ?';
    params.push(sprint_id);
  }
  if (status) {
    sql += ' AND i.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY CASE i.priority WHEN \'critical\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'low\' THEN 3 END, i.created_at DESC';

  const issues = db.prepare(sql).all(...params);
  res.json(issues);
});

// Get a single issue
router.get('/:id', (req, res) => {
  const db = getDb();
  const issue = db.prepare(
    'SELECT i.*, b.name AS board_name, s.name AS sprint_name FROM issues i LEFT JOIN boards b ON i.board_id = b.id LEFT JOIN sprints s ON i.sprint_id = s.id WHERE i.id = ?'
  ).get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  res.json(issue);
});

// Create an issue
router.post('/', (req, res) => {
  const { board_id, sprint_id, title, description, priority, assignee } = req.body;
  if (!board_id) return res.status(400).json({ error: 'board_id is required' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

  const db = getDb();
  const board = db.prepare('SELECT id FROM boards WHERE id = ?').get(board_id);
  if (!board) return res.status(400).json({ error: 'Board not found' });

  if (sprint_id) {
    const sprint = db.prepare('SELECT id FROM sprints WHERE id = ? AND board_id = ?').get(sprint_id, board_id);
    if (!sprint) return res.status(400).json({ error: 'Sprint not found on this board' });
  }

  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ error: `Priority must be one of: ${validPriorities.join(', ')}` });
  }

  const result = db.prepare(
    'INSERT INTO issues (board_id, sprint_id, title, description, priority, assignee) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(board_id, sprint_id || null, title.trim(), description || '', priority || 'medium', assignee || '');
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(issue);
});

// Update an issue
router.put('/:id', (req, res) => {
  const { title, description, status, priority, assignee, sprint_id, board_id } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Issue not found' });

  const validStatuses = ['todo', 'in_progress', 'done'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ error: `Priority must be one of: ${validPriorities.join(', ')}` });
  }

  db.prepare(`UPDATE issues SET title = ?, description = ?, status = ?, priority = ?, assignee = ?, sprint_id = ?, board_id = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(
      title || existing.title,
      description !== undefined ? description : existing.description,
      status || existing.status,
      priority || existing.priority,
      assignee !== undefined ? assignee : existing.assignee,
      sprint_id !== undefined ? sprint_id : existing.sprint_id,
      board_id || existing.board_id,
      req.params.id
    );
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  res.json(issue);
});

// Delete an issue
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM issues WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Issue not found' });
  res.status(204).end();
});

module.exports = router;
