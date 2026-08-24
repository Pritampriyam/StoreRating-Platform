
const express = require('express');

const userController = require('../controllers/userController');
const { verifyToken, checkRole } = require('../middleware/auth');

const router = express.Router();

/* =====================================================
   User Authentication
   ===================================================== */

// All user routes require:
// 1. A valid JWT token
// 2. The "normal" user role
router.use(
  verifyToken,
  checkRole(['normal'])
);

/* =====================================================
   Store Routes
   ===================================================== */

// Get stores available to the user
router.get(
  '/stores',
  userController.getStoresForUser
);

/* =====================================================
   Rating Routes
   ===================================================== */

// Submit a new rating
router.post(
  '/ratings',
  userController.submitRating
);

// Modify an existing rating
router.put(
  '/ratings/:id',
  userController.modifyRating
);

/* =====================================================
   Export Router
   ===================================================== */

module.exports = router;

