import { Schema, model, type Document, type Types } from 'mongoose';

export interface BookingDocument extends Document<Types.ObjectId> {
  bookingCode: string; // Generated booking code based on sender, receiver and date
  sender: Types.ObjectId; // Reference to Customer with type 'Sender'
  receiver: Types.ObjectId; // Reference to Customer with type 'Receiver'
  receiverBranch?: string; // Selected branch name from receiver's branches
  pickupPartner: Types.ObjectId | 'Self' | 'Central'; // Reference to PickupPartner or special values
  date: Date; // Booking date
  expectedReceivingDate: Date; // Expected receiving date
  bundleCount: number; // Number of bundles
  status: 'pending' | 'success';
  store?: Types.ObjectId; // Reference to Store
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<BookingDocument>(
  {
    bookingCode: { 
      type: String, 
      required: true,
      unique: true,
      index: true
    },
    sender: { 
      type: Schema.Types.ObjectId, 
      ref: 'Customer', 
      required: true 
    },
    receiver: { 
      type: Schema.Types.ObjectId, 
      ref: 'Customer', 
      required: true 
    },
    receiverBranch: { 
      type: String, 
      trim: true 
    },
    pickupPartner: { 
      type: Schema.Types.Mixed, // Allow both ObjectId and special string values ('Self', 'Central')
      required: true,
      validate: {
        validator: function(value) {
          // Allow special string values
          if (value === 'Self' || value === 'Central') {
            return true;
          }
          // For other values, check if it's a valid ObjectId
          return require('mongoose').Types.ObjectId.isValid(value);
        },
        message: 'Pickup partner must be a valid ObjectId or "Self" or "Central"'
      }
    },
    date: { 
      type: Date, 
      required: true 
    },
    expectedReceivingDate: { 
      type: Date, 
      required: true 
    },
    bundleCount: { 
      type: Number, 
      required: true, 
      min: 1 
    },
    status: { 
      type: String, 
      enum: ['pending', 'success'], 
      default: 'pending' 
    },
    store: { 
      type: Schema.Types.ObjectId, 
      ref: 'Store', 
      required: false 
    }
  },
  {
    timestamps: true
  }
);

// Create indexes for better performance
bookingSchema.index({ bookingCode: 1 }, { unique: true });
bookingSchema.index({ sender: 1 });
bookingSchema.index({ receiver: 1 });
bookingSchema.index({ pickupPartner: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ date: -1 });
bookingSchema.index({ createdAt: -1 });

export const Booking = model<BookingDocument>('Booking', bookingSchema);