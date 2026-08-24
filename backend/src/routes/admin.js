
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const adminController = require('../controllers/adminController');
const { verifyToken, checkRole } = require('../middleware/auth');

const router = express.Router();

/* =====================================================
   Upload Configuration
   ===================================================== */

const uploadsDir = path.join(__dirname, '../../uploads');

// Create uploads directory if it does not exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      `${Date.now()}-${Math.round(Math.random() * 1e9)}` +
      path.extname(file.originalname).toLowerCase();

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,

  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
    ];

    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const isValidExtension =
      allowedExtensions.includes(extension);

    const isValidMimeType =
      allowedMimeTypes.includes(file.mimetype);

    if (isValidExtension && isValidMimeType) {
      return cb(null, true);
    }

    return cb(
      new Error(
        'Only JPEG, JPG, PNG, GIF, and WEBP images are allowed.'
      )
    );
  },

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

/* =====================================================
   Admin Authentication
   ===================================================== */

// All routes in this file require:
// 1. Valid JWT token
// 2. Admin role
router.use(
  verifyToken,
  checkRole(['admin'])
);

/* =====================================================
   Dashboard
   ===================================================== */

router.get(
  '/stats',
  adminController.getDashboardStats
);

/* =====================================================
   User Management
   ===================================================== */

// Create user
router.post(
  '/users',
  adminController.addUser
);

// Get all users
router.get(
  '/users',
  adminController.getUsers
);

// Get user by ID
router.get(
  '/users/:id',
  adminController.getUserDetails
);

// Update user
router.put(
  '/users/:id',
  adminController.updateUser
);

// Delete user
router.delete(
  '/users/:id',
  adminController.deleteUser
);

/* =====================================================
   Owner Management
   ===================================================== */

router.get(
  '/unassigned-owners',
  adminController.getUnassignedOwners
);

/* =====================================================
   Store Management
   ===================================================== */

// Create store with optional logo
router.post(
  '/stores',
  upload.single('logo'),
  adminController.addStore
);

// Get all stores
router.get(
  '/stores',
  adminController.getStores
);

// Update store with optional logo
router.put(
  '/stores/:id',
  upload.single('logo'),
  adminController.updateStore
);

// Delete store
router.delete(
  '/stores/:id',
  adminController.deleteStore
);

/* =====================================================
   Rating Management
   ===================================================== */

// Get all ratings
router.get(
  '/ratings',
  adminController.getRatings
);

// Delete rating
router.delete(
  '/ratings/:id',
  adminController.deleteRating
);

/* =====================================================
   Export Router
   ===================================================== */

module.exports = router;

