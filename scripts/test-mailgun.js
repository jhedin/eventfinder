#!/usr/bin/env node

/**
 * Test Mailgun API using official mailgun.js library
 * Quick test to verify Mailgun credentials work
 */

import 'dotenv/config';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

if (!MAILGUN_API_KEY) {
  console.error('❌ Error: MAILGUN_API_KEY not found in .env file');
  process.exit(1);
}

if (!MAILGUN_DOMAIN) {
  console.error('❌ Error: MAILGUN_DOMAIN not found in .env file');
  process.exit(1);
}

async function sendTestEmail() {
  console.log('Testing Mailgun API...');
  console.log(`Domain: ${MAILGUN_DOMAIN}`);
  console.log(`API Key: ${MAILGUN_API_KEY.substring(0, 10)}...`);
  console.log('');

  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: 'api',
    key: MAILGUN_API_KEY,
  });

  try {
    const data = await mg.messages.create(MAILGUN_DOMAIN, {
      from: `Mailgun Sandbox <postmaster@${MAILGUN_DOMAIN}>`,
      to: ['James Hedin <jhedin10@gmail.com>'],
      subject: 'EventFinder Test Email',
      text: 'Congratulations! Your EventFinder Mailgun integration is working. This is a test email.',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">🎉 EventFinder Test Email</h1>
            <p>Congratulations! Your EventFinder Mailgun integration is working.</p>
            <p>This is a test email from the Mailgun API.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">
              Sent from EventFinder<br>
              Powered by Mailgun
            </p>
          </body>
        </html>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log('Response:', data);
    console.log('');
    console.log('Check your inbox at jhedin10@gmail.com');
    console.log('');
    console.log('⚠️  Note: You may need to authorize this email address in Mailgun sandbox settings');
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    if (error.message.includes('authorized')) {
      console.error('');
      console.error('Action required:');
      console.error('1. Go to https://app.mailgun.com/');
      console.error('2. Click on your sandbox domain');
      console.error('3. Add jhedin10@gmail.com as an authorized recipient');
      console.error('4. Check email for verification link');
    }
  }
}

sendTestEmail();
