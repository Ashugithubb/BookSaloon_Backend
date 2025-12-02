const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { sendVerificationEmail } = require('../utils/emailService');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please add all fields' });
    }

    try {
        // Check if user exists
        const userExists = await prisma.user.findUnique({
            where: { email },
        });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate OTP
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // IMPORTANT: Send verification email FIRST (before creating user)
        // This prevents orphaned unverified accounts if email fails
        try {
            await sendVerificationEmail(email, verificationToken);
            console.log('Verification email sent successfully to:', email);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Return error to user - don't create account if email fails
            return res.status(500).json({
                message: 'Failed to send verification email. Please check your email address or contact support.',
                error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
            });
        }

        // Only create user if email was sent successfully
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || 'CUSTOMER',
                phone,
                isVerified: false,
                verificationToken,
                tokenExpires,
            },
        });

        console.log('User created successfully:', user.email);

        res.status(201).json({
            message: 'Registration successful. Please check your email for verification OTP.',
            userId: user.id,
            email: user.email,
            requiresVerification: true
        });

    } catch (error) {
        console.error('Error in registerUser:', error.message, error.code, error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Verify email with OTP
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        if (user.verificationToken !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (user.tokenExpires && user.tokenExpires < new Date()) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        // Mark as verified and clear token
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null,
                tokenExpires: null,
            },
        });

        res.json({
            _id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            token: generateToken(updatedUser.id),
        });

    } catch (error) {
        console.error('Error in verifyEmail:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user.id),
            });
        } else {
            res.status(400).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });
        res.status(200).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Google OAuth login/signup
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
    try {
        const { email, name, googleId, role } = req.body;

        console.log('🔍 Backend - Received request body:', req.body);
        console.log('🔍 Backend - Extracted role:', role, 'Type:', typeof role);

        let user = await prisma.user.findUnique({
            where: { email }
        });

        console.log('Google Auth - User found:', user ? 'Yes' : 'No', email);

        if (!user) {
            // If user doesn't exist and no role is provided, ask for it
            if (!role) {
                console.log('Google Auth - New user, no role provided. Requesting role selection.');
                return res.status(200).json({
                    requiresRoleSelection: true,
                    email,
                    name,
                    googleId
                });
            }

            console.log('🔍 Backend - Creating new user with role:', role);
            // Create new user with provided role
            user = await prisma.user.create({
                data: {
                    email,
                    name,
                    password: '', // No password for OAuth users
                    role: role, // Use the selected role
                    phone: null
                }
            });
            console.log('🔍 Backend - User created:', user);
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ message: 'Google authentication failed' });
    }
};

// @desc    Update user phone number
// @route   PUT /api/auth/update-phone
// @access  Private
const updatePhone = async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ message: 'Phone number is required' });
    }

    try {
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: { phone },
        });

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
        });
    } catch (error) {
        console.error('Error updating phone:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
    googleAuth,
    updatePhone,
    verifyEmail,
};
