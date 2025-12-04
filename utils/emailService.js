const nodemailer = require('nodemailer');

// Validate email configuration
if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.error('⚠️  EMAIL CONFIGURATION MISSING!');
    console.error('Please set MAIL_USER and MAIL_PASS in your .env file');
    console.error('Example:');
    console.error('  MAIL_USER=your-email@gmail.com');
    console.error('  MAIL_PASS=your-app-password');
}

const transporter = nodemailer.createTransport({
    service: 'gmail', // Revert to service: 'gmail' as it handles host/port automatically
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
    // Force IPv4 to avoid IPv6 connection issues on Render
    family: 4,
    // Timeout settings
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
});

const sendEmail = async (to, subject, html) => {
    // Check if email is configured
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
        throw new Error('Email service not configured. Please set MAIL_USER and MAIL_PASS in .env file');
    }

    try {
        const mailOptions = {
            from: process.env.MAIL_USER,
            to,
            subject,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully to:', to);
        console.log('Message ID:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Error sending email:', error.message);
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

const sendBookingConfirmation = async (customerEmail, bookingDetails) => {
    const subject = `Booking Confirmed: ${bookingDetails.serviceName} at ${bookingDetails.businessName}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Booking Confirmed! 🎉</h2>
            <p>Hi ${bookingDetails.customerName},</p>
            <p>Your appointment has been confirmed.</p>
            
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Service:</strong> ${bookingDetails.serviceName}</p>
                <p><strong>Business:</strong> ${bookingDetails.businessName}</p>
                <p><strong>Date:</strong> ${bookingDetails.date}</p>
                <p><strong>Time:</strong> ${bookingDetails.time}</p>
                ${bookingDetails.staffName ? `<p><strong>Staff:</strong> ${bookingDetails.staffName}</p>` : ''}
            </div>
            
            <p>We look forward to seeing you!</p>
        </div>
    `;
    await sendEmail(customerEmail, subject, html);
};

const sendCompletionOTP = async (customerEmail, otp, bookingDetails) => {
    const subject = `Service Completion OTP: ${otp}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Verify Service Completion</h2>
            <p>Hi ${bookingDetails.customerName},</p>
            <p>Please provide the following OTP to the salon owner to confirm your service completion:</p>
            
            <div style="background-color: #EEF2FF; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <h1 style="color: #4F46E5; letter-spacing: 5px; margin: 0;">${otp}</h1>
            </div>
            
            <p><strong>Service:</strong> ${bookingDetails.serviceName}</p>
            <p><strong>Business:</strong> ${bookingDetails.businessName}</p>
            
            <p>If you did not receive this service, please ignore this email.</p>
        </div>
    `;
    await sendEmail(customerEmail, subject, html);
};

const sendVerificationEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.MAIL_USER,
        to: email,
        subject: 'Verify Your Email - BookSalon',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">Verify Your Email Address</h2>
                <p>Thank you for signing up with BookSalon! Please use the OTP below to verify your email address.</p>
                <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #1F2937; margin: 0; letter-spacing: 5px;">${otp}</h1>
                </div>
                <p>This OTP is valid for 10 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};

const sendStaffInvitation = async (staffEmail, invitationDetails) => {
    const subject = `You're Invited to Join ${invitationDetails.businessName}!`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #4F46E5 0%, #EC4899 100%); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                    <span style="font-size: 40px;">✨</span>
                </div>
                <h1 style="color: #1F2937; margin: 0;">Welcome to the Team!</h1>
            </div>
            
            <p style="color: #4B5563; font-size: 16px; line-height: 1.6;">Hi ${invitationDetails.staffName},</p>
            
            <p style="color: #4B5563; font-size: 16px; line-height: 1.6;">
                You've been invited to join <strong>${invitationDetails.businessName}</strong> as a staff member!
            </p>
            
            <div style="background: linear-gradient(135deg, #EEF2FF 0%, #FCE7F3 100%); padding: 25px; border-radius: 12px; margin: 25px 0;">
                <p style="color: #1F2937; margin: 0 0 15px 0;"><strong>Your Role:</strong> ${invitationDetails.title || 'Staff Member'}</p>
                ${invitationDetails.yearsOfExperience ? `<p style="color: #1F2937; margin: 0 0 15px 0;"><strong>Experience:</strong> ${invitationDetails.yearsOfExperience} years</p>` : ''}
                ${invitationDetails.languages && invitationDetails.languages.length > 0 ? `<p style="color: #1F2937; margin: 0;"><strong>Languages:</strong> ${invitationDetails.languages.join(', ')}</p>` : ''}
            </div>
            
            <p style="color: #4B5563; font-size: 16px; line-height: 1.6;">
                Click the button below to create your account and get started:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationDetails.invitationLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #EC4899 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    Accept Invitation
                </a>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:<br>
                <a href="${invitationDetails.invitationLink}" style="color: #4F46E5; word-break: break-all;">${invitationDetails.invitationLink}</a>
            </p>
            
            <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #92400E; margin: 0; font-size: 14px;">
                    ⏰ <strong>Important:</strong> This invitation expires in 7 days. Please accept it soon!
                </p>
            </div>
            
            <p style="color: #4B5563; font-size: 16px; line-height: 1.6;">
                We're excited to have you on board! 🎉
            </p>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
            
            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                If you didn't expect this invitation, you can safely ignore this email.
            </p>
        </div>
    `;
    await sendEmail(staffEmail, subject, html);
};

module.exports = {
    sendBookingConfirmation,
    sendCompletionOTP,
    sendVerificationEmail,
    sendStaffInvitation,
};
