import { Schema, model, type Document, type Types } from 'mongoose';

// Branch interface for receiver customers
export interface Branch {
  branchName?: string;
  location?: string;
  phone?: string;
  contactPerson?: string;
}

// Account details interface for sender customers
export interface AccountDetails {
  accountNumber?: string;
  ifscCode?: string;
  ibanCode?: string;
  bankName?: string;
  accountHolderName?: string;
  swiftCode?: string;
}

// Payment history interface for receiver customers
export interface PaymentHistory {
  date: Date;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

export interface CustomerDocument extends Document<Types.ObjectId> {
  customerType: 'Sender' | 'Receiver';
  name: string;
  status: 'Active' | 'Inactive';
  isActive: boolean;
  
  // Common fields
  shopName?: string;
  contactPerson?: string;
  
  // Sender specific fields
  location?: string;
  gstNumber?: string;
  whatsappNumber?: string;
  accountDetails?: AccountDetails;
  
  // Receiver specific fields
  branches?: Branch[];
  phone?: string;
  credit?: number;
  country?: string;
  address?: string;
  discount?: number;
  paymentHistory?: PaymentHistory[];
  
  createdAt: Date;
  updatedAt: Date;
}

// Branch schema
const branchSchema = new Schema<Branch>({
  branchName: { type: String, trim: true },
  location: { type: String, trim: true },
  phone: { type: String, trim: true },
  contactPerson: { type: String, trim: true }
}, { _id: false });

// Account details schema
const accountDetailsSchema = new Schema<AccountDetails>({
  accountNumber: { type: String, trim: true },
  ifscCode: { type: String, trim: true },
  ibanCode: { type: String, trim: true },
  bankName: { type: String, trim: true },
  accountHolderName: { type: String, trim: true },
  swiftCode: { type: String, trim: true }
}, { _id: false });

// Payment history schema
const paymentHistorySchema = new Schema<PaymentHistory>({
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, trim: true },
  reference: { type: String, trim: true },
  notes: { type: String, trim: true }
}, { _id: false });

const customerSchema = new Schema<CustomerDocument>(
  {
    customerType: { type: String, enum: ['Sender', 'Receiver'], required: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isActive: { type: Boolean, default: true },
    
    // Common fields
    shopName: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    
    // Sender specific fields
    location: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    whatsappNumber: { type: String, trim: true },
    accountDetails: accountDetailsSchema,
    
    // Receiver specific fields
    branches: [branchSchema],
    phone: { type: String, trim: true },
    credit: { type: Number, default: 0 },
    country: { type: String, trim: true },
    address: { type: String, trim: true },
    discount: { type: Number, min: 0, max: 100 },
    paymentHistory: [paymentHistorySchema]
  },
  {
    timestamps: true
  }
);

// Create indexes for better performance
customerSchema.index({ customerType: 1 });
customerSchema.index({ name: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ createdAt: -1 });

export const Customer = model<CustomerDocument>('Customer', customerSchema);