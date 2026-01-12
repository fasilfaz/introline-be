import { Schema, model, type Document, type Types } from 'mongoose';

export interface BookingDocument extends Document<Types.ObjectId> {
  sender: Types.ObjectId; // Reference to Customer with type 'Sender'
  receiver: Types.ObjectId; // Reference to Customer with type 'Receiver'
  receiverBranch?: string; // Selected branch name from receiver's branches
  pickupPartner: Types.ObjectId; // Reference to PickupPartner
  date: Date; // Booking date
  expectedReceivingDate: Date; // Expected receiving date
  bundleCount: number; // Number of bundles
  status: 'pending' | 'success';
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<BookingDocument>(
  {
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
      type: Schema.Types.ObjectId, 
      ref: 'PickupPartner', 
      required: true 
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
    }
  },
  {
    timestamps: true
  }
);

// Create indexes for better performance
bookingSchema.index({ sender: 1 });
bookingSchema.index({ receiver: 1 });
bookingSchema.index({ pickupPartner: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ date: -1 });
bookingSchema.index({ createdAt: -1 });

export const Booking = model<BookingDocument>('Booking', bookingSchema);