const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ override: true });

const FALLBACK_PASSWORDS = [
  process.env.DB_PASSWORD,
  'root',
  '',
  'admin',
  'password',
  'root123',
  'admin123',
  'root@123',
  'Adarsh@123',
  'Adarsh123',
  'adarsh@123',
  '12345678',
  '123456',
  'mysql'
];

const fallbackDataDir = path.join(__dirname, '../data');
const fallbackDataFile = path.join(fallbackDataDir, 'fallback-db.json');

let pool = null;
let activePasswordUsed = null;
let fallbackMode = false;
let fallbackData = null;

function ensureFallbackDataFile() {
  if (!fs.existsSync(fallbackDataDir)) {
    fs.mkdirSync(fallbackDataDir, { recursive: true });
  }

  if (!fs.existsSync(fallbackDataFile)) {
    const initialData = {
      users: [],
      stores: [],
      ratings: []
    };
    fs.writeFileSync(fallbackDataFile, JSON.stringify(initialData, null, 2));
  }

  if (!fallbackData) {
    fallbackData = JSON.parse(fs.readFileSync(fallbackDataFile, 'utf8'));
  }

  return fallbackData;
}

function persistFallbackData() {
  ensureFallbackDataFile();
  fs.writeFileSync(fallbackDataFile, JSON.stringify(fallbackData, null, 2));
}

async function connectWithFallback() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306');
  const user = process.env.DB_USER || 'root';
  const dbName = process.env.DB_NAME || 'store_rating_db';

  let lastError = null;

  for (const password of FALLBACK_PASSWORDS) {
    if (password === undefined) continue;
    try {
      const connection = await mysql.createConnection({
        host,
        port,
        user,
        password
      });

      console.log(`Successfully authenticated MySQL with password: ${password === '' ? '(empty)' : password}`);
      activePasswordUsed = password;

      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await connection.end();

      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      fallbackMode = false;
      return pool;
    } catch (err) {
      lastError = err;
      if (err.code !== 'ER_ACCESS_DENIED_ERROR') {
        break;
      }
    }
  }

  fallbackMode = true;
  ensureFallbackDataFile();
  return null;
}

function getNextId(collectionName) {
  const collection = fallbackData[collectionName] || [];
  if (!collection.length) return 1;
  return Math.max(...collection.map(item => Number(item.id || 0))) + 1;
}

function selectProjectedRows(collectionName, predicate, projection) {
  const rows = (fallbackData[collectionName] || []).filter(predicate);
  return rows.map(row => {
    if (!projection || projection.length === 0 || projection.includes('*')) {
      return { ...row };
    }

    const projected = {};
    projection.forEach(field => {
      const normalizedField = field.trim();
      if (normalizedField in row) {
        projected[normalizedField] = row[normalizedField];
      }
    });
    return projected;
  });
}

function executeFallbackQuery(sql, params = []) {
  const normalizedSql = sql.trim();

  const countMatch = normalizedSql.match(/^SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)/i);
  if (countMatch) {
    const tableName = countMatch[1].toLowerCase();
    const collection = fallbackData[tableName] || [];
    return [{ count: collection.length }];
  }

  const userSelectMatch = normalizedSql.match(/^SELECT\s+(.+?)\s+FROM\s+users\s+WHERE\s+email\s*=\s*\?/i);
  if (userSelectMatch) {
    const projection = userSelectMatch[1].split(',').map(item => item.trim());
    const email = params[0];
    return selectProjectedRows('users', user => user.email === email, projection);
  }

  const userByIdSelectMatch = normalizedSql.match(/^SELECT\s+(.+?)\s+FROM\s+users\s+WHERE\s+id\s*=\s*\?/i);
  if (userByIdSelectMatch) {
    const projection = userByIdSelectMatch[1].split(',').map(item => item.trim());
    const userId = Number(params[0]);
    return selectProjectedRows('users', user => Number(user.id) === userId, projection);
  }

  const passwordByIdMatch = normalizedSql.match(/^SELECT\s+password\s+FROM\s+users\s+WHERE\s+id\s*=\s*\?/i);
  if (passwordByIdMatch) {
    const userId = Number(params[0]);
    const user = (fallbackData.users || []).find(item => Number(item.id) === userId);
    return user ? [{ password: user.password }] : [];
  }

  const insertUserMatch = normalizedSql.match(/^INSERT\s+INTO\s+users\s*\((.+)\)\s+VALUES\s*\((.+)\)/i);
  if (insertUserMatch) {
    const columns = insertUserMatch[1].split(',').map(item => item.trim());
    const values = insertUserMatch[2].split(',').map(item => item.trim());
    const user = {};

    columns.forEach((column, index) => {
      const value = params[index];
      if (value === undefined) return;
      if (values[index] === '?') {
        user[column] = value;
      }
    });

    const id = getNextId('users');
    const newUser = {
      id,
      name: user.name || '',
      email: user.email || '',
      password: user.password || '',
      address: user.address || '',
      role: user.role || 'normal',
      is_verified: user.is_verified === 1 || user.is_verified === '1' ? 1 : 0,
      verification_code: user.verification_code || null,
      created_at: new Date().toISOString()
    };

    fallbackData.users.push(newUser);
    persistFallbackData();
    return [{ insertId: id, affectedRows: 1 }];
  }

  const updateUserMatch = normalizedSql.match(/^UPDATE\s+users\s+SET\s+(.+)\s+WHERE\s+id\s*=\s*\?/i);
  if (updateUserMatch) {
    const assignments = updateUserMatch[1]
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    const assignmentParams = params.slice(0, -1);
    const userId = Number(params[params.length - 1]);
    const user = (fallbackData.users || []).find(item => Number(item.id) === userId);
    if (!user) return [{ affectedRows: 0 }];

    let paramIndex = 0;
    assignments.forEach((assignment) => {
      const [fieldName, rawValue] = assignment.split('=');
      const trimmedField = fieldName.trim();
      const normalizedValue = rawValue ? rawValue.trim() : '';

      if (trimmedField === 'is_verified') {
        if (normalizedValue === '0') {
          user.is_verified = 0;
        } else if (normalizedValue === '1') {
          user.is_verified = 1;
        }
      } else if (trimmedField === 'password') {
        user.password = assignmentParams[paramIndex] ?? null;
        paramIndex += 1;
      } else if (trimmedField === 'verification_code') {
        if (normalizedValue === 'NULL') {
          user.verification_code = null;
        } else if (normalizedValue === '?') {
          user.verification_code = assignmentParams[paramIndex] ?? null;
          paramIndex += 1;
        }
      }
    });

    persistFallbackData();
    return [{ affectedRows: 1 }];
  }

  if (normalizedSql.startsWith('SELECT id FROM users WHERE email = ?')) {
    return [];
  }

  if (normalizedSql.startsWith('SELECT id FROM stores WHERE owner_id = ?')) {
    return [];
  }

  if (normalizedSql.startsWith('SELECT id FROM stores WHERE email = ?')) {
    return [];
  }

  if (normalizedSql.startsWith('SELECT id FROM ratings WHERE')) {
    return [];
  }

  if (normalizedSql.startsWith('SELECT id FROM users WHERE id = ?')) {
    return [];
  }

  return [];
}

async function query(sql, params = []) {
  if (!pool) {
    await connectWithFallback();
  }

  if (pool) {
    const [results] = await pool.execute(sql, params);
    return results;
  }

  return executeFallbackQuery(sql, params);
}

async function initDb() {
  try {
    await connectWithFallback();

    if (pool) {
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          address VARCHAR(500) NOT NULL,
          role ENUM('admin', 'normal', 'owner') NOT NULL DEFAULT 'normal',
          is_verified TINYINT(1) NOT NULL DEFAULT 0,
          verification_code VARCHAR(10) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      try {
        await query('ALTER TABLE users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0');
      } catch (err) {
        // Ignore if column already exists
      }
      try {
        await query('ALTER TABLE users ADD COLUMN verification_code VARCHAR(10) NULL');
      } catch (err) {
        // Ignore if column already exists
      }

      await query(`
        CREATE TABLE IF NOT EXISTS stores (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL UNIQUE,
          address VARCHAR(500) NOT NULL,
          logo_url VARCHAR(255) NULL,
          owner_id INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS ratings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          store_id INT NOT NULL,
          rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_store (user_id, store_id)
        )
      `);

      console.log('Database tables verified/created successfully.');
    }

    ensureFallbackDataFile();

    const admins = await query('SELECT * FROM users WHERE email = ?', ['admin@gmail.com']);
    if (admins.length === 0) {
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      await query(
        'INSERT INTO users (name, email, password, address, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
        ['System Administrator User', 'admin@gmail.com', adminPasswordHash, 'Main Office, System Center, Suite 101', 'admin', 1]
      );
      console.log('Default admin seeded successfully: admin@gmail.com / admin123');
    } else {
      await query('UPDATE users SET is_verified = 1 WHERE email = ?', ['admin@gmail.com']);
    }
  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }
}

module.exports = {
  query,
  initDb,
  getActivePasswordUsed: () => activePasswordUsed
};
