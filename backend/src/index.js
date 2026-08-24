const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config({ override: true });

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =====================================================
   STATIC FILES
===================================================== */

app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'))
);

/* =====================================================
   ROUTES
===================================================== */

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/user', require('./routes/user'));
app.use('/api/owner', require('./routes/owner'));

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get('/', (req, res) => {
  res.json({
    message: 'Store Rating Platform API is active.',
    database: 'MongoDB',
  });
});

/* =====================================================
   404 HANDLER
===================================================== */

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found.',
  });
});

/* =====================================================
   ERROR HANDLER
===================================================== */

app.use((err, req, res, next) => {
  console.error('Express Error:', err);

  res.status(err.status || 500).json({
    error:
      err.message ||
      'An internal server error occurred.',
  });
});

/* =====================================================
   START SERVER
===================================================== */

async function startServer() {
  try {
    console.log('Initializing MongoDB...');

    await db.initDb();

    console.log(
      'MongoDB initialization completed successfully.'
    );

    const server = app.listen(PORT, () => {
      console.log(
        `Server is running on port ${PORT}`
      );

      console.log(
        `API: http://localhost:${PORT}`
      );
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(
          `Port ${PORT} is already in use.`
        );
      } else {
        console.error(
          'Server startup error:',
          error
        );
      }

      process.exit(1);
    });
  } catch (error) {
    console.error(
      'Failed to initialize application:',
      error.message
    );

    process.exit(1);
  }
}

/* =====================================================
   GRACEFUL SHUTDOWN
===================================================== */

async function shutdown(signal) {
  console.log(
    `${signal} received. Shutting down...`
  );

  try {
    await db.closeDb();

    console.log('Server shutdown completed.');

    process.exit(0);
  } catch (error) {
    console.error(
      'Shutdown error:',
      error.message
    );

    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/* =====================================================
   START APPLICATION
===================================================== */

startServer();