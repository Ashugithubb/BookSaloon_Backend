const prisma = require('../lib/prisma');
const notificationService = require('../services/notificationService');
const { emitNotification } = require('../socket/socketHandler');

// Helper function to send notifications
const notifyUser = async (userId, type, title, message, data, io) => {
    try {
        console.log(`📨 [notifyUser] Attempting to notify user ${userId} with type: ${type}`);
        const notification = await notificationService.createNotification(
            userId, type, title, message, data
        );
        console.log(`✅ [notifyUser] Notification created:`, notification.id);
        emitNotification(io, userId, notification);
        console.log(`📨 Sent ${type} notification to user ${userId}`);
    } catch (error) {
        console.error(`❌ [notifyUser] Error sending notification to user ${userId}:`, error);
    }
};

// Helper function to get staff user
const getStaffUser = async (staffId) => {
    const staff = await prisma.staff.findUnique({
        where: { id: staffId },
        select: {
            id: true,
            name: true,
            userId: true,
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true
                }
            }
        }
    });
    console.log('🔍 getStaffUser result for staffId:', staffId, '→', staff);
    return staff;
};

// @desc    Create new appointment
// @route   POST /api/appointments
// @access  Private (Customer)
const createAppointment = async (req, res) => {
    const { businessId, serviceId, staffId, date } = req.body;

    if (!businessId || !serviceId || !date) {
        return res.status(400).json({ message: 'Business, service, and date are required' });
    }

    try {
        const appointment = await prisma.appointment.create({
            data: {
                customerId: req.user.id,
                businessId,
                serviceId,
                staffId: staffId || null,
                date: new Date(date),
                status: 'PENDING',
            },
            include: {
                business: true,
                service: true,
                staff: true,
                customer: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
        });

        const io = req.app.get('io');

        // 1. Notify Business Owner (always)
        await notifyUser(
            appointment.business.ownerId,
            'APPOINTMENT_BOOKED',
            'New Appointment',
            `${appointment.customer.name} booked ${appointment.service.name}`,
            { appointmentId: appointment.id },
            io
        );

        // 2. If staff assigned, notify Staff
        if (appointment.staffId) {
            console.log('📋 Staff assigned to appointment:', appointment.staffId);
            const staff = await getStaffUser(appointment.staffId);
            console.log('👤 Staff user data:', staff);
            if (staff) {
                console.log('🔔 Notifying staff user:', staff.userId);
                await notifyUser(
                    staff.userId,
                    'APPOINTMENT_ASSIGNED',
                    'New Appointment Assigned',
                    `You have been assigned to ${appointment.service.name} for ${appointment.customer.name}`,
                    { appointmentId: appointment.id },
                    io
                );
            } else {
                console.error('❌ Staff user not found for staffId:', appointment.staffId);
            }
        }

        res.status(201).json(appointment);
    } catch (error) {
        console.error('Error in createAppointment:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get customer's appointments
// @route   GET /api/appointments/my
// @access  Private (Customer)
const getMyAppointments = async (req, res) => {
    try {
        const appointments = await prisma.appointment.findMany({
            where: { customerId: req.user.id },
            include: {
                business: true,
                service: true,
                staff: true,
            },
            orderBy: { date: 'desc' },
        });

        res.json(appointments);
    } catch (error) {
        console.error('Error in getMyAppointments:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const { sendBookingConfirmation, sendCompletionOTP } = require('../utils/emailService');

// @desc    Get business appointments
// @route   GET /api/businesses/:businessId/appointments
// @access  Private (Owner)
const getBusinessAppointments = async (req, res) => {
    const { businessId } = req.params;

    try {
        // Verify ownership
        const business = await prisma.business.findUnique({
            where: { id: businessId },
        });

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        // Check authorization
        const isOwner = business.ownerId === req.user.id;

        let isStaff = false;
        if (req.user.role === 'STAFF') {
            const staffProfile = await prisma.staff.findUnique({
                where: { userId: req.user.id }
            });
            // Check if the staff member is associated with this business
            isStaff = staffProfile && staffProfile.businessId === businessId;
        }

        if (!isOwner && !isStaff) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const appointments = await prisma.appointment.findMany({
            where: { businessId },
            include: {
                customer: {
                    select: { name: true, email: true, phone: true },
                },
                service: true,
                staff: true,
            },
            orderBy: { date: 'asc' },
        });

        res.json(appointments);
    } catch (error) {
        console.error('Error in getBusinessAppointments:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update appointment status
// @route   PUT /api/appointments/:id/status
// @access  Private (Owner, Staff, or Customer)
const updateAppointmentStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: { business: true, staff: true },
        });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check authorization
        const isOwner = appointment.business.ownerId === req.user.id;
        const isCustomer = appointment.customerId === req.user.id;

        // Check if user is staff assigned to this appointment
        let isStaff = false;
        if (req.user.role === 'STAFF') {
            const staffProfile = await prisma.staff.findUnique({
                where: { userId: req.user.id }
            });
            isStaff = staffProfile && appointment.staffId === staffProfile.id;
        }

        if (!isOwner && !isCustomer && !isStaff) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Customers can only cancel
        if (isCustomer && status !== 'CANCELLED') {
            return res.status(403).json({ message: 'Customers can only cancel appointments' });
        }

        // Staff cannot cancel appointments (only owner can)
        if (isStaff && status === 'CANCELLED') {
            return res.status(403).json({ message: 'Staff cannot cancel appointments. Please contact the owner.' });
        }

        // Staff can only confirm their own appointments
        if (isStaff && status !== 'CONFIRMED') {
            return res.status(403).json({ message: 'Staff can only confirm appointments' });
        }

        const updatedAppointment = await prisma.appointment.update({
            where: { id },
            data: { status },
            include: {
                business: true,
                service: true,
                staff: true,
                customer: {
                    select: { name: true, email: true },
                },
            },
        });

        const io = req.app.get('io');

        // CONFIRMED - Notify Customer + Owner (if staff confirmed)
        if (status === 'CONFIRMED') {
            console.log('✅ Confirming appointment, notifying customer:', updatedAppointment.customerId);
            await notifyUser(
                updatedAppointment.customerId,
                'APPOINTMENT_CONFIRMED',
                'Appointment Confirmed',
                `Your appointment for ${updatedAppointment.service.name} has been confirmed`,
                { appointmentId: updatedAppointment.id },
                io
            );

            // If staff confirmed, notify owner
            if (isStaff) {
                console.log('👤 Staff confirmed, notifying owner:', updatedAppointment.business.ownerId);
                // Get staff profile to get the name
                const staffProfile = await prisma.staff.findUnique({
                    where: { userId: req.user.id },
                    select: { name: true }
                });
                const staffName = staffProfile?.name || 'Staff member';
                await notifyUser(
                    updatedAppointment.business.ownerId,
                    'APPOINTMENT_CONFIRMED',
                    'Appointment Confirmed',
                    `${staffName} confirmed appointment for ${updatedAppointment.service.name}`,
                    { appointmentId: updatedAppointment.id },
                    io
                );
            }
        }

        // CANCELLED - Notify affected parties
        if (status === 'CANCELLED') {
            if (isCustomer) {
                // Customer cancelled -> Notify Owner
                await notifyUser(
                    updatedAppointment.business.ownerId,
                    'APPOINTMENT_CANCELLED',
                    'Appointment Cancelled',
                    `${updatedAppointment.customer.name} cancelled their appointment for ${updatedAppointment.service.name}`,
                    { appointmentId: updatedAppointment.id },
                    io
                );

                // If staff assigned, notify them too
                if (updatedAppointment.staffId) {
                    const staff = await getStaffUser(updatedAppointment.staffId);
                    if (staff) {
                        await notifyUser(
                            staff.userId,
                            'APPOINTMENT_CANCELLED',
                            'Appointment Cancelled',
                            `${updatedAppointment.customer.name} cancelled their appointment`,
                            { appointmentId: updatedAppointment.id },
                            io
                        );
                    }
                }
            } else {
                // Owner/Staff cancelled -> Notify Customer
                await notifyUser(
                    updatedAppointment.customerId,
                    'APPOINTMENT_CANCELLED',
                    'Appointment Cancelled',
                    `Your appointment for ${updatedAppointment.service.name} has been cancelled`,
                    { appointmentId: updatedAppointment.id },
                    io
                );

                // If staff cancelled, notify owner
                if (isStaff) {
                    // Get staff profile to get the name
                    const staffProfile = await prisma.staff.findUnique({
                        where: { userId: req.user.id },
                        select: { name: true }
                    });
                    const staffName = staffProfile?.name || 'Staff member';
                    await notifyUser(
                        updatedAppointment.business.ownerId,
                        'APPOINTMENT_CANCELLED',
                        'Appointment Cancelled',
                        `${staffName} cancelled appointment for ${updatedAppointment.service.name}`,
                        { appointmentId: updatedAppointment.id },
                        io
                    );
                }
            }
        }

        // COMPLETED - Notify Customer + Owner (if staff completed)
        if (status === 'COMPLETED') {
            await notifyUser(
                updatedAppointment.customerId,
                'APPOINTMENT_COMPLETED',
                'Service Completed',
                `Your appointment for ${updatedAppointment.service.name} has been completed`,
                { appointmentId: updatedAppointment.id },
                io
            );

            // If staff completed, notify owner
            if (isStaff) {
                // Get staff profile to get the name
                const staffProfile = await prisma.staff.findUnique({
                    where: { userId: req.user.id },
                    select: { name: true }
                });
                const staffName = staffProfile?.name || 'Staff member';
                await notifyUser(
                    updatedAppointment.business.ownerId,
                    'APPOINTMENT_COMPLETED',
                    'Appointment Completed',
                    `${staffName} completed appointment for ${updatedAppointment.service.name}`,
                    { appointmentId: updatedAppointment.id },
                    io
                );
            }
        }

        // NO_SHOW - Notify Customer + Owner (if staff marked)
        if (status === 'NO_SHOW') {
            await notifyUser(
                updatedAppointment.customerId,
                'APPOINTMENT_NO_SHOW',
                'Marked as No-Show',
                `Your appointment for ${updatedAppointment.service.name} was marked as no-show`,
                { appointmentId: updatedAppointment.id },
                io
            );

            // If staff marked, notify owner
            if (isStaff) {
                // Get staff profile to get the name
                const staffProfile = await prisma.staff.findUnique({
                    where: { userId: req.user.id },
                    select: { name: true }
                });
                const staffName = staffProfile?.name || 'Staff member';
                await notifyUser(
                    updatedAppointment.business.ownerId,
                    'APPOINTMENT_NO_SHOW',
                    'Appointment No-Show',
                    `${staffName} marked appointment as no-show`,
                    { appointmentId: updatedAppointment.id },
                    io
                );
            }
        }

        res.json(updatedAppointment);
    } catch (error) {
        console.error('Error in updateAppointmentStatus:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Initiate service completion (Generate OTP)
// @route   POST /api/appointments/:id/initiate-completion
// @access  Private (Owner)
const initiateCompletion = async (req, res) => {
    const { id } = req.params;

    try {
        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: {
                business: true,
                customer: true,
                service: true,
            },
        });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check authorization
        const isOwner = appointment.business.ownerId === req.user.id;

        let isStaff = false;
        if (req.user.role === 'STAFF') {
            const staffProfile = await prisma.staff.findUnique({
                where: { userId: req.user.id }
            });
            isStaff = staffProfile && appointment.staffId === staffProfile.id;
        }

        if (!isOwner && !isStaff) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to appointment
        await prisma.appointment.update({
            where: { id },
            data: {
                completionOtp: otp,
                otpExpires: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes expiry
            },
        });

        // Send OTP email
        const bookingDetails = {
            customerName: appointment.customer.name,
            serviceName: appointment.service.name,
            businessName: appointment.business.name,
        };

        await sendCompletionOTP(appointment.customer.email, otp, bookingDetails);

        res.json({ message: 'OTP sent to customer' });
    } catch (error) {
        console.error('Error initiating completion:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Verify completion OTP
// @route   POST /api/appointments/:id/verify-completion
// @access  Private (Owner)
const verifyCompletion = async (req, res) => {
    const { id } = req.params;
    const { otp } = req.body;

    try {
        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: { business: true },
        });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check authorization
        const isOwner = appointment.business.ownerId === req.user.id;

        let isStaff = false;
        if (req.user.role === 'STAFF') {
            const staffProfile = await prisma.staff.findUnique({
                where: { userId: req.user.id }
            });
            isStaff = staffProfile && appointment.staffId === staffProfile.id;
        }

        if (!isOwner && !isStaff) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (appointment.completionOtp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Update status to COMPLETED and clear OTP
        const updatedAppointment = await prisma.appointment.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                completionOtp: null,
                otpExpires: null
            },
        });

        // Notify Customer of completion
        try {
            const notification = await notificationService.createNotification(
                appointment.customerId,
                'APPOINTMENT_COMPLETED',
                'Service Completed',
                `Your appointment for ${appointment.service?.name || 'service'} has been completed`,
                { appointmentId: appointment.id }
            );
            const io = req.app.get('io');
            emitNotification(io, appointment.customerId, notification);
        } catch (error) {
            console.error('Error sending notification:', error);
        }

        res.json(updatedAppointment);
    } catch (error) {
        console.error('Error verifying completion:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get available time slots
// @route   GET /api/appointments/available-slots
// @access  Public
const getAvailableSlots = async (req, res) => {
    const { businessId, serviceId, date } = req.query;

    if (!businessId || !serviceId || !date) {
        return res.status(400).json({ message: 'Business, service, and date are required' });
    }

    try {
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
        });

        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }

        const serviceDuration = service.duration || 30;

        // Parse date and set boundaries
        const selectedDate = new Date(date);
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Prevent booking in the past
        const now = new Date();
        if (endOfDay < now) {
            return res.json([]);
        }

        // Fetch business hours for the selected day
        const dayOfWeek = selectedDate.getDay(); // 0-6
        const businessHour = await prisma.businessHour.findFirst({
            where: {
                businessId,
                dayOfWeek
            }
        });

        // If no hours set or closed, return empty slots
        if (!businessHour || !businessHour.isOpen) {
            return res.json([]);
        }

        // Parse start and end times from "HH:mm" string
        const [startHour, startMinute] = businessHour.startTime.split(':').map(Number);
        const [endHour, endMinute] = businessHour.endTime.split(':').map(Number);

        const businessStartTime = new Date(selectedDate);
        businessStartTime.setHours(startHour, startMinute, 0, 0);

        const businessEndTime = new Date(selectedDate);
        businessEndTime.setHours(endHour, endMinute, 0, 0);

        // Get existing appointments
        const appointments = await prisma.appointment.findMany({
            where: {
                businessId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: {
                    in: ['PENDING', 'CONFIRMED'],
                },
            },
            include: {
                service: true,
            },
        });

        const slots = [];
        const slotInterval = 30; // minutes

        // Generate slots
        let currentSlot = new Date(businessStartTime);

        while (currentSlot < businessEndTime) {
            // Skip past times if booking for today
            if (currentSlot < now) {
                currentSlot = new Date(currentSlot.getTime() + slotInterval * 60000);
                continue;
            }

            const slotEnd = new Date(currentSlot.getTime() + serviceDuration * 60000);

            // Check if slot ends after business hours
            if (slotEnd > businessEndTime) {
                break;
            }

            // Check for overlaps
            const isBooked = appointments.some((apt) => {
                const aptStart = new Date(apt.date);
                const aptDuration = apt.service?.duration || 30;
                const aptEnd = new Date(aptStart.getTime() + aptDuration * 60000);

                // Overlap condition: (StartA < EndB) and (EndA > StartB)
                return currentSlot < aptEnd && slotEnd > aptStart;
            });

            slots.push({
                time: currentSlot.toISOString(),
                available: !isBooked,
            });

            currentSlot = new Date(currentSlot.getTime() + slotInterval * 60000);
        }

        res.json(slots);
    } catch (error) {
        console.error('Error in getAvailableSlots:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Mark appointment as completed
// @route   POST /api/appointments/:id/complete
// @access  Private (Business Owner)
const markAsCompleted = async (req, res) => {
    const { id } = req.params;

    try {
        // Verify appointment exists and belongs to user's business
        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: { business: true },
        });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check authorization
        const isOwner = appointment.business.ownerId === req.user.id;

        let isStaff = false;
        if (req.user.role === 'STAFF') {
            const staffProfile = await prisma.staff.findUnique({
                where: { userId: req.user.id }
            });
            isStaff = staffProfile && appointment.staffId === staffProfile.id;
        }

        if (!isOwner && !isStaff) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updated = await prisma.appointment.update({
            where: { id },
            data: { status: 'COMPLETED' },
            include: {
                customer: true,
                service: true,
                staff: true,
                business: true
            },
        });

        const io = req.app.get('io');

        // Notify Customer
        await notifyUser(
            updated.customerId,
            'APPOINTMENT_COMPLETED',
            'Service Completed',
            `Your appointment for ${updated.service.name} has been completed`,
            { appointmentId: updated.id },
            io
        );

        // If staff completed, notify owner
        if (isStaff) {
            // Get staff profile to get the name
            const staffProfile = await prisma.staff.findUnique({
                where: { userId: req.user.id },
                select: { name: true }
            });
            const staffName = staffProfile?.name || 'Staff member';
            await notifyUser(
                updated.business.ownerId,
                'APPOINTMENT_COMPLETED',
                'Appointment Completed',
                `${staffName} completed appointment for ${updated.service.name}`,
                { appointmentId: updated.id },
                io
            );
        }

        res.json(updated);
    } catch (error) {
        console.error('Error in markAsCompleted:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Mark appointment as no-show
// @route   POST /api/appointments/:id/no-show
// @access  Private (Business Owner)
const markAsNoShow = async (req, res) => {
    const { id } = req.params;

    try {
        // Verify appointment exists and belongs to user's business
        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: { business: true },
        });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check authorization
        const isOwner = appointment.business.ownerId === req.user.id;

        let isStaff = false;
        if (req.user.role === 'STAFF') {
            const staffProfile = await prisma.staff.findUnique({
                where: { userId: req.user.id }
            });
            isStaff = staffProfile && appointment.staffId === staffProfile.id;
        }

        if (!isOwner && !isStaff) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updated = await prisma.appointment.update({
            where: { id },
            data: { status: 'NO_SHOW' },
            include: {
                customer: true,
                service: true,
                staff: true,
            },
        });

        res.json(updated);
    } catch (error) {
        console.error('Error in markAsNoShow:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Auto-cleanup expired pending appointments
// @route   POST /api/appointments/cleanup-expired
// @access  Private (Business Owner)
const cleanupExpiredAppointments = async (req, res) => {
    try {
        const now = new Date();

        // Auto-cancel PENDING appointments that are past their date
        const result = await prisma.appointment.updateMany({
            where: {
                status: 'PENDING',
                date: {
                    lt: now,
                },
                business: {
                    ownerId: req.user.id,
                },
            },
            data: {
                status: 'CANCELLED',
            },
        });

        res.json({
            message: `Cleaned up ${result.count} expired pending appointments`,
            count: result.count,
        });
    } catch (error) {
        console.error('Error in cleanupExpiredAppointments:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Claim unassigned appointment (Staff only)
// @route   POST /api/appointments/:id/claim
// @access  Private (Staff only)
const claimAppointment = async (req, res) => {
    const { id } = req.params;

    try {
        // Get staff profile
        const staff = await prisma.staff.findUnique({
            where: { userId: req.user.id }
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff profile not found' });
        }

        // Get appointment
        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: { business: true }
        });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Verify appointment is from same business
        if (appointment.businessId !== staff.businessId) {
            return res.status(403).json({ message: 'Not authorized - different business' });
        }

        // Verify appointment is unassigned
        if (appointment.staffId !== null) {
            return res.status(400).json({ message: 'Appointment already assigned' });
        }

        // Claim appointment
        const updated = await prisma.appointment.update({
            where: { id },
            data: { staffId: staff.id },
            include: {
                customer: true,
                service: true,
                staff: true,
                business: true
            }
        });

        const io = req.app.get('io');

        // Notify Owner that staff claimed appointment
        await notifyUser(
            updated.business.ownerId,
            'STAFF_CLAIMED',
            'Appointment Claimed',
            `${staff.name} claimed the appointment for ${updated.service.name}`,
            { appointmentId: updated.id },
            io
        );

        // Notify Customer that staff has been assigned
        await notifyUser(
            updated.customerId,
            'APPOINTMENT_ASSIGNED',
            'Staff Assigned',
            `${staff.name} has been assigned to your appointment`,
            { appointmentId: updated.id },
            io
        );

        res.json(updated);
    } catch (error) {
        console.error('Error in claimAppointment:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    createAppointment,
    getMyAppointments,
    getBusinessAppointments,
    updateAppointmentStatus,
    getAvailableSlots,
    initiateCompletion,
    verifyCompletion,
    markAsCompleted,
    markAsNoShow,
    cleanupExpiredAppointments,
    claimAppointment,
};
