const prisma = require('../lib/prisma');

// @desc    Create review for a business
// @route   POST /api/businesses/:businessId/reviews
// @access  Private (Customer only)
const createReview = async (req, res) => {
    const { businessId } = req.params;
    const { rating, comment, staffId } = req.body;

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    try {
        // Check if customer has had an appointment with this business
        // If staffId is provided, check if appointment was with that staff
        const whereClause = {
            customerId: req.user.id,
            businessId,
            status: 'COMPLETED',
        };

        if (staffId) {
            whereClause.staffId = staffId;
        }

        const appointment = await prisma.appointment.findFirst({
            where: whereClause,
        });

        if (!appointment) {
            return res.status(403).json({
                message: staffId
                    ? 'You can only review staff members who have served you in a completed appointment'
                    : 'You can only review businesses where you have completed appointments'
            });
        }

        // Check if user already reviewed this business (or staff if staffId provided)
        // A user can review a business multiple times if they review different staff?
        // Or one review per appointment?
        // Let's keep it simple: One review per business per customer for now, unless we want to allow multiple.
        // But the requirement says "rate that staff".
        // So maybe we should allow reviewing a staff member separately.

        // Let's check if they already reviewed this specific staff member
        if (staffId) {
            const existingStaffReview = await prisma.review.findFirst({
                where: {
                    customerId: req.user.id,
                    businessId,
                    staffId,
                },
            });

            if (existingStaffReview) {
                return res.status(400).json({ message: 'You have already reviewed this staff member' });
            }
        } else {
            // General business review check
            const existingReview = await prisma.review.findFirst({
                where: {
                    customerId: req.user.id,
                    businessId,
                    staffId: null, // Only check for general reviews
                },
            });

            if (existingReview) {
                return res.status(400).json({ message: 'You have already reviewed this business' });
            }
        }

        const review = await prisma.review.create({
            data: {
                rating: parseInt(rating),
                comment,
                customerId: req.user.id,
                businessId,
                staffId: staffId || null,
            },
            include: {
                customer: {
                    select: { name: true },
                },
                staff: {
                    select: { name: true },
                }
            },
        });

        // Update Staff Rating if staffId is present
        if (staffId) {
            const staffReviews = await prisma.review.findMany({
                where: { staffId },
                select: { rating: true },
            });

            const totalRating = staffReviews.reduce((sum, r) => sum + r.rating, 0);
            const averageRating = totalRating / staffReviews.length;

            await prisma.staff.update({
                where: { id: staffId },
                data: {
                    rating: averageRating,
                    reviewCount: staffReviews.length,
                },
            });
        }

        res.status(201).json(review);
    } catch (error) {
        console.error('Error in createReview:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all reviews for a business
// @route   GET /api/businesses/:businessId/reviews
// @access  Public
const getBusinessReviews = async (req, res) => {
    const { businessId } = req.params;

    try {
        const reviews = await prisma.review.findMany({
            where: { businessId },
            include: {
                customer: {
                    select: { name: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(reviews);
    } catch (error) {
        console.error('Error in getBusinessReviews:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private (Customer - own review only)
const updateReview = async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;

    try {
        const review = await prisma.review.findUnique({
            where: { id },
        });

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        if (review.customerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updatedReview = await prisma.review.update({
            where: { id },
            data: {
                rating: rating ? parseInt(rating) : undefined,
                comment,
            },
            include: {
                customer: {
                    select: { name: true },
                },
            },
        });

        res.json(updatedReview);
    } catch (error) {
        console.error('Error in updateReview:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private (Customer - own review only)
const deleteReview = async (req, res) => {
    const { id } = req.params;

    try {
        const review = await prisma.review.findUnique({
            where: { id },
        });

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        if (review.customerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await prisma.review.delete({
            where: { id },
        });

        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Error in deleteReview:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    createReview,
    getBusinessReviews,
    updateReview,
    deleteReview,
};
