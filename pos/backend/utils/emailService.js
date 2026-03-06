const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

// Determine which email service to use
const usesSendGrid = () => !!process.env.SENDGRID_API_KEY;

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
    const apiKey = process.env.SENDGRID_API_KEY.trim();
    sgMail.setApiKey(apiKey);
    // Log first 10 chars for debugging (safe to show)
    console.log('[EmailService] Using SendGrid for emails. Key starts with:', apiKey.substring(0, 10) + '...');
} else {
    console.log('[EmailService] Using Nodemailer/Gmail for emails');
}

// Create transporter once and reuse across all emails (avoids opening a new SMTP connection per email)
let transporter = null;
const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    return transporter;
};

const sendEmail = async (to, subject, text, html) => {
    try {
        // Use SendGrid if available (works on Render free tier)
        if (usesSendGrid()) {
            const msg = {
                to,
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                subject,
                text,
                html
            };
            
            await sgMail.send(msg);
            console.log('[EmailService] Email sent via SendGrid to:', to);
            return { success: true };
        }
        
        // Fallback to Nodemailer/Gmail (for local development)
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
            html
        };

        const info = await getTransporter().sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return { success: true, info };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
};

module.exports = { sendEmail };
