const mongoose = require('mongoose');

require('dotenv').config({ override: true });

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/store_rating';

async function test() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', MONGO_URI);

    await mongoose.connect(MONGO_URI);

    console.log('✅ Successfully connected to MongoDB!');

    // Get current database name
    const db = mongoose.connection.db;

    console.log(
      'Database:',
      db.databaseName
    );

    // List collections
    const collections = await db
      .listCollections()
      .toArray();

    if (collections.length === 0) {
      console.log(
        'No collections found yet.'
      );
    } else {
      console.log(
        'Collections:',
        collections.map(
          (collection) => collection.name
        )
      );
    }

    await mongoose.connection.close();

    console.log(
      'MongoDB connection closed.'
    );
  } catch (error) {
    console.error(
      '❌ MongoDB connection failed:'
    );

    console.error(error.message);

    process.exitCode = 1;
  }
}

test();