const express = require('express');
const router = express.Router();
const {
    createBusiness,
    getMyBusiness,
    updateBusiness,
    getAllBusinesses,
    getBusinessById,
} = require('../controllers/businessController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('OWNER'), createBusiness);
router.get('/my', protect, authorize('OWNER'), getMyBusiness);
router.get('/', getAllBusinesses);
router.put('/:id', protect, authorize('OWNER'), updateBusiness);
router.get('/:id', getBusinessById); // Keep /:id routes last

module.exports = router;
