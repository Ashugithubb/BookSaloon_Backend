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
    markAsCompleted,
    markAsNoShow,
    cleanupExpiredAppointments,
    claimAppointment,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Available slots must come before :id routes
router.get('/available-slots', getAvailableSlots);

router.post('/', protect, authorize('CUSTOMER'), createAppointment);
router.get('/my', protect, authorize('CUSTOMER'), getMyAppointments);
router.get('/:businessId', protect, authorize('OWNER'), getBusinessAppointments);
router.put('/:id/status', protect, authorize('OWNER', 'STAFF'), updateAppointmentStatus);
router.post('/:id/initiate-completion', protect, authorize('OWNER', 'STAFF'), initiateCompletion);
router.post('/:id/verify-completion', protect, authorize('OWNER', 'STAFF'), verifyCompletion);
router.post('/:id/complete', protect, authorize('OWNER', 'STAFF'), markAsCompleted);
router.post('/:id/no-show', protect, authorize('OWNER', 'STAFF'), markAsNoShow);
router.post('/cleanup-expired', protect, authorize('OWNER'), cleanupExpiredAppointments);
router.post('/:id/claim', protect, authorize('STAFF'), claimAppointment);

module.exports = router;
