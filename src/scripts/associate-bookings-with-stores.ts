import mongoose from 'mongoose';
import { Booking } from '../models/booking.model';
import { Customer } from '../models/customer.model';
import { Store } from '../models/store.model';
import { connectDB } from '../config/database';

// Script to associate bookings with stores based on customer country information
const associateBookingsWithStores = async () => {
  try {
    await connectDB();

    console.log('Starting booking-store association...');

    // Get all stores
    const stores = await Store.find({});
    console.log(`Found ${stores.length} stores`);

    // Get all bookings
    const bookings = await Booking.find({})
      .populate('sender', 'country')
      .populate('receiver', 'country');
    
    console.log(`Processing ${bookings.length} bookings...`);

    let updatedCount = 0;
    
    for (const booking of bookings) {
      let storeToAssociate: any = null;
      
      // Look for a store that matches the booking's country information
      for (const store of stores) {
        if (store.country) {
          const storeCountry = store.country.toLowerCase();
          
          // Check if sender or receiver country matches the store country
          const senderCountry = (booking.sender as any)?.country?.toLowerCase();
          const receiverCountry = (booking.receiver as any)?.country?.toLowerCase();
          
          if ((senderCountry && senderCountry.includes(storeCountry)) || 
              (receiverCountry && receiverCountry.includes(storeCountry))) {
            storeToAssociate = store;
            break;
          }
        }
      }
      
      // Update the booking with the store reference if found
      if (storeToAssociate && !booking.store) {
        await Booking.findByIdAndUpdate(booking._id, { 
          store: storeToAssociate._id 
        });
        updatedCount++;
        console.log(`Associated booking ${booking._id} with store ${storeToAssociate._id} (${storeToAssociate.name})`);
      }
    }

    console.log(`Successfully associated ${updatedCount} bookings with stores.`);
    
  } catch (error) {
    console.error('Error associating bookings with stores:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
};

if (require.main === module) {
  associateBookingsWithStores();
}

export { associateBookingsWithStores };