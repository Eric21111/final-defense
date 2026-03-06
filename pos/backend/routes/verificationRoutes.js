const express = require('express');
const router = express.Router();
const VerificationCode = require('../models/VerificationCode');
const { sendEmail } = require('../utils/emailService');

// Generate a random 6-digit code
const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// @route   POST /api/verification/send-code
// @desc    Send verification code to email
// @access  Public
router.post('/send-code', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    try {
        // Delete any existing codes for this email
        await VerificationCode.deleteMany({ email });

        const code = generateCode();

        // Save code to database
        await VerificationCode.create({
            email,
            code
        });

        // Send email
        const subject = 'Your Verification Code';
        const text = `Your verification code is: ${code}. It will expire in 10 minutes.`;
        const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #8B7355;">Verification Code</h2>
        <p>Your verification code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px; color: #2D2D2D;">${code}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      </div>
    `;

        const emailResult = await sendEmail(email, subject, text, html);

        if (emailResult.success) {
            res.json({ success: true, message: 'Verification code sent successfully' });
        } else {
            // If email fails, delete the code so user can try again cleanly
            await VerificationCode.deleteMany({ email });
            res.status(500).json({ success: false, message: 'Failed to send email' });
        }

    } catch (error) {
        console.error('Error in send-code:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/verification/verify-code
// @desc    Verify the code sent to email
// @access  Public
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    try {
        const record = await VerificationCode.findOne({ email });

        if (!record) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
        }

        if (record.code !== code) {
            return res.status(400).json({ success: false, message: 'Invalid verification code' });
        }

        // Code matches!
        // Optionally delete the code now that it's used, or keep it until expiration.
        // Deleting it prevents replay attacks if that's a concern, though for onboarding it's less critical.
        await VerificationCode.deleteOne({ _id: record._id });

        res.json({ success: true, message: 'Email verified successfully' });

    } catch (error) {
        console.error('Error in verify-code:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
