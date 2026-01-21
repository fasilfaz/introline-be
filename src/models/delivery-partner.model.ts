import { Schema, model, type Document, type Types } from 'mongoose';

export interface DeliveryPartnerDocument extends Document<Types.ObjectId> {
  name: string;
  phoneNumber: string;
  price: number; // delivery charge
  fromCountry: string;
  toCountry: string;
  status: 'Active' | 'Inactive';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const deliveryPartnerSchema = new Schema<DeliveryPartnerDocument>(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    fromCountry: { type: String, required: true, trim: true },
    toCountry: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

// Create indexes for better performance
deliveryPartnerSchema.index({ name: 1 });
deliveryPartnerSchema.index({ fromCountry: 1 });
deliveryPartnerSchema.index({ toCountry: 1 });
deliveryPartnerSchema.index({ status: 1 });
deliveryPartnerSchema.index({ createdAt: -1 });

export const DeliveryPartner = model<DeliveryPartnerDocument>('DeliveryPartner', deliveryPartnerSchema);