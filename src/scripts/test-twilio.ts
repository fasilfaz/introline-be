import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

console.log('=== Twilio WhatsApp Test Script ===\n');
console.log('Environment Variables Check:');
console.log('✓ Account SID:', accountSid ? `${accountSid.substring(0, 10)}...` : '❌ MISSING');
console.log('✓ Auth Token:', authToken ? `${authToken.substring(0, 10)}...` : '❌ MISSING');
console.log('✓ WhatsApp Number:', whatsappNumber || '❌ MISSING');
console.log('\n');

if (!accountSid || !authToken) {
    console.error('❌ Twilio credentials are missing!');
    console.error('Please add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to your .env file');
    process.exit(1);
}

try {
    const client = twilio(accountSid, authToken);
    console.log('✅ Twilio client initialized successfully\n');

    // Test: Fetch account information
    console.log('Testing Twilio connection...');
    client.api.v2010.accounts(accountSid)
        .fetch()
        .then((account: any) => {
            console.log('✅ Successfully connected to Twilio!');
            console.log('   Account Name:', account.friendlyName);
            console.log('   Account Status:', account.status);
            console.log('\n');

            // Prompt for test
            console.log('📱 To send a test WhatsApp message:');
            console.log('1. Make sure you\'ve joined the Twilio Sandbox for WhatsApp');
            console.log('2. Uncomment the sendTestMessage() call below');
            console.log('3. Replace TEST_PHONE_NUMBER with your WhatsApp number (format: +919876543210)');
            console.log('\n');

            // Uncomment below to send a test message
            // sendTestMessage('+919876543210'); // Replace with your WhatsApp number
        })
        .catch((error: any) => {
            console.error('❌ Failed to connect to Twilio:');
            console.error('   Error:', error.message);
            console.error('\nPossible issues:');
            console.error('- Invalid Account SID or Auth Token');
            console.error('- Network connection issues');
            console.error('- Twilio account suspended or restricted');
        });

} catch (error: any) {
    console.error('❌ Error initializing Twilio client:');
    console.error('   ', error.message);
}

async function sendTestMessage(toNumber: string) {
    try {
        const client = twilio(accountSid!, authToken!);

        console.log(`\n📤 Sending test WhatsApp message to ${toNumber}...`);

        const message = await client.messages.create({
            from: whatsappNumber!,
            to: `whatsapp:${toNumber}`,
            body: '✅ Test message from Introline Reminder System! WhatsApp integration is working! 🎉'
        });

        console.log('✅ Message sent successfully!');
        console.log('   Message SID:', message.sid);
        console.log('   Status:', message.status);
        console.log('   To:', message.to);

    } catch (error: any) {
        console.error('❌ Failed to send test message:');
        console.error('   Error:', error.message);
        console.error('   Code:', error.code);

        if (error.code === 21211) {
            console.error('\n💡 This error means the phone number format is invalid.');
            console.error('   Make sure the number is in format: +[country code][number]');
            console.error('   Example: +919876543210 for India');
        } else if (error.code === 63007) {
            console.error('\n💡 This error means you haven\'t joined the Twilio Sandbox.');
            console.error('   To join:');
            console.error('   1. Go to https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn');
            console.error('   2. Send the join code to the sandbox number from your WhatsApp');
        }
    }
}
