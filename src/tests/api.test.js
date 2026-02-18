const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');

// Use in-memory db for tests
process.env.DB_PATH = ':memory:';

const app = require('../server');
const { closeDb } = require('../db');

let server;
let baseUrl;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

before(() => {
  return new Promise(resolve => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  server.close();
  closeDb();
});

// ==================== BOARDS ====================

describe('Boards API', () => {
  it('should list boards (initially empty)', async () => {
    const res = await request('GET', '/api/boards');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('should create a board', async () => {
    const res = await request('POST', '/api/boards', { name: 'Test Board', description: 'A test board' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.name, 'Test Board');
    assert.strictEqual(res.body.description, 'A test board');
    assert.ok(res.body.id);
  });

  it('should reject board without name', async () => {
    const res = await request('POST', '/api/boards', { description: 'No name' });
    assert.strictEqual(res.status, 400);
  });

  it('should get a board by id', async () => {
    const created = await request('POST', '/api/boards', { name: 'Get Me' });
    const res = await request('GET', `/api/boards/${created.body.id}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.name, 'Get Me');
  });

  it('should update a board', async () => {
    const created = await request('POST', '/api/boards', { name: 'Old Name' });
    const res = await request('PUT', `/api/boards/${created.body.id}`, { name: 'New Name' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.name, 'New Name');
  });

  it('should delete a board', async () => {
    const created = await request('POST', '/api/boards', { name: 'Delete Me' });
    const res = await request('DELETE', `/api/boards/${created.body.id}`);
    assert.strictEqual(res.status, 204);
    const get = await request('GET', `/api/boards/${created.body.id}`);
    assert.strictEqual(get.status, 404);
  });

  it('should return 404 for non-existent board', async () => {
    const res = await request('GET', '/api/boards/99999');
    assert.strictEqual(res.status, 404);
  });
});

// ==================== SPRINTS ====================

describe('Sprints API', () => {
  let boardId;

  before(async () => {
    const res = await request('POST', '/api/boards', { name: 'Sprint Board' });
    boardId = res.body.id;
  });

  it('should create a sprint', async () => {
    const res = await request('POST', '/api/sprints', {
      board_id: boardId,
      name: 'Sprint 1',
      goal: 'Ship MVP',
      start_date: '2025-01-01',
      end_date: '2025-01-14',
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.name, 'Sprint 1');
    assert.strictEqual(res.body.status, 'planning');
  });

  it('should reject sprint without board', async () => {
    const res = await request('POST', '/api/sprints', { name: 'No Board' });
    assert.strictEqual(res.status, 400);
  });

  it('should list sprints filtered by board', async () => {
    const res = await request('GET', `/api/sprints?board_id=${boardId}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.length >= 1);
  });

  it('should update sprint status', async () => {
    const created = await request('POST', '/api/sprints', { board_id: boardId, name: 'Update Me' });
    const res = await request('PUT', `/api/sprints/${created.body.id}`, { status: 'active' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'active');
  });

  it('should reject invalid sprint status', async () => {
    const created = await request('POST', '/api/sprints', { board_id: boardId, name: 'Bad Status' });
    const res = await request('PUT', `/api/sprints/${created.body.id}`, { status: 'invalid' });
    assert.strictEqual(res.status, 400);
  });

  it('should delete a sprint', async () => {
    const created = await request('POST', '/api/sprints', { board_id: boardId, name: 'Delete Me' });
    const res = await request('DELETE', `/api/sprints/${created.body.id}`);
    assert.strictEqual(res.status, 204);
  });
});

// ==================== ISSUES ====================

describe('Issues API', () => {
  let boardId;
  let sprintId;

  before(async () => {
    const board = await request('POST', '/api/boards', { name: 'Issue Board' });
    boardId = board.body.id;
    const sprint = await request('POST', '/api/sprints', { board_id: boardId, name: 'Issue Sprint' });
    sprintId = sprint.body.id;
  });

  it('should create an issue', async () => {
    const res = await request('POST', '/api/issues', {
      board_id: boardId,
      title: 'Fix the bug',
      priority: 'high',
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.title, 'Fix the bug');
    assert.strictEqual(res.body.status, 'todo');
    assert.strictEqual(res.body.priority, 'high');
  });

  it('should create an issue with sprint', async () => {
    const res = await request('POST', '/api/issues', {
      board_id: boardId,
      sprint_id: sprintId,
      title: 'Sprint task',
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.sprint_id, sprintId);
  });

  it('should reject issue without title', async () => {
    const res = await request('POST', '/api/issues', { board_id: boardId });
    assert.strictEqual(res.status, 400);
  });

  it('should reject issue with invalid priority', async () => {
    const res = await request('POST', '/api/issues', {
      board_id: boardId,
      title: 'Bad prio',
      priority: 'ultra',
    });
    assert.strictEqual(res.status, 400);
  });

  it('should list issues with filters', async () => {
    const res = await request('GET', `/api/issues?board_id=${boardId}&status=todo`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.length >= 1);
  });

  it('should update issue status', async () => {
    const created = await request('POST', '/api/issues', { board_id: boardId, title: 'Move me' });
    const res = await request('PUT', `/api/issues/${created.body.id}`, { status: 'in_progress' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'in_progress');
  });

  it('should update issue assignee', async () => {
    const created = await request('POST', '/api/issues', { board_id: boardId, title: 'Assign me' });
    const res = await request('PUT', `/api/issues/${created.body.id}`, { assignee: 'alice' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.assignee, 'alice');
  });

  it('should delete an issue', async () => {
    const created = await request('POST', '/api/issues', { board_id: boardId, title: 'Delete me' });
    const res = await request('DELETE', `/api/issues/${created.body.id}`);
    assert.strictEqual(res.status, 204);
  });

  it('should return 404 for non-existent issue', async () => {
    const res = await request('GET', '/api/issues/99999');
    assert.strictEqual(res.status, 404);
  });
});
