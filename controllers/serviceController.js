const prisma = require('../lib/prisma');

// @desc    Create new service
// @route   POST /api/businesses/:businessId/services
// @access  Private (Owner only)
const createService = async (req, res) => {
    const { businessId } = req.params;
    const { name, description, duration, price, discount, staffIds } = req.body;

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

        // Validate staff IDs if provided
        if (staffIds && staffIds.length > 0) {
            const staffCount = await prisma.staff.count({
                where: {
                    id: { in: staffIds },
                    businessId: businessId
                }
            });

            if (staffCount !== staffIds.length) {
                return res.status(400).json({ message: 'One or more staff IDs are invalid for this business' });
            }
        }

        const service = await prisma.service.create({
            data: {
                name,
                description,
                duration: parseInt(duration),
                price: parseFloat(price),
                discount: discount ? parseFloat(discount) : 0,
                businessId,
                assignedStaff: staffIds && staffIds.length > 0 ? {
                    create: staffIds.map(staffId => ({ staffId }))
                } : undefined
            },
            include: {
                assignedStaff: {
                    include: {
                        staff: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                                title: true
                            }
                        }
                    }
                }
            }
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
    const { name, description, duration, price, discount, staffIds } = req.body;

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

        // Validate staff IDs if provided
        if (staffIds && staffIds.length > 0) {
            const staffCount = await prisma.staff.count({
                where: {
                    id: { in: staffIds },
                    businessId: service.businessId
                }
            });

            if (staffCount !== staffIds.length) {
                return res.status(400).json({ message: 'One or more staff IDs are invalid for this business' });
            }
        }

        // If staffIds is provided (even if empty array), update assignments
        if (staffIds !== undefined) {
            console.log('🔧 updateService - staffIds provided:', staffIds);
            console.log('🔧 Deleting existing assignments for serviceId:', id);

            // Delete existing assignments
            const deleteResult = await prisma.serviceStaff.deleteMany({
                where: { serviceId: id }
            });
            console.log('✅ Deleted', deleteResult.count, 'existing assignments');

            // Create new assignments if staff IDs provided
            if (staffIds.length > 0) {
                console.log('🔧 Creating new assignments...');
                const createResult = await prisma.serviceStaff.createMany({
                    data: staffIds.map(staffId => ({
                        serviceId: id,
                        staffId
                    }))
                });
                console.log('✅ Created', createResult.count, 'new assignments');
            } else {
                console.log('⚠️ No staff IDs to assign (clearing all assignments)');
            }
        } else {
            console.log('⚠️ staffIds not provided in request - skipping assignment update');
        }

        const updatedService = await prisma.service.update({
            where: { id },
            data: {
                name,
                description,
                duration: duration ? parseInt(duration) : undefined,
                price: price ? parseFloat(price) : undefined,
                discount: discount !== undefined ? parseFloat(discount) : undefined,
            },
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
        });

        console.log('✅ Service updated successfully!');
        console.log('✅ Assigned staff in response:', updatedService.assignedStaff);

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
