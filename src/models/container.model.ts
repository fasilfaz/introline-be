import { Schema, model, type Document, type Types } from 'mongoose';

export interface ContainerDocument extends Document<Types.ObjectId> {
  containerCode: string; // Auto-generated container code
  companyName: string; // Company name
  bookingDate: Date; // Booking date
  bookingCharge: number; // Booking charge amount
  advancePayment: number; // Advance payment amount
  balanceAmount: number; // Balance amount (calculated: bookingCharge - advancePayment)
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const containerSchema = new Schema<ContainerDocument>(
  {
    containerCode: { 
      type: String, 
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    companyName: { 
      type: String, 
      required: true,
      trim: true
    },
    bookingDate: { 
      type: Date, 
      required: true 
    },
    bookingCharge: { 
      type: Number, 
      required: true,
      min: 0
    },
    advancePayment: { 
      type: Number, 
      required: true,
      min: 0,
      default: 0
    },
    balanceAmount: { 
      type: Number, 
      required: true,
      min: 0
    },
    status: { 
      type: String, 
      enum: ['pending', 'confirmed', 'completed', 'cancelled'], 
      default: 'pending' 
    }
  },
  {
    timestamps: true
  }
);

// Pre-save middleware to calculate balance amount
containerSchema.pre('save', function(next) {
  this.balanceAmount = this.bookingCharge - this.advancePayment;
  next();
});

// Pre-update middleware to calculate balance amount
containerSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() as any;
  if (update.bookingCharge !== undefined || update.advancePayment !== undefined) {
    const bookingCharge = update.bookingCharge || 0;
    const advancePayment = update.advancePayment || 0;
    update.balanceAmount = bookingCharge - advancePayment;
  }
  next();
});

// Create indexes for better performance
containerSchema.index({ containerCode: 1 });
containerSchema.index({ companyName: 1 });
containerSchema.index({ status: 1 });
containerSchema.index({ bookingDate: -1 });
containerSchema.index({ createdAt: -1 });

export const Container = model<ContainerDocument>('Container', containerSchema);