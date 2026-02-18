const { Router } = require('express');
const { getDb } = require('../db');

const router = Router();

// List sprints (optionally filter by board_id)
router.get('/', (req, res) => {
  const db = getDb();
  const { board_id } = req.query;
  let sprints;
  if (board_id) {
    sprints = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM issues WHERE sprint_id = s.id) AS issue_count,
        (SELECT COUNT(*) FROM issues WHERE sprint_id = s.id AND status = 'done') AS done_count
      FROM sprints s WHERE s.board_id = ? ORDER BY s.created_at DESC
    `).all(board_id);
  } else {
    sprints = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM issues WHERE sprint_id = s.id) AS issue_count,
        (SELECT COUNT(*) FROM issues WHERE sprint_id = s.id AND status = 'done') AS done_count
      FROM sprints s ORDER BY s.created_at DESC
    `).all();
  }
  res.json(sprints);
});

// Get a single sprint
router.get('/:id', (req, res) => {
  const db = getDb();
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
  res.json(sprint);
});

// Create a sprint
router.post('/', (req, res) => {
  const { board_id, name, goal, start_date, end_date } = req.body;
  if (!board_id) return res.status(400).json({ error: 'board_id is required' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const db = getDb();
  const board = db.prepare('SELECT id FROM boards WHERE id = ?').get(board_id);
  if (!board) return res.status(400).json({ error: 'Board not found' });

  const result = db.prepare(
    'INSERT INTO sprints (board_id, name, goal, start_date, end_date) VALUES (?, ?, ?, ?, ?)'
  ).run(board_id, name.trim(), goal || '', start_date || null, end_date || null);
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(sprint);
});

// Update a sprint
router.put('/:id', (req, res) => {
  const { name, goal, start_date, end_date, status } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Sprint not found' });

  const validStatuses = ['planning', 'active', 'completed'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  db.prepare(`UPDATE sprints SET name = ?, goal = ?, start_date = ?, end_date = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(
      name || existing.name,
      goal !== undefined ? goal : existing.goal,
      start_date !== undefined ? start_date : existing.start_date,
      end_date !== undefined ? end_date : existing.end_date,
      status || existing.status,
      req.params.id
    );
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  res.json(sprint);
});

// Delete a sprint
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM sprints WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Sprint not found' });
  res.status(204).end();
});

module.exports = router;
