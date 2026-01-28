import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Booking } from '../models/booking.model';
import { Customer } from '../models/customer.model';

dotenv.config();

// Helper function to generate a booking code from sender name, receiver name and date
const generateBookingCode = async (senderName: string, receiverName: string, date: Date): Promise<string> => {
  // Clean the names by removing spaces and special characters, taking first 3 letters of each
  const cleanSender = senderName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
  const cleanReceiver = receiverName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();

  // Format the date as YYYYMMDD
  const formattedDate = new Date(date).toISOString().split('T')[0].replace(/-/g, '');

  // Try to create a booking code and ensure it's unique
  let sequence = 1;
  let bookingCode: string;

  do {
    // Pad the sequence number with leading zeros
    const seqStr = sequence.toString().padStart(3, '0');

    // Create the booking code: SENDER_RECEIVER_DATE_SEQ
    bookingCode = `${cleanSender}_${cleanReceiver}_${formattedDate}_${seqStr}`;

    // Check if this booking code already exists
    const existingBooking = await Booking.findOne({ bookingCode });

    if (!existingBooking) {
      return bookingCode; // Return the unique code
    }

    sequence++; // Increment sequence and try again
  } while (sequence <= 999); // Limit to 999 tries to avoid infinite loop

  // Fallback: use timestamp if all sequences are taken
  const timestamp = Date.now().toString().slice(-6);
  return `${cleanSender}_${cleanReceiver}_${formattedDate}_${timestamp}`;
};

async function migrateBookingCodes() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/introline';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find all bookings without booking codes
    const bookingsWithoutCodes = await Booking.find({ bookingCode: { $exists: false } }).exec();

    console.log(`Found ${bookingsWithoutCodes.length} bookings without booking codes`);

    for (let i = 0; i < bookingsWithoutCodes.length; i++) {
      const booking = bookingsWithoutCodes[i];

      try {
        // Get sender and receiver customer details
        const sender = await Customer.findById(booking.sender);
        const receiver = await Customer.findById(booking.receiver);

        if (!sender || !receiver) {
          console.warn(`Skipping booking ${booking._id} - sender or receiver not found`);
          continue;
        }

        // Generate booking code
        const bookingCode = await generateBookingCode(sender.name, receiver.name, new Date((booking as any).stuffingDate));

        // Update the booking with the generated code
        await Booking.findByIdAndUpdate(booking._id, { bookingCode });

        console.log(`Updated booking ${booking._id} with code: ${bookingCode}`);
      } catch (error) {
        console.error(`Error processing booking ${booking._id}:`, error);
      }
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the migration
if (require.main === module) {
  migrateBookingCodes();
}