# Anger - Task Tracker

A simple task tracking app with issues, boards, and sprints.

## Features

- **Boards** - Organize work into separate projects
- **Sprints** - Time-boxed iterations (planning / active / completed)
- **Issues** - Tasks with status, priority, assignee, and sprint assignment
- **Kanban view** - Drag-free columns for To Do, In Progress, and Done

## Quick Start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## API

| Resource | Endpoints |
|----------|-----------|
| Boards   | `GET/POST /api/boards`, `GET/PUT/DELETE /api/boards/:id` |
| Sprints  | `GET/POST /api/sprints`, `GET/PUT/DELETE /api/sprints/:id` |
| Issues   | `GET/POST /api/issues`, `GET/PUT/DELETE /api/issues/:id` |

### Filtering

- `GET /api/sprints?board_id=1`
- `GET /api/issues?board_id=1&sprint_id=2&status=todo`

## Testing

```bash
npm test
```

## Tech Stack

- **Backend:** Node.js, Express, SQLite (better-sqlite3)
- **Frontend:** Vanilla HTML/CSS/JS
- **Tests:** Node.js built-in test runner
