const prisma = require('../lib/prisma');
const cloudinary = require('cloudinary').v2;

// @desc    Upload business images
// @route   POST /api/businesses/:id/images
// @access  Private (Owner)
const uploadBusinessImages = async (req, res) => {
    const { id } = req.params;

    try {
        console.log('Upload request received for business:', id);

        // Verify business ownership
        const business = await prisma.business.findUnique({
            where: { id },
        });

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Get uploaded files
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        // Cloudinary returns the URL in file.path
        const imageUrls = files.map(file => file.path);
        console.log('New image URLs:', imageUrls);

        // Update business with new images
        const updatedBusiness = await prisma.business.update({
            where: { id },
            data: {
                images: [...(business.images || []), ...imageUrls]
            }
        });

        res.json({
            message: 'Images uploaded successfully',
            images: imageUrls,
            business: updatedBusiness
        });
    } catch (error) {
        console.error('Error in uploadBusinessImages:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete business image
// @route   DELETE /api/businesses/:id/images
// @access  Private (Owner)
const deleteBusinessImage = async (req, res) => {
    const { id } = req.params;
    const { imageUrl } = req.body;

    try {
        // Verify business ownership
        const business = await prisma.business.findUnique({
            where: { id },
        });

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Remove image from array
        const updatedImages = business.images.filter(img => img !== imageUrl);

        // Update business
        const updatedBusiness = await prisma.business.update({
            where: { id },
            data: {
                images: updatedImages
            }
        });

        // TODO: Delete from Cloudinary using public_id extracted from URL
        // For now, we just remove reference from DB

        res.json({
            message: 'Image deleted successfully',
            business: updatedBusiness
        });
    } catch (error) {
        console.error('Error in deleteBusinessImage:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Upload staff image
// @route   POST /api/staff/:id/images
// @access  Private (Owner)
const uploadStaffImage = async (req, res) => {
    const { id } = req.params;

    try {
        // Verify staff exists and user is owner of the business
        const staff = await prisma.staff.findUnique({
            where: { id },
            include: { business: true },
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        if (staff.business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Get uploaded file
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No image uploaded' });
        }

        const file = files[0];
        const imageUrl = file.path; // Cloudinary URL

        // Update staff with new image
        const updatedStaff = await prisma.staff.update({
            where: { id },
            data: {
                image: imageUrl
            }
        });

        res.json({
            message: 'Staff image uploaded successfully',
            image: imageUrl,
            staff: updatedStaff
        });
    } catch (error) {
        console.error('Error in uploadStaffImage:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete staff image
// @route   DELETE /api/staff/:id/images
// @access  Private (Owner)
const deleteStaffImage = async (req, res) => {
    const { id } = req.params;

    try {
        const staff = await prisma.staff.findUnique({
            where: { id },
            include: { business: true },
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        if (staff.business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Update staff
        const updatedStaff = await prisma.staff.update({
            where: { id },
            data: {
                image: null
            }
        });

        // TODO: Delete from Cloudinary

        res.json({
            message: 'Staff image deleted successfully',
            staff: updatedStaff
        });
    } catch (error) {
        console.error('Error in deleteStaffImage:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    uploadBusinessImages,
    deleteBusinessImage,
    uploadStaffImage,
    deleteStaffImage,
};
