const express = require('express');
const router = express.Router();
const {
    createStaff,
    getStaff,
    updateStaff,
    deleteStaff,
    getStaffById,
} = require('../controllers/staffController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Business-specific staff routes
router.post('/businesses/:businessId/staff', protect, authorize('OWNER'), createStaff);
router.get('/businesses/:businessId/staff', getStaff);

// Individual staff routes
router.get('/staff/:id', getStaffById); // Public route for staff profile
router.put('/staff/:id', protect, authorize('OWNER'), updateStaff);
router.delete('/staff/:id', protect, authorize('OWNER'), deleteStaff);

module.exports = router;
