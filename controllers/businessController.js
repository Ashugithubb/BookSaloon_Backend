const prisma = require('../lib/prisma');

// @desc    Create new business
// @route   POST /api/businesses
// @access  Private (Owner only)
const createBusiness = async (req, res) => {
    const { name, description, address, category } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Business name is required' });
    }

    try {
        // Check if user already has a business
        const existingBusiness = await prisma.business.findFirst({
            where: { ownerId: req.user.id },
        });

        if (existingBusiness) {
            return res.status(400).json({ message: 'You already have a business' });
        }

        const business = await prisma.business.create({
            data: {
                name,
                description,
                address,
                category,
                ownerId: req.user.id,
            },
        });

        res.status(201).json(business);
    } catch (error) {
        console.error('Error in createBusiness:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get current owner's business
// @route   GET /api/businesses/my
// @access  Private (Owner only)
const getMyBusiness = async (req, res) => {
    try {
        const business = await prisma.business.findFirst({
            where: { ownerId: req.user.id },
            include: {
                services: true,
                staff: true,
                appointments: true,
            },
        });

        if (!business) {
            return res.status(404).json({ message: 'No business found' });
        }

        res.json(business);
    } catch (error) {
        console.error('Error in getMyBusiness:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update business
// @route   PUT /api/businesses/:id
// @access  Private (Owner only)
const updateBusiness = async (req, res) => {
    const { id } = req.params;
    const { name, description, address, category } = req.body;

    try {
        // Verify ownership
        const business = await prisma.business.findUnique({
            where: { id },
        });

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updatedBusiness = await prisma.business.update({
            where: { id },
            data: {
                name,
                description,
                address,
                category,
            },
        });

        res.json(updatedBusiness);
    } catch (error) {
        console.error('Error in updateBusiness:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all businesses
// @route   GET /api/businesses
// @access  Public
const getAllBusinesses = async (req, res) => {
    try {
        const businesses = await prisma.business.findMany({
            include: {
                services: true,
                _count: {
                    select: { reviews: true },
                },
            },
        });

        res.json(businesses);
    } catch (error) {
        console.error('Error in getAllBusinesses:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get single business by ID
// @route   GET /api/businesses/:id
// @access  Public
const getBusinessById = async (req, res) => {
    const { id } = req.params;

    try {
        const business = await prisma.business.findUnique({
            where: { id },
            include: {
                services: true,
                staff: true,
                reviews: {
                    include: {
                        customer: {
                            select: { name: true },
                        },
                    },
                },
            },
        });

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        res.json(business);
    } catch (error) {
        console.error('Error in getBusinessById:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    createBusiness,
    getMyBusiness,
    updateBusiness,
    getAllBusinesses,
    getBusinessById,
};
