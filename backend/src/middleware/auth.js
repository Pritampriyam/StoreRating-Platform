const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET =
  process.env.JWT_SECRET || 'store_rating_secret_key_123';

/**
 * Verify JWT token
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Access denied. No token provided.'
      });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Access denied. Invalid token format.'
      });
    }

    const token = parts[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    console.error('Token verification error:', error.message);

    return res.status(403).json({
      error: 'Invalid or expired token.'
    });
  }
};

/**
 * Check whether authenticated user
 * has one of the required roles.
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized.'
      });
    }

    if (!Array.isArray(roles) || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied. Insufficient privileges.'
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  checkRole
};