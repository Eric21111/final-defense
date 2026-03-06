const nodemailer = require('nodemailer');

// Determine which email service to use
const usesBrevo = () => !!process.env.BREVO_API_KEY;

// Send email via Brevo HTTP API (works on Render free tier - no SMTP needed)
const sendViaBrevoAPI = async (to, subject, text, html) => {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: {
                name: process.env.STORE_NAME || 'POS System',
                email: process.env.EMAIL_FROM
            },
            to: [{ email: to }],
            subject: subject,
            htmlContent: html || `<p>${text}</p>`
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
    }

    return await response.json();
};

// Create Gmail transporter (fallback for local dev)
let gmailTransporter = null;
const getGmailTransporter = () => {
    if (!gmailTransporter) {
        gmailTransporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log('[EmailService] Using Gmail for emails');
    }
    return gmailTransporter;
};

const sendEmail = async (to, subject, text, html) => {
    try {
        // Use Brevo HTTP API if available (works on Render free tier)
        if (usesBrevo()) {
            await sendViaBrevoAPI(to, subject, text, html);
            console.log('[EmailService] Email sent via Brevo API to:', to);
            return { success: true };
        }
        
        // Fallback to Gmail (for local development)
        const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
        const storeName = process.env.STORE_NAME || 'POS System';
        
        const mailOptions = {
            from: `"${storeName}" <${fromEmail}>`,
            to,
            subject,
            text,
            html
        };

        const info = await getGmailTransporter().sendMail(mailOptions);
        console.log('[EmailService] Email sent via Gmail to:', to);
        return { success: true, info };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
};

module.exports = { sendEmail, usesBrevo };
