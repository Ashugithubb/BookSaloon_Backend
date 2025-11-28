const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, googleAuth, updatePhone, verifyEmail } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-email', verifyEmail);
router.post('/google', googleAuth);
router.get('/me', protect, getMe);
router.put('/update-phone', protect, updatePhone);

module.exports = router;
