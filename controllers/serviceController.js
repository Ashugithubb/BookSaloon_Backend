const prisma = require('../lib/prisma');

// @desc    Create new service
// @route   POST /api/businesses/:businessId/services
// @access  Private (Owner only)
const createService = async (req, res) => {
    const { businessId } = req.params;
    const { name, description, duration, price } = req.body;

    if (!name || !duration || !price) {
        return res.status(400).json({ message: 'Name, duration, and price are required' });
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

        const service = await prisma.service.create({
            data: {
                name,
                description,
                duration: parseInt(duration),
                price: parseFloat(price),
                businessId,
            },
        });

        res.status(201).json(service);
    } catch (error) {
        console.error('Error in createService:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all services for a business
// @route   GET /api/businesses/:businessId/services
// @access  Public
const getServices = async (req, res) => {
    const { businessId } = req.params;

    try {
        const services = await prisma.service.findMany({
            where: { businessId },
        });

        res.json(services);
    } catch (error) {
        console.error('Error in getServices:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private (Owner only)
const updateService = async (req, res) => {
    const { id } = req.params;
    const { name, description, duration, price } = req.body;

    try {
        const service = await prisma.service.findUnique({
            where: { id },
            include: { business: true },
        });

        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }

        if (service.business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updatedService = await prisma.service.update({
            where: { id },
            data: {
                name,
                description,
                duration: duration ? parseInt(duration) : undefined,
                price: price ? parseFloat(price) : undefined,
            },
        });

        res.json(updatedService);
    } catch (error) {
        console.error('Error in updateService:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private (Owner only)
const deleteService = async (req, res) => {
    const { id } = req.params;

    try {
        const service = await prisma.service.findUnique({
            where: { id },
            include: { business: true },
        });

        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }

        if (service.business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await prisma.service.delete({
            where: { id },
        });

        res.json({ message: 'Service deleted successfully' });
    } catch (error) {
        console.error('Error in deleteService:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    createService,
    getServices,
    updateService,
    deleteService,
};
