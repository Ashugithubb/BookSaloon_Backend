const express = require('express');
const router = express.Router();
const { uploadBusinessImages, deleteBusinessImage } = require('../controllers/uploadController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Delete business image
router.delete('/:id/images', protect, authorize('OWNER'), deleteBusinessImage);

// Upload staff image (using /api/businesses/staff/:id/images pattern to match server.js mount point if needed, 
// BUT server.js mounts this router at /api/businesses. 
// So this router handles /api/businesses/...
// We need a way to handle /api/staff uploads.
// Option 1: Mount this router at /api/upload and change all routes.
// Option 2: Add a new mount point in server.js for /api/staff and reuse this router or create a new one.
// Option 3: Keep it here but the path will be /api/businesses/staff/:id/images which is weird.

// Let's check server.js again.
// app.use('/api/businesses', uploadRoutes);
// So currently it's /api/businesses/:id/images

// I should probably create a separate route file for staff uploads or make this generic.
// Or I can add `app.use('/api/staff', uploadRoutes)` in server.js and handle the logic here.
// If I do that, `router.post('/:id/images')` will work for both /api/businesses/:id/images and /api/staff/:id/images.
// BUT the controller functions need to know which one it is, or I need separate routes in the file.

// Let's add specific routes for staff here, assuming I'll mount it correctly or use a different path.
// If I mount this router at `/api`, then:
// router.post('/businesses/:id/images', ...)
// router.post('/staff/:id/images', ...)

// Let's go with mounting at `/api` in server.js instead of `/api/businesses`.
// I'll update server.js to `app.use('/api', uploadRoutes);`
// And update the routes here to include the entity prefix.

// Upload business images
router.post('/businesses/:id/images', protect, authorize('OWNER'), upload.array('images', 10), uploadBusinessImages);
router.delete('/businesses/:id/images', protect, authorize('OWNER'), deleteBusinessImage);

// Upload staff images
const { uploadStaffImage, deleteStaffImage } = require('../controllers/uploadController');
router.post('/staff/:id/images', protect, authorize('OWNER'), upload.array('image', 1), uploadStaffImage);
router.delete('/staff/:id/images', protect, authorize('OWNER'), deleteStaffImage);

module.exports = router;
