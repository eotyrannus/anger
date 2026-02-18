const { Router } = require('express');
const { getDb } = require('../db');

const router = Router();

// List all boards
router.get('/', (req, res) => {
  const db = getDb();
  const boards = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM issues WHERE board_id = b.id) AS issue_count,
      (SELECT COUNT(*) FROM sprints WHERE board_id = b.id) AS sprint_count
    FROM boards b ORDER BY b.created_at DESC
  `).all();
  res.json(boards);
});

// Get a single board
router.get('/:id', (req, res) => {
  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json(board);
});

// Create a board
router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const db = getDb();
  const result = db.prepare('INSERT INTO boards (name, description) VALUES (?, ?)').run(name.trim(), description || '');
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(board);
});

// Update a board
router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Board not found' });

  db.prepare(`UPDATE boards SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(name || existing.name, description !== undefined ? description : existing.description, req.params.id);
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
  res.json(board);
});

// Delete a board
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM boards WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Board not found' });
  res.status(204).end();
});

module.exports = router;
