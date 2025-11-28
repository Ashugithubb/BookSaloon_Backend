const express = require('express');
const router = express.Router();
const {
    createService,
    getServices,
    updateService,
    deleteService,
} = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Business-specific service routes
router.post('/businesses/:businessId/services', protect, authorize('OWNER'), createService);
router.get('/businesses/:businessId/services', getServices);

// Individual service routes
router.put('/services/:id', protect, authorize('OWNER'), updateService);
router.delete('/services/:id', protect, authorize('OWNER'), deleteService);

module.exports = router;
