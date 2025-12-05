const prisma = require('../lib/prisma');

// @desc    Create new business
// @route   POST /api/businesses
// @access  Private (Owner only)
const createBusiness = async (req, res) => {
    const { name, description, address, phone, latitude, longitude, category, hours } = req.body;

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
                phone,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                category,
                ownerId: req.user.id,
                hours: {
                    create: hours || []
                }
            },
            include: {
                hours: true
            }
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
                hours: {
                    orderBy: { dayOfWeek: 'asc' }
                }
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
    const { name, description, address, phone, latitude, longitude, category, hours } = req.body;

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

        // Update business details
        const updatedBusiness = await prisma.business.update({
            where: { id },
            data: {
                name,
                description,
                address,
                phone,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                category,
            },
        });

        // Update hours if provided
        if (hours && Array.isArray(hours)) {
            // Delete existing hours
            await prisma.businessHour.deleteMany({
                where: { businessId: id }
            });

            // Create new hours
            await prisma.businessHour.createMany({
                data: hours.map(h => ({
                    ...h,
                    businessId: id
                }))
            });
        }

        // Fetch updated business with hours
        const finalBusiness = await prisma.business.findUnique({
            where: { id },
            include: {
                hours: {
                    orderBy: { dayOfWeek: 'asc' }
                }
            }
        });

        res.json(finalBusiness);
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
                hours: true,
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
                services: {
                    include: {
                        assignedStaff: {
                            include: {
                                staff: {
                                    select: {
                                        id: true,
                                        name: true,
                                        image: true,
                                        title: true,
                                        rating: true
                                    }
                                }
                            }
                        }
                    }
                },
                staff: true,
                hours: {
                    orderBy: { dayOfWeek: 'asc' }
                },
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
