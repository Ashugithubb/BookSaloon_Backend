const express = require('express');
const router = express.Router();
const {
    createAppointment,
    getMyAppointments,
    getBusinessAppointments,
    updateAppointmentStatus,
    getAvailableSlots,
    initiateCompletion,
    verifyCompletion,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Available slots must come before :id routes
router.get('/available-slots', getAvailableSlots);

router.post('/', protect, authorize('CUSTOMER'), createAppointment);
router.get('/my', protect, authorize('CUSTOMER'), getMyAppointments);
router.get('/:businessId', protect, authorize('OWNER'), getBusinessAppointments);
router.put('/:id/status', protect, authorize('OWNER'), updateAppointmentStatus);
router.post('/:id/initiate-completion', protect, authorize('OWNER'), initiateCompletion);
router.post('/:id/verify-completion', protect, authorize('OWNER'), verifyCompletion);

module.exports = router;
