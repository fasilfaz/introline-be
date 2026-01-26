import mongoose from 'mongoose';
import { Booking } from '../models/booking.model';
import { Customer } from '../models/customer.model';

// Helper function to generate booking code from sender name, receiver name and date
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

const addBookingCodes = async () => {
  try {
    // Connect to MongoDB (using the same connection logic as in config/database.ts)
    const uri = process.env.MONGODB_URI || '';
    await mongoose.connect(uri);
    
    console.log('Connected to MongoDB');
    
    // Find all bookings that don't have a booking code
    const bookingsWithoutCode = await Booking.find({ bookingCode: { $exists: false } });
    
    if (bookingsWithoutCode.length === 0) {
      console.log('No bookings found without booking codes');
      return;
    }
    
    console.log(`Found ${bookingsWithoutCode.length} bookings without booking codes`);
    
    for (const booking of bookingsWithoutCode) {
      // Fetch sender and receiver details
      const sender = await Customer.findById(booking.sender);
      const receiver = await Customer.findById(booking.receiver);
      
      if (sender && receiver) {
        // Generate booking code
        const bookingCode = await generateBookingCode(sender.name, receiver.name, booking.date);
        
        // Update the booking with the generated code
        await Booking.updateOne(
          { _id: booking._id },
          { $set: { bookingCode } }
        );
        
        console.log(`Added booking code ${bookingCode} to booking ${booking._id}`);
      } else {
        console.log(`Could not find sender (${booking.sender}) or receiver (${booking.receiver}) for booking ${booking._id}`);
      }
    }
    
    console.log('Booking codes added successfully');
  } catch (error) {
    console.error('Error adding booking codes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

if (require.main === module) {
  addBookingCodes();
}

export default addBookingCodes;