const db = require('../db');

const { User, Store, Rating } = db;

/**
 * 1. Get all stores for Normal User
 *
 * Returns:
 * - Store information
 * - Overall store rating
 * - Total number of ratings
 * - Current user's rating
 * - Current user's rating ID
 */
exports.getStoresForUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      search = '',
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;

    // Allowed sorting fields
    const allowedSortFields = [
      'name',
      'address',
      'rating'
    ];

    const cleanSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'name';

    const cleanSortOrder =
      String(sortOrder).toUpperCase() === 'DESC'
        ? -1
        : 1;

    /*
     * --------------------------------------------------
     * 1. Search stores
     * --------------------------------------------------
     */

    const storeFilter = {};

    if (search.trim()) {
      const searchRegex = new RegExp(
        search.trim(),
        'i'
      );

      storeFilter.$or = [
        { name: searchRegex },
        { address: searchRegex }
      ];
    }

    /*
     * --------------------------------------------------
     * 2. Get stores
     * --------------------------------------------------
     */

    const stores = await Store.find(storeFilter)
      .lean();

    /*
     * --------------------------------------------------
     * 3. Get all ratings for these stores
     * --------------------------------------------------
     */

    const storeIds = stores.map(
      (store) => store._id
    );

    const ratings = await Rating.find({
      storeId: { $in: storeIds }
    }).lean();

    /*
     * --------------------------------------------------
     * 4. Create rating statistics for each store
     * --------------------------------------------------
     */

    const ratingStats = new Map();

    ratings.forEach((rating) => {
      const storeId = String(rating.storeId);

      if (!ratingStats.has(storeId)) {
        ratingStats.set(storeId, {
          total: 0,
          count: 0
        });
      }

      const stats = ratingStats.get(storeId);

      stats.total += Number(rating.rating || 0);
      stats.count += 1;
    });

    /*
     * --------------------------------------------------
     * 5. Create current user's rating map
     * --------------------------------------------------
     */

    const userRatings = new Map();

    ratings.forEach((rating) => {
      if (
        String(rating.userId) === String(userId)
      ) {
        userRatings.set(
          String(rating.storeId),
          {
            rating: rating.rating,
            ratingId: rating._id
          }
        );
      }
    });

    /*
     * --------------------------------------------------
     * 6. Build final store response
     * --------------------------------------------------
     */

    const result = stores.map((store) => {
      const storeId = String(store._id);

      const stats = ratingStats.get(storeId) || {
        total: 0,
        count: 0
      };

      const userRating = userRatings.get(
        storeId
      );

      const overallRating =
        stats.count > 0
          ? stats.total / stats.count
          : 0;

      return {
        id: store._id,
        name: store.name,
        email: store.email,
        address: store.address,

        logo_url:
          store.logoUrl ||
          store.logo_url ||
          null,

        overall_rating:
          Number(overallRating.toFixed(1)),

        rating_count: stats.count,

        user_rating:
          userRating?.rating || null,

        rating_id:
          userRating?.ratingId || null
      };
    });

    /*
     * --------------------------------------------------
     * 7. Sort stores
     * --------------------------------------------------
     */

    result.sort((a, b) => {
      let valueA;
      let valueB;

      switch (cleanSortBy) {
        case 'rating':
          valueA = Number(
            a.overall_rating || 0
          );

          valueB = Number(
            b.overall_rating || 0
          );
          break;

        case 'address':
          valueA = String(
            a.address || ''
          ).toLowerCase();

          valueB = String(
            b.address || ''
          ).toLowerCase();
          break;

        case 'name':
        default:
          valueA = String(
            a.name || ''
          ).toLowerCase();

          valueB = String(
            b.name || ''
          ).toLowerCase();
          break;
      }

      if (valueA < valueB) {
        return -1 * cleanSortOrder;
      }

      if (valueA > valueB) {
        return 1 * cleanSortOrder;
      }

      return 0;
    });

    return res.json(result);

  } catch (err) {
    console.error(
      'Get user stores error:',
      err
    );

    return res.status(500).json({
      error: 'Failed to retrieve store listings.'
    });
  }
};


/**
 * 2. Submit Rating
 *
 * A normal user can submit only one
 * rating for a particular store.
 */
exports.submitRating = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      storeId,
      rating
    } = req.body;

    const intRating = Number.parseInt(
      rating,
      10
    );

    /*
     * Validate rating
     */

    if (
      !storeId ||
      Number.isNaN(intRating) ||
      intRating < 1 ||
      intRating > 5
    ) {
      return res.status(400).json({
        error:
          'Please select a store and a rating between 1 and 5.'
      });
    }

    /*
     * Check if store exists
     */

    const store = await Store.findById(
      storeId
    );

    if (!store) {
      return res.status(404).json({
        error: 'Store not found.'
      });
    }

    /*
     * Check whether user already rated
     * this store.
     */

    const existingRating =
      await Rating.findOne({
        userId,
        storeId
      });

    if (existingRating) {
      return res.status(400).json({
        error:
          'You have already rated this store. Please modify your rating instead.'
      });
    }

    /*
     * Create rating
     */

    await Rating.create({
      userId,
      storeId,
      rating: intRating
    });

    return res.status(201).json({
      message:
        'Rating submitted successfully!'
    });

  } catch (err) {
    console.error(
      'Submit rating error:',
      err
    );

    return res.status(500).json({
      error: 'Failed to submit rating.'
    });
  }
};


/**
 * 3. Modify Existing Rating
 *
 * A user can modify only their own rating.
 */
exports.modifyRating = async (req, res) => {
  try {
    const userId = req.user.id;

    const ratingId = req.params.id;

    const {
      rating
    } = req.body;

    const intRating = Number.parseInt(
      rating,
      10
    );

    /*
     * Validate rating
     */

    if (
      Number.isNaN(intRating) ||
      intRating < 1 ||
      intRating > 5
    ) {
      return res.status(400).json({
        error:
          'Please enter a valid rating between 1 and 5.'
      });
    }

    /*
     * Find rating belonging to
     * current logged-in user.
     */

    const existingRating =
      await Rating.findOne({
        _id: ratingId,
        userId
      });

    if (!existingRating) {
      return res.status(404).json({
        error:
          'Rating not found or unauthorized.'
      });
    }

    /*
     * Update rating
     */

    existingRating.rating = intRating;

    await existingRating.save();

    return res.json({
      message:
        'Rating updated successfully!'
    });

  } catch (err) {
    console.error(
      'Modify rating error:',
      err
    );

    return res.status(500).json({
      error: 'Failed to modify rating.'
    });
  }
};