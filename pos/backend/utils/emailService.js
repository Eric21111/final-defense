const nodemailer = require('nodemailer');

// Helper to get sanitized Brevo key
const getBrevoApiKey = () => {
    const raw = process.env.BREVO_API_KEY || '';
    return raw.trim().replace(/^["']|["']$/g, '');
};

// Determine which email service to use
const usesBrevo = () => !!getBrevoApiKey();

// Send email via Brevo HTTP API (works on Render free tier - no SMTP needed)
const sendViaBrevoAPI = async (to, subject, text, html) => {
    const apiKey = getBrevoApiKey();
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: {
                name: process.env.STORE_NAME || 'POS System',
                email: process.env.EMAIL_FROM || process.env.EMAIL_USER
            },
            to: [{ email: to }],
            subject: subject,
            htmlContent: html || `<p>${text || ''}</p>`
        })
    });

    if (!response.ok) {
        const error = await response.json();
        const errorMsg = error.message || JSON.stringify(error);
        throw new Error(`Brevo API Error (${error.code || response.status}): ${errorMsg}`);
    }

    return await response.json();
};

// Create Gmail transporter (fallback for local dev or when Brevo key fails)
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
        console.log('[EmailService] Initialized Gmail SMTP transporter');
    }
    return gmailTransporter;
};

const canUseGmail = () => !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const sendEmail = async (to, subject, text, html) => {
    // 1. Try Brevo HTTP API if BREVO_API_KEY is configured
    if (usesBrevo()) {
        try {
            await sendViaBrevoAPI(to, subject, text, html);
            console.log('[EmailService] Email sent via Brevo API to:', to);
            return { success: true };
        } catch (brevoError) {
            console.error('[EmailService] Brevo API failed:', brevoError.message);
            if (!canUseGmail()) {
                return { success: false, error: brevoError };
            }
            console.log('[EmailService] Falling back to Gmail SMTP...');
        }
    }
    
    // 2. Primary/Fallback Gmail SMTP
    if (canUseGmail()) {
        try {
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
        } catch (gmailError) {
            console.error('[EmailService] Gmail SMTP failed:', gmailError.message);
            return { success: false, error: gmailError };
        }
    }

    return { 
        success: false, 
        error: new Error('No valid email service configured. Please check BREVO_API_KEY or EMAIL_USER/EMAIL_PASS environment variables.') 
    };
};

module.exports = { sendEmail, usesBrevo };
