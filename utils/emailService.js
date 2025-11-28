const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

const sendEmail = async (to, subject, html) => {
    try {
        const mailOptions = {
            from: process.env.MAIL_USER,
            to,
            subject,
            html,
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully to:', to);
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
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

module.exports = {
    sendBookingConfirmation,
    sendCompletionOTP,
    sendVerificationEmail,
};
