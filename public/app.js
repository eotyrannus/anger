// State
let boards = [];
let sprints = [];
let issues = [];

// API helpers
async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.view}-view`).classList.add('active');
  });
});

// Modals
function showModal(id) {
  document.getElementById(id).classList.add('active');
}

function hideModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Close modal on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('active');
  });
});

// ==================== BOARDS ====================

async function loadBoards() {
  boards = await api('/boards');
  renderBoards();
  populateBoardSelects();
}

function renderBoards() {
  const el = document.getElementById('boards-list');
  if (!boards.length) {
    el.innerHTML = '<div class="empty-state">No boards yet. Create one to get started.</div>';
    return;
  }
  el.innerHTML = boards.map(b => `
    <div class="card">
      <div class="card-header">
        <h4>${esc(b.name)}</h4>
        <div class="card-actions">
          <button class="btn-icon" onclick="editBoard(${b.id})" title="Edit">&#9998;</button>
          <button class="btn-icon danger" onclick="deleteBoard(${b.id})" title="Delete">&#10005;</button>
        </div>
      </div>
      ${b.description ? `<div class="card-desc">${esc(b.description)}</div>` : ''}
      <div class="card-meta">
        <span>${b.issue_count} issue${b.issue_count !== 1 ? 's' : ''}</span>
        <span>${b.sprint_count} sprint${b.sprint_count !== 1 ? 's' : ''}</span>
      </div>
    </div>
  `).join('');
}

function populateBoardSelects() {
  const opts = boards.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');

  // Filter selects
  ['sprint-board-filter', 'issue-board-filter'].forEach(id => {
    const el = document.getElementById(id);
    const val = el.value;
    el.innerHTML = `<option value="">All</option>${opts}`;
    el.value = val;
  });

  // Modal selects
  ['sprint-board', 'issue-board'].forEach(id => {
    const el = document.getElementById(id);
    const val = el.value;
    el.innerHTML = opts || '<option value="">No boards available</option>';
    if (val) el.value = val;
  });
}

async function saveBoard() {
  const id = document.getElementById('board-id').value;
  const body = {
    name: document.getElementById('board-name').value,
    description: document.getElementById('board-desc').value,
  };

  if (!body.name.trim()) return alert('Name is required');

  if (id) {
    await api(`/boards/${id}`, { method: 'PUT', body });
  } else {
    await api('/boards', { method: 'POST', body });
  }

  hideModal('board-modal');
  clearBoardForm();
  await loadBoards();
}

function editBoard(id) {
  const b = boards.find(x => x.id === id);
  if (!b) return;
  document.getElementById('board-modal-title').textContent = 'Edit Board';
  document.getElementById('board-id').value = b.id;
  document.getElementById('board-name').value = b.name;
  document.getElementById('board-desc').value = b.description;
  showModal('board-modal');
}

async function deleteBoard(id) {
  if (!confirm('Delete this board and all its issues and sprints?')) return;
  await api(`/boards/${id}`, { method: 'DELETE' });
  await loadAll();
}

function clearBoardForm() {
  document.getElementById('board-modal-title').textContent = 'New Board';
  document.getElementById('board-id').value = '';
  document.getElementById('board-name').value = '';
  document.getElementById('board-desc').value = '';
}

// ==================== SPRINTS ====================

async function loadSprints() {
  const boardId = document.getElementById('sprint-board-filter').value;
  const query = boardId ? `?board_id=${boardId}` : '';
  sprints = await api(`/sprints${query}`);
  renderSprints();
}

function renderSprints() {
  const el = document.getElementById('sprints-list');
  if (!sprints.length) {
    el.innerHTML = '<div class="empty-state">No sprints yet. Create one to organize your issues.</div>';
    return;
  }
  el.innerHTML = sprints.map(s => {
    const progress = s.issue_count > 0 ? Math.round((s.done_count / s.issue_count) * 100) : 0;
    return `
    <div class="card">
      <div class="card-header">
        <h4>${esc(s.name)}</h4>
        <div class="card-actions">
          <button class="btn-icon" onclick="editSprint(${s.id})" title="Edit">&#9998;</button>
          <button class="btn-icon danger" onclick="deleteSprint(${s.id})" title="Delete">&#10005;</button>
        </div>
      </div>
      ${s.goal ? `<div class="card-desc">${esc(s.goal)}</div>` : ''}
      <div class="card-meta">
        <span class="badge badge-status-${s.status}">${s.status}</span>
        <span>${s.done_count}/${s.issue_count} done (${progress}%)</span>
        ${s.start_date ? `<span>${s.start_date} &rarr; ${s.end_date || '?'}</span>` : ''}
      </div>
    </div>
  `}).join('');
}

async function saveSprint() {
  const id = document.getElementById('sprint-id').value;
  const body = {
    board_id: document.getElementById('sprint-board').value,
    name: document.getElementById('sprint-name').value,
    goal: document.getElementById('sprint-goal').value,
    start_date: document.getElementById('sprint-start').value || null,
    end_date: document.getElementById('sprint-end').value || null,
    status: document.getElementById('sprint-status').value,
  };

  if (!body.name.trim()) return alert('Name is required');
  if (!body.board_id) return alert('Board is required');

  if (id) {
    await api(`/sprints/${id}`, { method: 'PUT', body });
  } else {
    await api('/sprints', { method: 'POST', body });
  }

  hideModal('sprint-modal');
  clearSprintForm();
  await loadSprints();
}

function editSprint(id) {
  const s = sprints.find(x => x.id === id);
  if (!s) return;
  document.getElementById('sprint-modal-title').textContent = 'Edit Sprint';
  document.getElementById('sprint-id').value = s.id;
  document.getElementById('sprint-board').value = s.board_id;
  document.getElementById('sprint-name').value = s.name;
  document.getElementById('sprint-goal').value = s.goal;
  document.getElementById('sprint-start').value = s.start_date || '';
  document.getElementById('sprint-end').value = s.end_date || '';
  document.getElementById('sprint-status').value = s.status;
  showModal('sprint-modal');
}

async function deleteSprint(id) {
  if (!confirm('Delete this sprint? Issues will be moved to backlog.')) return;
  await api(`/sprints/${id}`, { method: 'DELETE' });
  await loadSprints();
}

function clearSprintForm() {
  document.getElementById('sprint-modal-title').textContent = 'New Sprint';
  document.getElementById('sprint-id').value = '';
  document.getElementById('sprint-name').value = '';
  document.getElementById('sprint-goal').value = '';
  document.getElementById('sprint-start').value = '';
  document.getElementById('sprint-end').value = '';
  document.getElementById('sprint-status').value = 'planning';
}

// ==================== ISSUES ====================

async function loadIssues() {
  const boardId = document.getElementById('issue-board-filter').value;
  const sprintId = document.getElementById('issue-sprint-filter').value;
  const status = document.getElementById('issue-status-filter').value;

  let query = [];
  if (boardId) query.push(`board_id=${boardId}`);
  if (sprintId) query.push(`sprint_id=${sprintId}`);
  if (status) query.push(`status=${status}`);

  issues = await api(`/issues${query.length ? '?' + query.join('&') : ''}`);
  renderIssues();
}

function renderIssues() {
  const cols = { todo: [], in_progress: [], done: [] };
  issues.forEach(i => {
    if (cols[i.status]) cols[i.status].push(i);
  });

  ['todo', 'in_progress', 'done'].forEach(status => {
    const el = document.getElementById(`kanban-${status}`);
    if (!cols[status].length) {
      el.innerHTML = '<div class="empty-state" style="padding:1rem;font-size:0.8rem;">No issues</div>';
      return;
    }
    el.innerHTML = cols[status].map(i => `
      <div class="kanban-card" onclick="editIssue(${i.id})">
        <h5>${esc(i.title)}</h5>
        <div class="kanban-card-meta">
          <span class="badge badge-priority-${i.priority}">${i.priority}</span>
          ${i.assignee ? `<span>${esc(i.assignee)}</span>` : ''}
          ${i.sprint_name ? `<span>${esc(i.sprint_name)}</span>` : ''}
        </div>
      </div>
    `).join('');
  });
}

async function onIssueBoardFilterChange() {
  const boardId = document.getElementById('issue-board-filter').value;
  const sprintFilter = document.getElementById('issue-sprint-filter');

  if (boardId) {
    const boardSprints = await api(`/sprints?board_id=${boardId}`);
    sprintFilter.innerHTML = `<option value="">All</option>` +
      boardSprints.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  } else {
    sprintFilter.innerHTML = '<option value="">All</option>';
  }

  await loadIssues();
}

async function loadSprintsForIssue() {
  const boardId = document.getElementById('issue-board').value;
  const el = document.getElementById('issue-sprint');
  if (!boardId) {
    el.innerHTML = '<option value="">Backlog (no sprint)</option>';
    return;
  }
  const boardSprints = await api(`/sprints?board_id=${boardId}`);
  el.innerHTML = `<option value="">Backlog (no sprint)</option>` +
    boardSprints.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
}

async function saveIssue() {
  const id = document.getElementById('issue-id').value;
  const body = {
    board_id: document.getElementById('issue-board').value,
    sprint_id: document.getElementById('issue-sprint').value || null,
    title: document.getElementById('issue-title').value,
    description: document.getElementById('issue-desc').value,
    priority: document.getElementById('issue-priority').value,
    status: document.getElementById('issue-status').value,
    assignee: document.getElementById('issue-assignee').value,
  };

  if (!body.title.trim()) return alert('Title is required');
  if (!body.board_id) return alert('Board is required');

  if (id) {
    await api(`/issues/${id}`, { method: 'PUT', body });
  } else {
    await api('/issues', { method: 'POST', body });
  }

  hideModal('issue-modal');
  clearIssueForm();
  await loadIssues();
}

async function editIssue(id) {
  const issue = await api(`/issues/${id}`);
  if (!issue) return;

  document.getElementById('issue-modal-title').textContent = 'Edit Issue';
  document.getElementById('issue-id').value = issue.id;
  document.getElementById('issue-board').value = issue.board_id;
  await loadSprintsForIssue();
  document.getElementById('issue-sprint').value = issue.sprint_id || '';
  document.getElementById('issue-title').value = issue.title;
  document.getElementById('issue-desc').value = issue.description;
  document.getElementById('issue-priority').value = issue.priority;
  document.getElementById('issue-status').value = issue.status;
  document.getElementById('issue-assignee').value = issue.assignee;
  showModal('issue-modal');
}

async function deleteIssue(id) {
  if (!confirm('Delete this issue?')) return;
  await api(`/issues/${id}`, { method: 'DELETE' });
  await loadIssues();
}

function clearIssueForm() {
  document.getElementById('issue-modal-title').textContent = 'New Issue';
  document.getElementById('issue-id').value = '';
  document.getElementById('issue-title').value = '';
  document.getElementById('issue-desc').value = '';
  document.getElementById('issue-priority').value = 'medium';
  document.getElementById('issue-status').value = 'todo';
  document.getElementById('issue-assignee').value = '';
}

// ==================== UTILS ====================

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== INIT ====================

async function loadAll() {
  await loadBoards();
  await loadSprints();
  await loadIssues();
}

loadAll();
