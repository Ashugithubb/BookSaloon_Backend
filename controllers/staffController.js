const prisma = require('../lib/prisma');

// @desc    Create new staff member
// @route   POST /api/businesses/:businessId/staff
// @access  Private (Owner only)
const createStaff = async (req, res) => {
    const { businessId } = req.params;
    const { name, email, phone } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Staff name is required' });
    }

    try {
        // Verify business ownership
        const business = await prisma.business.findUnique({
            where: { id: businessId },
        });

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const staff = await prisma.staff.create({
            data: {
                name,
                email,
                phone,
                businessId,
            },
        });

        res.status(201).json(staff);
    } catch (error) {
        console.error('Error in createStaff:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all staff for a business
// @route   GET /api/businesses/:businessId/staff
// @access  Public
const getStaff = async (req, res) => {
    const { businessId } = req.params;

    try {
        const staff = await prisma.staff.findMany({
            where: { businessId },
        });

        res.json(staff);
    } catch (error) {
        console.error('Error in getStaff:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update staff member
// @route   PUT /api/staff/:id
// @access  Private (Owner only)
const updateStaff = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    try {
        const staff = await prisma.staff.findUnique({
            where: { id },
            include: { business: true },
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        if (staff.business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updatedStaff = await prisma.staff.update({
            where: { id },
            data: {
                name,
                email,
                phone,
            },
        });

        res.json(updatedStaff);
    } catch (error) {
        console.error('Error in updateStaff:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete staff member
// @route   DELETE /api/staff/:id
// @access  Private (Owner only)
const deleteStaff = async (req, res) => {
    const { id } = req.params;

    try {
        const staff = await prisma.staff.findUnique({
            where: { id },
            include: { business: true },
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        if (staff.business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await prisma.staff.delete({
            where: { id },
        });

        res.json({ message: 'Staff member deleted successfully' });
    } catch (error) {
        console.error('Error in deleteStaff:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get staff by ID with reviews
// @route   GET /api/staff/:id
// @access  Public
const getStaffById = async (req, res) => {
    const { id } = req.params;

    try {
        const staff = await prisma.staff.findUnique({
            where: { id },
            include: {
                reviews: {
                    include: {
                        customer: {
                            select: { name: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                business: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        res.json(staff);
    } catch (error) {
        console.error('Error in getStaffById:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    createStaff,
    getStaff,
    updateStaff,
    deleteStaff,
    getStaffById,
};
