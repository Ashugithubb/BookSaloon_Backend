const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

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

        // Create user (unverified)
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

        // Send verification email
        try {
            await sendVerificationEmail(user.email, verificationToken);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Consider deleting the user or allowing resend
        }

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
    const { email, name } = req.body;

    if (!email || !name) {
        return res.status(400).json({ message: 'Email and name are required' });
    }

    try {
        // Check if user exists
        let user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Create new user (OAuth users don't need password)
            user = await prisma.user.create({
                data: {
                    email,
                    name,
                    password: '', // No password for OAuth users
                    role: 'CUSTOMER',
                    phone: null
                }
            });
        }

        // Return user data with token
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id),
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ message: 'Server error' });
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
