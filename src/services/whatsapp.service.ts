import twilio from 'twilio';
import { config } from '../config/env';

class WhatsAppService {
    private client: twilio.Twilio | null = null;
    private isConfigured: boolean = false;

    constructor() {
        this.initializeTwilio();
    }

    private initializeTwilio() {
        const { accountSid, authToken, whatsappNumber } = config.twilio;

        if (!accountSid || !authToken) {
            console.warn('Twilio credentials not configured. WhatsApp functionality will be disabled.');
            return;
        }

        try {
            this.client = twilio(accountSid, authToken);
            this.isConfigured = true;
            console.log('✅ Twilio WhatsApp service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Twilio:', error);
            this.isConfigured = false;
        }
    }

    /**
     * Format phone number to WhatsApp format
     * Ensures the number is in the format: whatsapp:+[country_code][number]
     */
    private formatWhatsAppNumber(phoneNumber: string): string {
        // Remove all non-numeric characters except +
        let cleaned = phoneNumber.replace(/[^\d+]/g, '');

        // Add + if not present
        if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned;
        }

        // Add whatsapp: prefix if not present
        if (!cleaned.startsWith('whatsapp:')) {
            cleaned = 'whatsapp:' + cleaned;
        }

        return cleaned;
    }

    /**
     * Send a WhatsApp reminder message
     */
    async sendReminderMessage(
        toNumber: string,
        reminderData: {
            purpose: string;
            description: string;
            date: Date;
        }
    ): Promise<{ success: boolean; sid?: string; error?: string }> {
        if (!this.isConfigured || !this.client) {
            return {
                success: false,
                error: 'WhatsApp service is not configured. Please set up Twilio credentials.'
            };
        }

        try {
            const formattedNumber = this.formatWhatsAppNumber(toNumber);
            const formattedDate = new Date(reminderData.date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });

            // Create a friendly message
            const message = `
🔔 *Reminder Notification*

📅 *Date:* ${formattedDate}
🎯 *Purpose:* ${reminderData.purpose}
📝 *Details:* ${reminderData.description}

This is an automated reminder from your system.
      `.trim();

            const result = await this.client.messages.create({
                from: config.twilio.whatsappNumber,
                to: formattedNumber,
                body: message
            });

            console.log(`✅ WhatsApp message sent successfully. SID: ${result.sid}`);

            return {
                success: true,
                sid: result.sid
            };
        } catch (error: any) {
            console.error('❌ Failed to send WhatsApp message:', error);
            return {
                success: false,
                error: error.message || 'Failed to send WhatsApp message'
            };
        }
    }

    /**
     * Send a test WhatsApp message
     */
    async sendTestMessage(toNumber: string): Promise<{ success: boolean; sid?: string; error?: string }> {
        if (!this.isConfigured || !this.client) {
            return {
                success: false,
                error: 'WhatsApp service is not configured. Please set up Twilio credentials.'
            };
        }

        try {
            const formattedNumber = this.formatWhatsAppNumber(toNumber);
            const message = '✅ Test message from your reminder system. WhatsApp integration is working!';

            const result = await this.client.messages.create({
                from: config.twilio.whatsappNumber,
                to: formattedNumber,
                body: message
            });

            console.log(`✅ Test WhatsApp message sent successfully. SID: ${result.sid}`);

            return {
                success: true,
                sid: result.sid
            };
        } catch (error: any) {
            console.error('❌ Failed to send test WhatsApp message:', error);
            return {
                success: false,
                error: error.message || 'Failed to send test WhatsApp message'
            };
        }
    }

    /**
     * Check if WhatsApp service is available
     */
    isAvailable(): boolean {
        return this.isConfigured;
    }
}

// Export a singleton instance
export const whatsappService = new WhatsAppService();
