#!/usr/bin/env node

/**
 * EventFinder SMTP Email MCP Server
 *
 * Provides email sending capability with iCal attachments.
 * Agent never sees SMTP credentials - they're read from .env by this server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import nodemailer from 'nodemailer';
import ical from 'ical-generator';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from project root (2 levels up: mcp-servers/smtp-email -> root)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

// Validate required environment variables
const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`Error: Missing required environment variable: ${varName}`);
    process.exit(1);
  }
}

// Create SMTP transporter (credentials from .env)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

/**
 * Generate iCal file for event
 */
function generateEventIcal(event, instance) {
  const calendar = ical({ name: 'EventFinder Events' });

  // Parse date and time
  const eventDate = new Date(`${instance.date}T${instance.time || '00:00:00'}`);
  const endDate = instance.end_date
    ? new Date(`${instance.end_date}T23:59:59`)
    : new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // +2 hours default

  calendar.createEvent({
    start: eventDate,
    end: endDate,
    summary: event.title,
    description: event.description || '',
    location: event.venue || '',
    url: event.event_url || '',
    organizer: {
      name: 'EventFinder',
      email: process.env.EMAIL_FROM,
    },
    alarms: [
      { type: 'display', trigger: 60 * 24 }, // 1 day before
      { type: 'display', trigger: 60 * 3 },  // 3 hours before
    ],
  });

  return calendar.toString();
}

/**
 * Generate iCal file for ticket sale
 */
function generateTicketIcal(event, instance) {
  if (!instance.ticket_sale_date) return null;

  const calendar = ical({ name: 'EventFinder Ticket Sales' });

  // Parse ticket sale date and time
  const saleDate = new Date(`${instance.ticket_sale_date}T${instance.ticket_sale_time || '09:00:00'}`);

  calendar.createEvent({
    start: saleDate,
    end: new Date(saleDate.getTime() + 15 * 60 * 1000), // 15 minutes
    summary: `Tickets on Sale: ${event.title}`,
    description: `Ticket sales begin for ${event.title}${event.venue ? ' at ' + event.venue : ''}.\n\n${event.ticket_url || event.event_url || ''}`,
    location: event.venue || '',
    url: event.ticket_url || event.event_url || '',
    organizer: {
      name: 'EventFinder',
      email: process.env.EMAIL_FROM,
    },
    alarms: [
      { type: 'display', trigger: 0 }, // Day of (morning)
    ],
  });

  return calendar.toString();
}

// Create MCP server
const server = new Server(
  {
    name: 'eventfinder-smtp-email',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'send_digest_email',
        description: 'Send EventFinder digest email with HTML content, plain text, and iCal attachments',
        inputSchema: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Recipient email address',
            },
            subject: {
              type: 'string',
              description: 'Email subject line',
            },
            html: {
              type: 'string',
              description: 'HTML email body',
            },
            text: {
              type: 'string',
              description: 'Plain text email body (fallback)',
            },
            events: {
              type: 'array',
              description: 'Array of events with instances to generate iCal files',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  venue: { type: 'string' },
                  description: { type: 'string' },
                  event_url: { type: 'string' },
                  ticket_url: { type: 'string' },
                  instances: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        date: { type: 'string' },
                        time: { type: 'string' },
                        end_date: { type: 'string' },
                        ticket_sale_date: { type: 'string' },
                        ticket_sale_time: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          required: ['to', 'subject', 'html', 'text', 'events'],
        },
      },
      {
        name: 'test_smtp_connection',
        description: 'Test SMTP connection and configuration',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'test_smtp_connection') {
    try {
      await transporter.verify();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'SMTP connection verified successfully',
              config: {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                from: process.env.EMAIL_FROM,
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
      };
    }
  }

  if (name === 'send_digest_email') {
    const { to, subject, html, text, events } = args;

    try {
      // Generate combined iCal files
      const eventIcals = [];
      const ticketIcals = [];

      for (const event of events) {
        for (const instance of event.instances) {
          // Event iCal
          const eventIcal = generateEventIcal(event, instance);
          eventIcals.push(eventIcal);

          // Ticket iCal (if applicable)
          const ticketIcal = generateTicketIcal(event, instance);
          if (ticketIcal) {
            ticketIcals.push(ticketIcal);
          }
        }
      }

      // Combine all iCals
      const today = new Date().toISOString().split('T')[0];
      const combinedEventIcal = eventIcals.join('\n');
      const combinedTicketIcal = ticketIcals.join('\n');

      // Prepare attachments
      const attachments = [
        {
          filename: `events-${today}.ics`,
          content: combinedEventIcal,
          contentType: 'text/calendar',
        },
      ];

      if (combinedTicketIcal) {
        attachments.push({
          filename: `tickets-${today}.ics`,
          content: combinedTicketIcal,
          contentType: 'text/calendar',
        });
      }

      // Send email
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: to || process.env.EMAIL_TO,
        subject,
        text,
        html,
        attachments,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              messageId: info.messageId,
              events_count: events.length,
              attachments: attachments.map(a => a.filename),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              stack: error.stack,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('EventFinder SMTP Email MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
