const prisma = require('../lib/prisma');

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
            },
        });

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

        if (business.ownerId !== req.user.id) {
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
// @access  Private (Owner or Customer)
const updateAppointmentStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: { business: true },
        });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check authorization (owner can update any status, customer can only cancel)
        const isOwner = appointment.business.ownerId === req.user.id;
        const isCustomer = appointment.customerId === req.user.id;

        if (!isOwner && !isCustomer) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (isCustomer && status !== 'CANCELLED') {
            return res.status(403).json({ message: 'Customers can only cancel appointments' });
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

        if (appointment.business.ownerId !== req.user.id) {
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
        });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
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

        // Get existing appointments with their service details to know duration
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
                service: true, // Include service to get duration
            },
        });

        const slots = [];
        const businessStart = 9; // 9 AM
        const businessEnd = 18; // 6 PM

        // Generate slots every 30 minutes
        for (let hour = businessStart; hour < businessEnd; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const slotStart = new Date(selectedDate);
                slotStart.setHours(hour, minute, 0, 0);

                // Skip past times if booking for today
                if (slotStart < now) {
                    continue;
                }

                const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60000);

                // Check if slot ends after business hours
                const businessEndTime = new Date(selectedDate);
                businessEndTime.setHours(businessEnd, 0, 0, 0);

                if (slotEnd > businessEndTime) {
                    continue;
                }

                // Check for overlaps
                const isBooked = appointments.some((apt) => {
                    const aptStart = new Date(apt.date);
                    const aptDuration = apt.service?.duration || 30;
                    const aptEnd = new Date(aptStart.getTime() + aptDuration * 60000);

                    // Overlap condition: (StartA < EndB) and (EndA > StartB)
                    return slotStart < aptEnd && slotEnd > aptStart;
                });

                slots.push({
                    time: slotStart.toISOString(),
                    available: !isBooked,
                });
            }
        }

        res.json(slots);
    } catch (error) {
        console.error('Error in getAvailableSlots:', error);
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
};
