const prisma = require('../lib/prisma');
const crypto = require('crypto');
const { sendStaffInvitation } = require('../utils/emailService');

// @desc    Create new staff member with invitation
// @route   POST /api/businesses/:businessId/staff
// @access  Private (Owner only)
const createStaff = async (req, res) => {
    const { businessId } = req.params;
    const { name, email, phone, title, yearsOfExperience, languages } = req.body;

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

        // Generate invitation token if email provided
        let invitationToken = null;
        let invitationExpires = null;
        if (email) {
            invitationToken = crypto.randomBytes(32).toString('hex');
            invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        }

        const staff = await prisma.staff.create({
            data: {
                name,
                email,
                phone,
                title,
                yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : 0,
                languages: languages || [],
                businessId,
                invitationToken,
                invitationExpires,
            },
        });

        // Send invitation email asynchronously (don't block response)
        if (email && invitationToken) {
            const invitationLink = `${process.env.FRONTEND_URL || 'https://booksalon.vercel.app'}/staff/accept-invitation/${invitationToken}`;

            // Send email in background without awaiting
            console.log(`📧 Attempting to send invitation email to: ${email}`);
            console.log(`🔗 Invitation link: ${invitationLink}`);

            sendStaffInvitation(email, {
                staffName: name,
                businessName: business.name,
                title: title || 'Staff Member',
                yearsOfExperience,
                languages,
                invitationLink
            }).then((info) => {
                console.log(`✅ Invitation email sent successfully to ${email}`);
                console.log('📝 Email response:', JSON.stringify(info));
            }).catch(emailError => {
                console.error('❌ Failed to send invitation email to:', email);
                console.error('❌ Error details:', emailError.message);
                console.error('❌ Stack trace:', emailError.stack);
            });
        }

        res.status(201).json({
            ...staff,
            invitationLink: invitationToken ? `/staff/accept-invitation/${invitationToken}` : null,
            emailQueued: email && invitationToken ? true : false,
            message: email && invitationToken
                ? 'Staff created successfully. Invitation email is being sent.'
                : 'Staff created successfully.'
        });
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
    const { name, email, phone, title, yearsOfExperience, languages } = req.body;

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
                title,
                yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : staff.yearsOfExperience,
                languages: languages || staff.languages,
            },
        });

        res.json(updatedStaff);
    } catch (error) {
        console.error('Error in updateStaff:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete staff member (cascades to user account)
// @route   DELETE /api/staff/:id
// @access  Private (Owner only)
const deleteStaff = async (req, res) => {
    const { id } = req.params;

    try {
        const staff = await prisma.staff.findUnique({
            where: { id },
            include: { business: true, user: true },
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        if (staff.business.ownerId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Delete staff (will cascade delete user account due to onDelete: Cascade)
        await prisma.staff.delete({
            where: { id },
        });

        res.json({ message: 'Staff member and associated account deleted successfully' });
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

// @desc    Accept staff invitation and create user account
// @route   POST /api/staff/accept-invitation/:token
// @access  Public
const acceptInvitation = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    try {
        const staff = await prisma.staff.findFirst({
            where: {
                invitationToken: token,
                invitationExpires: {
                    gte: new Date()
                }
            },
            include: { business: true }
        });

        if (!staff) {
            return res.status(400).json({ message: 'Invalid or expired invitation' });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: staff.email }
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user account
        const user = await prisma.user.create({
            data: {
                email: staff.email,
                password: hashedPassword,
                name: staff.name,
                phone: staff.phone,
                role: 'STAFF',
                isVerified: true
            }
        });

        // Link staff to user
        await prisma.staff.update({
            where: { id: staff.id },
            data: {
                userId: user.id,
                invitationToken: null,
                invitationExpires: null
            }
        });

        res.json({ message: 'Account created successfully. You can now login.' });
    } catch (error) {
        console.error('Error in acceptInvitation:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get logged-in staff's profile
// @route   GET /api/staff/me
// @access  Private (Staff only)
const getMyStaffProfile = async (req, res) => {
    try {
        const staff = await prisma.staff.findUnique({
            where: { userId: req.user.id },
            include: {
                business: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        address: true,
                        phone: true,
                        category: true,
                        images: true
                    }
                }
            }
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff profile not found' });
        }

        res.json(staff);
    } catch (error) {
        console.error('Error in getMyStaffProfile:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get staff's appointments (their own + unassigned)
// @route   GET /api/staff/appointments
// @access  Private (Staff only)
const getMyAppointments = async (req, res) => {
    try {
        const staff = await prisma.staff.findUnique({
            where: { userId: req.user.id }
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff profile not found' });
        }

        const appointments = await prisma.appointment.findMany({
            where: {
                businessId: staff.businessId,
                OR: [
                    { staffId: staff.id }, // Their appointments
                    { staffId: null }      // Unassigned appointments
                ]
            },
            include: {
                customer: true,
                service: true,
                staff: true,
                business: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { date: 'asc' }
        });

        res.json(appointments);
    } catch (error) {
        console.error('Error in getMyAppointments:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    createStaff,
    getStaff,
    updateStaff,
    deleteStaff,
    getStaffById,
    acceptInvitation,
    getMyStaffProfile,
    getMyAppointments,
};
