const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config({ override: true });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/user', require('./routes/user'));
app.use('/api/owner', require('./routes/owner'));

app.get('/', (req, res) => {
  res.json({ message: 'Store Rating Platform API is active.' });
});

app.use((err, req, res, next) => {
  console.error('Express Error Handler:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'An internal server error occurred.'
  });
});

async function startServer() {
  console.log('Initializing database tables...');

  try {
    await db.initDb();
  } catch (err) {
    console.warn('Continuing without a live database connection. Some API routes will fail until MySQL is available.');
    console.warn(err.message || err);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    const activePw = db.getActivePasswordUsed();
    if (activePw) {
      console.log(`Active database password: ${activePw === '' ? '(empty)' : activePw}`);
    } else {
      console.log('No active database password was detected.');
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please stop the old process or choose another port.`);
    } else {
      console.error('Server startup error:', err);
    }
    process.exit(1);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
