import { Schema, model, type Document, type Types } from 'mongoose';

export interface PackingListDocument extends Document<Types.ObjectId> {
  bookingReference: Types.ObjectId; // Reference to Booking
  packingListCode: string; // Auto-generated unique code
  netWeight: number; // Total net weight of packed items
  grossWeight: number; // Total gross weight including packaging
  packedBy: string; // Name of person who completed packing
  plannedBundleCount: number; // Number of bundles planned for packing
  actualBundleCount: number; // Number of bundles packed after completion
  packingStatus: 'pending' | 'in_progress' | 'completed'; // Current status of packing process
  createdAt: Date;
  updatedAt: Date;
}

const packingListSchema = new Schema<PackingListDocument>(
  {
    bookingReference: { 
      type: Schema.Types.ObjectId, 
      ref: 'Booking', 
      required: true,
      index: true 
    },
    packingListCode: { 
      type: String, 
      unique: true,
      trim: true 
    },
    netWeight: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    grossWeight: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    packedBy: { 
      type: String, 
      required: true, 
      trim: true 
    },
    plannedBundleCount: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    actualBundleCount: { 
      type: Number, 
      required: true, 
      min: 0,
      default: 0 
    },
    packingStatus: { 
      type: String, 
      enum: ['pending', 'in_progress', 'completed'], 
      default: 'pending' 
    }
  },
  {
    timestamps: true
  }
);

// Create indexes for better performance
packingListSchema.index({ packingListCode: 1 }, { unique: true });
packingListSchema.index({ bookingReference: 1 });
packingListSchema.index({ packingStatus: 1 });
packingListSchema.index({ createdAt: -1 });

// Pre-save middleware to auto-generate packing list code
packingListSchema.pre('save', async function (next) {
  if (this.isNew && !this.packingListCode) {
    try {
      // Generate unique packing list code (e.g., PL-2024-001)
      const year = new Date().getFullYear();
      const PackingListModel = this.constructor as any;
      const count = await PackingListModel.countDocuments({
        packingListCode: new RegExp(`^PL-${year}-`)
      });
      this.packingListCode = `PL-${year}-${String(count + 1).padStart(3, '0')}`;
      console.log('Generated packing list code:', this.packingListCode);
    } catch (error) {
      console.error('Error generating packing list code:', error);
      return next(error as Error);
    }
  }
  next();
});

export const PackingList = model<PackingListDocument>('PackingList', packingListSchema);