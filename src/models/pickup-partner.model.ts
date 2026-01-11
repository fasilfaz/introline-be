import { Schema, model, type Document, type Types } from 'mongoose';

export interface PickupPartnerDocument extends Document<Types.ObjectId> {
  name: string;
  phoneNumber: string;
  price: number; // pickup charge
  status: 'Active' | 'Inactive';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pickupPartnerSchema = new Schema<PickupPartnerDocument>(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

// Create indexes for better performance
pickupPartnerSchema.index({ name: 1 });
pickupPartnerSchema.index({ status: 1 });
pickupPartnerSchema.index({ createdAt: -1 });

export const PickupPartner = model<PickupPartnerDocument>('PickupPartner', pickupPartnerSchema);