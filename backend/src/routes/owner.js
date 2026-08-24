
const express = require('express');

const ownerController = require('../controllers/ownerController');
const { verifyToken, checkRole } = require('../middleware/auth');

const router = express.Router();

/* =====================================================
   Owner Authentication
   ===================================================== */

// All owner routes require:
// 1. Valid JWT token
// 2. Owner role
router.use(
  verifyToken,
  checkRole(['owner'])
);

/* =====================================================
   Owner Dashboard
   ===================================================== */

router.get(
  '/dashboard',
  ownerController.getOwnerDashboard
);

/* =====================================================
   Export Router
   ===================================================== */

module.exports = router;

