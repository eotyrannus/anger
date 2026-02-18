const express = require('express');
const path = require('path');
const { closeDb } = require('./db');
const boardRoutes = require('./routes/boards');
const sprintRoutes = require('./routes/sprints');
const issueRoutes = require('./routes/issues');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/boards', boardRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/issues', issueRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Anger task tracker running on http://localhost:${PORT}`);
  });

  process.on('SIGINT', () => {
    closeDb();
    server.close();
  });
}

module.exports = app;
