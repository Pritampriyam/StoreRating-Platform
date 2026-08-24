const db = require('../db');

const { User, Store, Rating } = db;

/**
 * Get Store Owner Dashboard
 *
 * Returns:
 * - Store details
 * - Average rating
 * - Total ratings
 * - List of users who rated the store
 */
exports.getOwnerDashboard = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const {
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Allowed sorting fields
    const allowedSortFields = [
      'reviewer_name',
      'reviewer_email',
      'rating',
      'created_at'
    ];

    const cleanSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';

    const cleanSortOrder =
      String(sortOrder).toUpperCase() === 'ASC' ? 1 : -1;

    /*
     * --------------------------------------------------
     * 1. Find store owned by the logged-in owner
     * --------------------------------------------------
     */

    const store = await Store.findOne({
      ownerId: ownerId
    }).lean();

    if (!store) {
      return res.json({
        hasStore: false,
        message:
          'No store has been assigned to your account yet. Please contact the administrator.'
      });
    }

    /*
     * --------------------------------------------------
     * 2. Get ratings for this store
     * --------------------------------------------------
     */

    const ratings = await Rating.find({
      storeId: store._id
    }).lean();

    /*
     * --------------------------------------------------
     * 3. Calculate rating statistics
     * --------------------------------------------------
     */

    const totalRatings = ratings.length;

    let averageRating = 0;

    if (totalRatings > 0) {
      const totalRatingValue = ratings.reduce(
        (sum, rating) => sum + Number(rating.rating || 0),
        0
      );

      averageRating = totalRatingValue / totalRatings;
    }

    /*
     * --------------------------------------------------
     * 4. Get reviewer IDs
     * --------------------------------------------------
     */

    const reviewerIds = ratings.map((rating) => rating.userId);

    /*
     * --------------------------------------------------
     * 5. Fetch users who rated the store
     * --------------------------------------------------
     */

    const users = await User.find({
      _id: { $in: reviewerIds }
    })
      .select('name email address')
      .lean();

    /*
     * --------------------------------------------------
     * 6. Create user lookup map
     * --------------------------------------------------
     */

    const userMap = new Map(
      users.map((user) => [
        String(user._id),
        user
      ])
    );

    /*
     * --------------------------------------------------
     * 7. Build reviewers response
     * --------------------------------------------------
     */

    const reviewers = ratings.map((rating) => {
      const reviewer = userMap.get(
        String(rating.userId)
      );

      return {
        rating_id: rating._id,
        rating: rating.rating,
        created_at: rating.createdAt || rating.created_at,

        reviewer_name: reviewer?.name || 'Unknown User',
        reviewer_email: reviewer?.email || '',
        reviewer_address: reviewer?.address || ''
      };
    });

    /*
     * --------------------------------------------------
     * 8. Sort reviewers
     * --------------------------------------------------
     */

    reviewers.sort((a, b) => {
      let valueA;
      let valueB;

      switch (cleanSortBy) {
        case 'reviewer_name':
          valueA = String(a.reviewer_name).toLowerCase();
          valueB = String(b.reviewer_name).toLowerCase();
          break;

        case 'reviewer_email':
          valueA = String(a.reviewer_email).toLowerCase();
          valueB = String(b.reviewer_email).toLowerCase();
          break;

        case 'rating':
          valueA = Number(a.rating || 0);
          valueB = Number(b.rating || 0);
          break;

        case 'created_at':
        default:
          valueA = new Date(a.created_at || 0).getTime();
          valueB = new Date(b.created_at || 0).getTime();
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

    /*
     * --------------------------------------------------
     * 9. Return dashboard data
     * --------------------------------------------------
     */

    return res.json({
      hasStore: true,

      store: {
        id: store._id,
        name: store.name,
        address: store.address,

        logoUrl:
          store.logoUrl ||
          store.logo_url ||
          null,

        averageRating: averageRating.toFixed(1),
        totalRatings
      },

      reviewers
    });

  } catch (err) {
    console.error(
      'Owner dashboard fetch error:',
      err
    );

    return res.status(500).json({
      error: 'Failed to retrieve dashboard data.'
    });
  }
};