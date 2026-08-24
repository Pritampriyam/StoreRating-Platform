const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

require('dotenv').config({ override: true });

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/store_rating_db';

/* =====================================================
   USER SCHEMA
===================================================== */

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 100,
    },

    password: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },

    role: {
      type: String,
      enum: ['admin', 'normal', 'owner'],
      default: 'normal',
      required: true,
    },

    is_verified: {
      type: Boolean,
      default: false,
    },

    verification_code: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

/* =====================================================
   STORE SCHEMA
===================================================== */

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 100,
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },

    logo_url: {
      type: String,
      default: null,
    },

    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

/*
 * One owner can have only one store.
 */
storeSchema.index(
  { owner_id: 1 },
  { unique: true }
);

/*
 * Store email should also be unique.
 */
storeSchema.index(
  { email: 1 },
  { unique: true }
);

/* =====================================================
   RATING SCHEMA
===================================================== */

const ratingSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

/*
 * One user can rate one store only once.
 */
ratingSchema.index(
  {
    user_id: 1,
    store_id: 1,
  },
  {
    unique: true,
  }
);

/* =====================================================
   MODELS
===================================================== */

const User = mongoose.model('User', userSchema);
const Store = mongoose.model('Store', storeSchema);
const Rating = mongoose.model('Rating', ratingSchema);

/* =====================================================
   CONNECT DATABASE
===================================================== */

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(MONGO_URI);

    console.log('✅ MongoDB connected successfully.');

    return mongoose.connection;
  } catch (error) {
    console.error(
      '❌ MongoDB connection failed:',
      error.message
    );

    throw error;
  }
}

/* =====================================================
   SEED DEFAULT ADMIN
===================================================== */

async function seedAdmin() {
  const adminEmail = 'admin@gmail.com';

  try {
    const existingAdmin = await User.findOne({
      email: adminEmail,
    });

    if (existingAdmin) {
      console.log('Default admin already exists.');
      return;
    }

    const hashedPassword = await bcrypt.hash(
      'admin123',
      10
    );

    await User.create({
      name: 'System Administrator User',
      email: adminEmail,
      password: hashedPassword,
      address: 'Main Office, System Center, Suite 101',
      role: 'admin',
      is_verified: true,
      verification_code: null,
    });

    console.log(
      '✅ Default admin created: admin@gmail.com'
    );
  } catch (error) {
    console.error(
      '❌ Admin seeding failed:',
      error.message
    );

    throw error;
  }
}

/* =====================================================
   INITIALIZE DATABASE
===================================================== */

async function initDb() {
  try {
    await connectDB();

    /*
     * Make sure indexes are created.
     */
    await User.init();
    await Store.init();
    await Rating.init();

    /*
     * Create default admin.
     */
    await seedAdmin();

    console.log(
      '✅ MongoDB initialization completed.'
    );
  } catch (error) {
    console.error(
      '❌ Database initialization failed:',
      error.message
    );

    throw error;
  }
}

/* =====================================================
   CLOSE DATABASE
===================================================== */

async function closeDb() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
    }
  } catch (error) {
    console.error(
      'Error closing MongoDB:',
      error.message
    );
  }
}

/* =====================================================
   CONNECTION EVENTS
===================================================== */

mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established.');
});

mongoose.connection.on('error', (error) => {
  console.error(
    'MongoDB error:',
    error.message
  );
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected.');
});

/* =====================================================
   EXPORTS
===================================================== */

module.exports = {
  mongoose,
  connectDB,
  initDb,
  closeDb,
  User,
  Store,
  Rating,
};