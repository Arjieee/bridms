import nodemailer from 'nodemailer';

/**
 * Core internal function to send transactional emails using Brevo API or SMTP.
 */

const sendViaBrevoAPI = async ({ toEmail, toName, subject, htmlContent }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'noreply@brgypuerto.gov.ph';
  const senderName = process.env.BREVO_SENDER_NAME || 'Barangay Puerto Relief Portal';

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail, name: toName || toEmail }],
      subject: subject,
      htmlContent: htmlContent,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Brevo API returned status ${response.status}`);
  }

  return await response.json();
};

const sendViaSMTP = async ({ toEmail, toName, subject, htmlContent }) => {
  const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER || process.env.BREVO_SENDER_EMAIL;
  const pass = process.env.SMTP_PASS || process.env.BREVO_API_KEY;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const mailOptions = {
    from: `"${process.env.BREVO_SENDER_NAME || 'Barangay Puerto Relief Portal'}" <${user}>`,
    to: toEmail,
    subject,
    html: htmlContent,
  };

  return await transporter.sendMail(mailOptions);
};

export const sendTransactionalEmail = async ({ toEmail, toName, subject, htmlContent, logLabel = 'Email' }) => {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (brevoApiKey) {
    try {
      await sendViaBrevoAPI({ toEmail, toName, subject, htmlContent });
      console.log(`[BREVO API] ${logLabel} successfully sent to ${toEmail}`);
      return { ok: true, sent: true, provider: 'brevo-api' };
    } catch (err) {
      console.error(`[BREVO API ERROR] Failed to send ${logLabel}:`, err.message);
      return { ok: false, message: err.message };
    }
  }

  if (smtpUser && smtpPass) {
    try {
      await sendViaSMTP({ toEmail, toName, subject, htmlContent });
      console.log(`[SMTP] ${logLabel} successfully sent to ${toEmail}`);
      return { ok: true, sent: true, provider: 'smtp' };
    } catch (err) {
      console.error(`[SMTP ERROR] Failed to send ${logLabel}:`, err.message);
      return { ok: false, message: err.message };
    }
  }

  console.log(`[BREVO/SMTP NOTICE] Credentials not configured in .env. ${logLabel} details for ${toEmail}`);
  return { ok: true, sent: false, reason: 'No Brevo or SMTP credentials configured in environment.' };
};

/**
 * Send Password Reset OTP Email via Brevo
 */
export const sendEmailOTP = async (recipientEmail, recipientName, otp) => {
  console.log(`[OTP CODE] Password Reset Code for ${recipientEmail}: ${otp}`);

  const htmlContent = `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #0a1f47; margin: 0; font-size: 20px; font-weight: 800;">Barangay Puerto Relief System</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Password Reset Request</p>
      </div>
      <p style="color: #334155; font-size: 14px;">Hello <strong>${recipientName || 'Resident'}</strong>,</p>
      <p style="color: #475569; font-size: 13px;">We received a request to reset your password. Use the verification code below to complete the reset process:</p>
      <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Your Password Reset OTP</div>
        <div style="font-size: 36px; font-weight: 800; color: #1a56db; letter-spacing: 8px; margin: 12px 0;">${otp}</div>
        <div style="font-size: 11px; color: #94a3b8;">This code is valid for 30 minutes.</div>
      </div>
      <p style="font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px;">If you did not request a password reset, please ignore this email or contact your Barangay Puerto administrator.</p>
    </div>
  `;

  return sendTransactionalEmail({
    toEmail: recipientEmail,
    toName: recipientName,
    subject: '🔒 Password Reset Verification Code - Barangay Puerto Relief Portal',
    htmlContent,
    logLabel: `Password Reset OTP (${otp})`,
  });
};

/**
 * Send Post-Registration Email Verification Token via Brevo
 */
export const sendEmailVerificationToken = async (recipientEmail, recipientName, token, verificationUrl = '') => {
  console.log(`[VERIFICATION TOKEN] Registration Verification Code for ${recipientEmail}: ${token}`);

  const htmlContent = `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #0a1f47; margin: 0; font-size: 20px; font-weight: 800;">Barangay Puerto Relief System</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Account Email Verification</p>
      </div>
      <p style="color: #334155; font-size: 14px;">Hello <strong>${recipientName || 'Resident'}</strong>,</p>
      <p style="color: #475569; font-size: 13px;">Thank you for registering with the Barangay Puerto Relief Management & Monitoring System. Please verify your email address using the 6-digit code below to complete your registration request:</p>
      <div style="background-color: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <div style="font-size: 11px; font-weight: bold; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Your Email Verification Code</div>
        <div style="font-size: 36px; font-weight: 800; color: #15803d; letter-spacing: 8px; margin: 12px 0;">${token}</div>
        <div style="font-size: 11px; color: #166534;">This verification code is valid for 24 hours.</div>
      </div>
      ${verificationUrl ? `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${verificationUrl}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">Verify Email Address Now</a>
      </div>
      ` : ''}
      <p style="font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px;">If you did not register for a Barangay Puerto Relief account, please disregard this email.</p>
    </div>
  `;

  return sendTransactionalEmail({
    toEmail: recipientEmail,
    toName: recipientName,
    subject: '✉️ Verify Your Email Address - Barangay Puerto Relief Portal',
    htmlContent,
    logLabel: `Email Verification Token (${token})`,
  });
};

