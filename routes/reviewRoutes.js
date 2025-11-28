const express = require('express');
const router = express.Router();
const {
    createReview,
    getBusinessReviews,
    updateReview,
    deleteReview,
} = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Business-specific review routes
router.post('/businesses/:businessId/reviews', protect, authorize('CUSTOMER'), createReview);
router.get('/businesses/:businessId/reviews', getBusinessReviews);

// Individual review routes
router.put('/reviews/:id', protect, authorize('CUSTOMER'), updateReview);
router.delete('/reviews/:id', protect, authorize('CUSTOMER'), deleteReview);

module.exports = router;
