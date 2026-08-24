const bcrypt = require('bcryptjs');

const { User, Store, Rating } = require('../db');
const { sendMail } = require('../utils/mailer');

/* =====================================================
   Validation Helpers
   ===================================================== */

const validateFields = (
  name,
  email,
  password,
  address,
  role
) => {
  const errors = [];

  // Name validation
  if (
    !name ||
    name.trim().length < 2 ||
    name.trim().length > 60
  ) {
    errors.push(
      'Name must be between 2 and 60 characters.'
    );
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailRegex.test(email)) {
    errors.push(
      'Please enter a valid email address.'
    );
  }

  // Password validation
  if (
    !password ||
    password.length < 8 ||
    password.length > 16
  ) {
    errors.push(
      'Password must be between 8 and 16 characters.'
    );
  } else {
    const hasUppercase = /[A-Z]/.test(password);
    const hasSpecialChar =
      /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUppercase) {
      errors.push(
        'Password must include at least one uppercase letter.'
      );
    }

    if (!hasSpecialChar) {
      errors.push(
        'Password must include at least one special character.'
      );
    }
  }

  // Address validation
  if (
    !address ||
    address.trim().length === 0 ||
    address.length > 400
  ) {
    errors.push(
      'Address is required and cannot exceed 400 characters.'
    );
  }

  // Role validation
  if (
    !role ||
    !['admin', 'normal', 'owner'].includes(role)
  ) {
    errors.push('Invalid user role specified.');
  }

  return errors;
};

/* =====================================================
   Helper: Generate Verification Code
   ===================================================== */

const generateVerificationCode = () => {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
};

/* =====================================================
   Helper: Escape HTML
   ===================================================== */

const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/* =====================================================
   1. Dashboard Statistics
   ===================================================== */

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalStores,
      totalRatings,
    ] = await Promise.all([
      User.countDocuments(),
      Store.countDocuments(),
      Rating.countDocuments(),
    ]);

    return res.json({
      totalUsers,
      totalStores,
      totalRatings,
    });
  } catch (err) {
    console.error(
      'Stats fetch error:',
      err
    );

    return res.status(500).json({
      error: 'Failed to fetch dashboard stats.',
    });
  }
};

/* =====================================================
   2. Add User
   ===================================================== */

exports.addUser = async (req, res) => {
  const {
    name,
    email,
    password,
    address,
    role,
  } = req.body;

  const errors = validateFields(
    name,
    email,
    password,
    address,
    role
  );

  if (errors.length > 0) {
    return res.status(400).json({
      errors,
    });
  }

  try {
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Email is already registered.',
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const isOwnerOrUser =
      role === 'owner' ||
      role === 'normal';

    const verificationCode =
      isOwnerOrUser
        ? generateVerificationCode()
        : null;

    const isVerified =
      !isOwnerOrUser;

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      address: address.trim(),
      role,
      is_verified: isVerified,
      verification_code: verificationCode,
    });

    /* ---------------- Email ---------------- */

    const roleLabel =
      role === 'owner'
        ? 'Store Owner'
        : role === 'admin'
          ? 'System Administrator'
          : 'User';

    let messageText = `Hello ${name},

An administrator has created your account on StoreRating.

Here are your account credentials:
Email: ${normalizedEmail}
Password: ${password}
Role: ${roleLabel}
Address: ${address}`;

    let messageHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6;">
        <h2 style="color: #6366f1;">
          Welcome to StoreRating!
        </h2>

        <p>
          Hello <strong>${escapeHtml(name)}</strong>,
        </p>

        <p>
          An administrator has created an account
          for you on our platform.
        </p>

        <div style="padding: 15px; background: #f3f4f6; border-radius: 8px; margin: 15px 0;">
          <strong>Login Email:</strong>
          ${escapeHtml(normalizedEmail)}
          <br />

          <strong>Temporary Password:</strong>
          ${escapeHtml(password)}
          <br />

          <strong>Account Role:</strong>
          ${escapeHtml(roleLabel)}
          <br />

          <strong>Address:</strong>
          ${escapeHtml(address)}
        </div>
    `;

    if (isOwnerOrUser) {
      messageText += `

To activate your account and log in,
please verify your email.

Your 6-digit verification code is:
${verificationCode}`;

      messageHtml += `
        <p>
          To activate your account and log in,
          enter the following verification code:
        </p>

        <div style="
          font-size: 24px;
          font-weight: bold;
          color: #6366f1;
          letter-spacing: 2px;
          padding: 10px;
          background: #e0e7ff;
          display: inline-block;
          border-radius: 6px;
          margin: 10px 0;
        ">
          ${verificationCode}
        </div>
      `;
    } else {
      messageText += `

Your account is active.
You can log in directly at:
http://localhost:5173/login`;

      messageHtml += `
        <p style="color: #10b981; font-weight: bold;">
          Your account is fully activated.
          You can log in directly.
        </p>
      `;
    }

    messageHtml += '</div>';

    await sendMail(
      normalizedEmail,
      'Welcome to StoreRating - Account Created',
      messageText,
      messageHtml
    );

    return res.status(201).json({
      message: 'User added successfully!',
      code: verificationCode,
    });
  } catch (err) {
    console.error(
      'Add user error:',
      err
    );

    // MongoDB duplicate key
    if (err.code === 11000) {
      return res.status(400).json({
        error: 'Email is already registered.',
      });
    }

    return res.status(500).json({
      error: 'Failed to add new user.',
    });
  }
};

/* =====================================================
   3. Add Store
   ===================================================== */

exports.addStore = async (req, res) => {
  const {
    name,
    address,
    ownerId,
  } = req.body;

  const logoUrl = req.file
    ? `/uploads/${req.file.filename}`
    : null;

  const errors = [];

  if (
    !name ||
    name.trim().length < 2 ||
    name.trim().length > 60
  ) {
    errors.push(
      'Store Name must be between 2 and 60 characters.'
    );
  }

  if (!ownerId) {
    errors.push(
      'Store Owner selection is required.'
    );
  }

  if (
    !address ||
    address.trim().length === 0 ||
    address.length > 400
  ) {
    errors.push(
      'Address is required and cannot exceed 400 characters.'
    );
  }

  if (errors.length > 0) {
    return res.status(400).json({
      errors,
    });
  }

  try {
    const owner = await User.findById(ownerId).lean();

    if (!owner) {
      return res.status(400).json({
        error:
          'Selected Store Owner does not exist.',
      });
    }

    if (owner.role !== 'owner') {
      return res.status(400).json({
        error:
          'Selected user is not a Store Owner.',
      });
    }

    // One store per owner
    const existingStoreByOwner =
      await Store.findOne({
        owner_id: owner._id,
      });

    if (existingStoreByOwner) {
      return res.status(400).json({
        error:
          'This Store Owner is already assigned to a store.',
      });
    }

    // Store email must be unique
    const existingStoreByEmail =
      await Store.findOne({
        email: owner.email,
      });

    if (existingStoreByEmail) {
      return res.status(400).json({
        error:
          "A store with this owner's email is already registered.",
      });
    }

    await Store.create({
      name: name.trim(),
      email: owner.email,
      address: address.trim(),
      logo_url: logoUrl,
      owner_id: owner._id,
    });

    console.log(
      `[Store Assigned] Owner: ${owner.name} (${owner.email}) is assigned to store: ${name}`
    );

    /* ---------------- Email ---------------- */

    const messageText = `Hello ${owner.name},

You have been assigned as the owner of the store outlet: ${name}.

Store Name: ${name}
Location: ${address}
Owner Name: ${owner.name}
Owner Email: ${owner.email}`;

    const messageHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6;">
        <h2 style="color: #6366f1;">
          Store Assigned Successfully
        </h2>

        <p>
          Hello <strong>${escapeHtml(owner.name)}</strong>,
        </p>

        <p>
          You have been assigned as the owner
          of the following store outlet:
        </p>

        <div style="padding: 15px; background: #f3f4f6; border-radius: 8px; margin: 15px 0;">
          <strong>Store Name:</strong>
          ${escapeHtml(name)}
          <br />

          <strong>Store Address:</strong>
          ${escapeHtml(address)}
          <br />

          <strong>Owner Name:</strong>
          ${escapeHtml(owner.name)}
          <br />

          <strong>Owner Email / Store Email:</strong>
          ${escapeHtml(owner.email)}
        </div>
      </div>
    `;

    await sendMail(
      owner.email,
      `Store Assigned: ${name} - StoreRating`,
      messageText,
      messageHtml
    );

    return res.status(201).json({
      message: 'Store added successfully!',
    });
  } catch (err) {
    console.error(
      'Add store error:',
      err
    );

    if (err.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid Store Owner ID.',
      });
    }

    if (err.code === 11000) {
      return res.status(400).json({
        error:
          'A store with this email is already registered.',
      });
    }

    return res.status(500).json({
      error: 'Failed to add new store.',
    });
  }
};

/* =====================================================
   4. Get Stores
   ===================================================== */

exports.getStores = async (req, res) => {
  const {
    search = '',
    sortBy = 'name',
    sortOrder = 'ASC',
  } = req.query;

  const allowedSortFields = [
    'name',
    'email',
    'address',
    'rating',
  ];

  const cleanSortBy =
    allowedSortFields.includes(sortBy)
      ? sortBy
      : 'name';

  const cleanSortOrder =
    sortOrder.toUpperCase() === 'DESC'
      ? -1
      : 1;

  try {
    const searchText = search.trim();

    const matchStage = {};

    if (searchText) {
      const searchRegex = new RegExp(
        searchText.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        ),
        'i'
      );

      matchStage.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { address: searchRegex },
      ];
    }

    const stores = await Store.aggregate([
      {
        $match: matchStage,
      },

      {
        $lookup: {
          from: 'ratings',
          localField: '_id',
          foreignField: 'store_id',
          as: 'ratings',
        },
      },

      {
        $addFields: {
          rating: {
            $ifNull: [
              { $avg: '$ratings.rating' },
              0,
            ],
          },

          ratingCount: {
            $size: '$ratings',
          },
        },
      },

      {
        $project: {
          _id: 0,
          id: '$_id',
          name: 1,
          email: 1,
          address: 1,
          logo_url: 1,
          owner_id: 1,
          rating: 1,
          ratingCount: 1,
        },
      },

      {
        $sort: {
          [cleanSortBy]: cleanSortOrder,
        },
      },
    ]);

    return res.json(stores);
  } catch (err) {
    console.error(
      'Get stores error:',
      err
    );

    return res.status(500).json({
      error: 'Failed to retrieve stores list.',
    });
  }
};

/* =====================================================
   5. Get Users
   ===================================================== */

exports.getUsers = async (req, res) => {
  const {
    search = '',
    role = '',
    sortBy = 'name',
    sortOrder = 'ASC',
  } = req.query;

  const allowedSortFields = [
    'name',
    'email',
    'address',
    'role',
    'created_at',
  ];

  const cleanSortBy =
    allowedSortFields.includes(sortBy)
      ? sortBy
      : 'name';

  const cleanSortOrder =
    sortOrder.toUpperCase() === 'DESC'
      ? -1
      : 1;

  try {
    const filter = {};

    const searchText = search.trim();

    if (searchText) {
      const searchRegex = new RegExp(
        searchText.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        ),
        'i'
      );

      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { address: searchRegex },
      ];
    }

    if (role.trim()) {
      filter.role = role.trim();
    }

    const users = await User.find(filter)
      .select(
        'name email address role created_at'
      )
      .sort({
        [cleanSortBy]: cleanSortOrder,
      })
      .lean();

    const formattedUsers = users.map(
      (user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        address: user.address,
        role: user.role,
        created_at: user.created_at,
      })
    );

    return res.json(formattedUsers);
  } catch (err) {
    console.error(
      'Get users error:',
      err
    );

    return res.status(500).json({
      error: 'Failed to retrieve users list.',
    });
  }
};

/* =====================================================
   6. Get User Details
   ===================================================== */

exports.getUserDetails = async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await User.findById(userId)
      .select(
        'name email address role created_at'
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    const responseUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      address: user.address,
      role: user.role,
      created_at: user.created_at,
    };

    /* ---------------- Owner Store ---------------- */

    if (user.role === 'owner') {
      const store = await Store.findOne({
        owner_id: user._id,
      }).lean();

      if (store) {
        const ratingStats =
          await Rating.aggregate([
            {
              $match: {
                store_id: store._id,
              },
            },

            {
              $group: {
                _id: null,
                average_rating: {
                  $avg: '$rating',
                },
                total_ratings: {
                  $sum: 1,
                },
              },
            },
          ]);

        const stats =
          ratingStats[0] || {
            average_rating: 0,
            total_ratings: 0,
          };

        responseUser.store = {
          store_id: store._id,
          store_name: store.name,
          store_address: store.address,
          average_rating:
            stats.average_rating || 0,
          total_ratings:
            stats.total_ratings || 0,
        };
      } else {
        responseUser.store = null;
      }
    }

    return res.json(responseUser);
  } catch (err) {
    console.error(
      'Get user details error:',
      err
    );

    if (err.name === 'CastError') {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    return res.status(500).json({
      error: 'Failed to retrieve user details.',
    });
  }
};

/* =====================================================
   7. Get Unassigned Owners
   ===================================================== */

exports.getUnassignedOwners = async (
  req,
  res
) => {
  try {
    const owners = await User.aggregate([
      {
        $match: {
          role: 'owner',
        },
      },

      {
        $lookup: {
          from: 'stores',
          localField: '_id',
          foreignField: 'owner_id',
          as: 'stores',
        },
      },

      {
        $match: {
          stores: {
            $size: 0,
          },
        },
      },

      {
        $project: {
          _id: 0,
          id: '$_id',
          name: 1,
          email: 1,
        },
      },

      {
        $sort: {
          name: 1,
        },
      },
    ]);

    return res.json(owners);
  } catch (err) {
    console.error(
      'Unassigned owners fetch error:',
      err
    );

    return res.status(500).json({
      error:
        'Failed to retrieve unassigned store owners.',
    });
  }
};

/* =====================================================
   8. Update User
   ===================================================== */

exports.updateUser = async (req, res) => {
  const userId = req.params.id;

  const {
    name,
    email,
    password,
    address,
    role,
  } = req.body;

  const errors = [];

  /* ---------------- Validation ---------------- */

  if (
    !name ||
    name.trim().length < 2 ||
    name.trim().length > 60
  ) {
    errors.push(
      'Name must be between 2 and 60 characters.'
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailRegex.test(email)) {
    errors.push(
      'Please enter a valid email address.'
    );
  }

  if (
    password &&
    password.trim().length > 0
  ) {
    if (
      password.length < 8 ||
      password.length > 16
    ) {
      errors.push(
        'Password must be between 8 and 16 characters.'
      );
    } else {
      const hasUppercase =
        /[A-Z]/.test(password);

      const hasSpecialChar =
        /[!@#$%^&*(),.?":{}|<>]/.test(
          password
        );

      if (!hasUppercase) {
        errors.push(
          'Password must include at least one uppercase letter.'
        );
      }

      if (!hasSpecialChar) {
        errors.push(
          'Password must include at least one special character.'
        );
      }
    }
  }

  if (
    !address ||
    address.trim().length === 0 ||
    address.length > 400
  ) {
    errors.push(
      'Address is required and cannot exceed 400 characters.'
    );
  }

  if (
    !role ||
    !['admin', 'normal', 'owner'].includes(role)
  ) {
    errors.push(
      'Invalid user role specified.'
    );
  }

  if (errors.length > 0) {
    return res.status(400).json({
      errors,
    });
  }

  try {
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const existingUser =
      await User.findOne({
        email: normalizedEmail,
        _id: {
          $ne: userId,
        },
      });

    if (existingUser) {
      return res.status(400).json({
        error:
          'Email is already taken by another account.',
      });
    }

    const updateData = {
      name: name.trim(),
      email: normalizedEmail,
      address: address.trim(),
      role,
    };

    if (
      password &&
      password.trim().length > 0
    ) {
      updateData.password =
        await bcrypt.hash(password, 10);
    }

    const updatedUser =
      await User.findByIdAndUpdate(
        userId,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    return res.json({
      message:
        'User details updated successfully!',
    });
  } catch (err) {
    console.error(
      'Update user error:',
      err
    );

    if (err.name === 'CastError') {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    if (err.code === 11000) {
      return res.status(400).json({
        error:
          'Email is already taken by another account.',
      });
    }

    return res.status(500).json({
      error: 'Failed to update user details.',
    });
  }
};

/* =====================================================
   9. Delete User
   ===================================================== */

exports.deleteUser = async (req, res) => {
  const userId = req.params.id;

  const adminId = req.user.id;

  if (
    String(userId) === String(adminId)
  ) {
    return res.status(400).json({
      error:
        'You cannot delete your own admin account.',
    });
  }

  try {
    const user = await User.findById(
      userId
    ).lean();

    if (!user) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    if (
      user.email === 'admin@gmail.com'
    ) {
      return res.status(400).json({
        error:
          'The primary system admin account cannot be deleted.',
      });
    }

    /*
     * Remove ratings created by this user.
     */
    await Rating.deleteMany({
      user_id: user._id,
    });

    /*
     * If this user is an owner,
     * remove the associated store.
     */
    if (user.role === 'owner') {
      await Store.deleteMany({
        owner_id: user._id,
      });
    }

    await User.findByIdAndDelete(
      userId
    );

    return res.json({
      message: 'User deleted successfully!',
    });
  } catch (err) {
    console.error(
      'Delete user error:',
      err
    );

    if (err.name === 'CastError') {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    return res.status(500).json({
      error: 'Failed to delete user.',
    });
  }
};

/* =====================================================
   10. Update Store
   ===================================================== */

exports.updateStore = async (req, res) => {
  const storeId = req.params.id;

  const {
    name,
    address,
    ownerId,
  } = req.body;

  const logoUrl = req.file
    ? `/uploads/${req.file.filename}`
    : null;

  const errors = [];

  if (
    !name ||
    name.trim().length < 2 ||
    name.trim().length > 60
  ) {
    errors.push(
      'Store Name must be between 2 and 60 characters.'
    );
  }

  if (!ownerId) {
    errors.push(
      'Store Owner selection is required.'
    );
  }

  if (
    !address ||
    address.trim().length === 0 ||
    address.length > 400
  ) {
    errors.push(
      'Address is required and cannot exceed 400 characters.'
    );
  }

  if (errors.length > 0) {
    return res.status(400).json({
      errors,
    });
  }

  try {
    const store = await Store.findById(
      storeId
    );

    if (!store) {
      return res.status(404).json({
        error: 'Store outlet not found.',
      });
    }

    const owner = await User.findById(
      ownerId
    ).lean();

    if (!owner) {
      return res.status(400).json({
        error:
          'Selected Store Owner does not exist.',
      });
    }

    if (owner.role !== 'owner') {
      return res.status(400).json({
        error:
          'Selected user is not a Store Owner.',
      });
    }

    const existingStoreByOwner =
      await Store.findOne({
        owner_id: owner._id,
        _id: {
          $ne: store._id,
        },
      });

    if (existingStoreByOwner) {
      return res.status(400).json({
        error:
          'This Store Owner is already assigned to another store.',
      });
    }

    const existingStoreByEmail =
      await Store.findOne({
        email: owner.email,
        _id: {
          $ne: store._id,
        },
      });

    if (existingStoreByEmail) {
      return res.status(400).json({
        error:
          "A store with this owner's email is already registered.",
      });
    }

    store.name = name.trim();
    store.email = owner.email;
    store.address = address.trim();
    store.owner_id = owner._id;

    if (logoUrl) {
      store.logo_url = logoUrl;
    }

    await store.save();

    /* ---------------- Email ---------------- */

    const messageText = `Hello ${owner.name},

Your assigned store outlet details have been updated.

Store Name: ${name}
Location: ${address}
Owner Name: ${owner.name}
Owner Email: ${owner.email}`;

    const messageHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6;">
        <h2 style="color: #6366f1;">
          Store Outlet Updated
        </h2>

        <p>
          Hello <strong>${escapeHtml(owner.name)}</strong>,
        </p>

        <p>
          Your assigned store outlet has been updated:
        </p>

        <div style="padding: 15px; background: #f3f4f6; border-radius: 8px; margin: 15px 0;">
          <strong>Store Name:</strong>
          ${escapeHtml(name)}
          <br />

          <strong>Store Address:</strong>
          ${escapeHtml(address)}
          <br />

          <strong>Owner Name:</strong>
          ${escapeHtml(owner.name)}
          <br />

          <strong>Owner Email / Store Email:</strong>
          ${escapeHtml(owner.email)}
        </div>
      </div>
    `;

    await sendMail(
      owner.email,
      `Store Details Updated: ${name} - StoreRating`,
      messageText,
      messageHtml
    );

    return res.json({
      message:
        'Store outlet updated successfully!',
    });
  } catch (err) {
    console.error(
      'Update store error:',
      err
    );

    if (err.name === 'CastError') {
      return res.status(404).json({
        error: 'Store outlet not found.',
      });
    }

    if (err.code === 11000) {
      return res.status(400).json({
        error:
          'A store with this email is already registered.',
      });
    }

    return res.status(500).json({
      error:
        'Failed to update store outlet.',
    });
  }
};

/* =====================================================
   11. Delete Store
   ===================================================== */

exports.deleteStore = async (req, res) => {
  const storeId = req.params.id;

  try {
    const store = await Store.findById(
      storeId
    );

    if (!store) {
      return res.status(404).json({
        error: 'Store outlet not found.',
      });
    }

    /*
     * Delete ratings belonging to this store.
     */
    await Rating.deleteMany({
      store_id: store._id,
    });

    await Store.findByIdAndDelete(
      storeId
    );

    return res.json({
      message:
        'Store outlet deleted successfully!',
    });
  } catch (err) {
    console.error(
      'Delete store error:',
      err
    );

    if (err.name === 'CastError') {
      return res.status(404).json({
        error: 'Store outlet not found.',
      });
    }

    return res.status(500).json({
      error:
        'Failed to delete store outlet.',
    });
  }
};

/* =====================================================
   12. Get Ratings
   ===================================================== */

exports.getRatings = async (req, res) => {
  const {
    search = '',
    sortBy = 'created_at',
    sortOrder = 'DESC',
  } = req.query;

  const allowedSortFields = [
    'store_name',
    'user_name',
    'rating',
    'created_at',
  ];

  const cleanSortBy =
    allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';

  const cleanSortOrder =
    sortOrder.toUpperCase() === 'ASC'
      ? 1
      : -1;

  try {
    const searchText = search.trim();

    const matchStage = {};

    if (searchText) {
      const searchRegex = new RegExp(
        searchText.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        ),
        'i'
      );

      /*
       * Search is applied after users and stores
       * are joined.
       */
      matchStage.$or = [
        {
          'store.name': searchRegex,
        },
        {
          'user.name': searchRegex,
        },
      ];
    }

    const sortField =
      cleanSortBy === 'store_name'
        ? 'store_name'
        : cleanSortBy === 'user_name'
          ? 'user_name'
          : cleanSortBy;

    const ratings = await Rating.aggregate([
      /* ---------------- Store ---------------- */

      {
        $lookup: {
          from: 'stores',
          localField: 'store_id',
          foreignField: '_id',
          as: 'store',
        },
      },

      {
        $unwind: {
          path: '$store',
          preserveNullAndEmptyArrays: false,
        },
      },

      /* ---------------- User ---------------- */

      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user',
        },
      },

      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: false,
        },
      },

      /* ---------------- Search ---------------- */

      {
        $match: matchStage,
      },

      /* ---------------- Output ---------------- */

      {
        $project: {
          _id: 0,
          id: '$_id',
          rating: 1,
          created_at: 1,
          store_name: '$store.name',
          user_name: '$user.name',
        },
      },

      /* ---------------- Sort ---------------- */

      {
        $sort: {
          [sortField]: cleanSortOrder,
        },
      },
    ]);

    return res.json(ratings);
  } catch (err) {
    console.error(
      'Get ratings error:',
      err
    );

    return res.status(500).json({
      error:
        'Failed to retrieve ratings list.',
    });
  }
};

/* =====================================================
   13. Delete Rating
   ===================================================== */

exports.deleteRating = async (req, res) => {
  const ratingId = req.params.id;

  try {
    const rating =
      await Rating.findById(
        ratingId
      );

    if (!rating) {
      return res.status(404).json({
        error: 'Rating not found.',
      });
    }

    await Rating.findByIdAndDelete(
      ratingId
    );

    return res.json({
      message:
        'Rating deleted successfully!',
    });
  } catch (err) {
    console.error(
      'Delete rating error:',
      err
    );

    if (err.name === 'CastError') {
      return res.status(404).json({
        error: 'Rating not found.',
      });
    }

    return res.status(500).json({
      error:
        'Failed to delete rating.',
    });
  }
};