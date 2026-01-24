import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Customer } from '../models/customer.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

// Clean up old indexes on first load
let indexesCleanedUp = false;
const cleanupOldIndexes = async () => {
  if (indexesCleanedUp) return;
  
  try {
    const collection = Customer.collection;
    const oldIndexes = ['company_1_customerId_1', 'company_1_name_1', 'customerId_1'];
    
    for (const indexName of oldIndexes) {
      try {
        await collection.dropIndex(indexName);
        console.log(`✅ Dropped old index: ${indexName}`);
      } catch (error: any) {
        if (error.codeName !== 'IndexNotFound') {
          console.log(`⚠️  Could not drop index ${indexName}:`, error.message);
        }
      }
    }
    indexesCleanedUp = true;
  } catch (error) {
    console.log('Index cleanup completed');
  }
};

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  // Clean up old indexes on first request
  await cleanupOldIndexes();
  
  const { status, search, customerType } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (customerType && customerType !== 'all') {
    filters.customerType = customerType;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { name: new RegExp(search, 'i') },
      { shopName: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
      { whatsappNumber: new RegExp(search, 'i') }
    ];
  }

  const query = Customer.find(filters);

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [customers, total] = await Promise.all([query.exec(), Customer.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, customers, buildPaginationMeta(page, limit, total));
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  return respond(res, StatusCodes.OK, customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { 
    customerType,
    name, 
    status,
    // Common fields
    shopName,
    contactPerson,
    phone,
    whatsappNumber,
    // Sender specific fields
    location,
    gstNumber,
    accountDetails,
    // Receiver specific fields
    branches,
    credit,
    country,
    address,
    discount,
    paymentHistory
  } = req.body;

  // Validate required fields
  if (!customerType || !name) {
    throw ApiError.badRequest('Customer type and name are required');
  }

  if (!['Sender', 'Receiver'].includes(customerType)) {
    throw ApiError.badRequest('Customer type must be either Sender or Receiver');
  }

  const customerData: any = {
    customerType,
    name: name.trim(),
    status: status || 'Active'
  };

  // Add common fields
  if (shopName && shopName.trim()) customerData.shopName = shopName.trim();
  if (contactPerson && contactPerson.trim()) customerData.contactPerson = contactPerson.trim();
  if (phone && phone.trim()) customerData.phone = phone.trim();
  if (whatsappNumber && whatsappNumber.trim()) customerData.whatsappNumber = whatsappNumber.trim();

  // Add sender specific fields if customer type is Sender
  if (customerType === 'Sender') {
    if (location && location.trim()) customerData.location = location.trim();
    if (gstNumber && gstNumber.trim()) customerData.gstNumber = gstNumber.trim();
    if (accountDetails && typeof accountDetails === 'object') {
      customerData.accountDetails = accountDetails;
    }
  }

  // Add receiver specific fields if customer type is Receiver
  if (customerType === 'Receiver') {
    if (branches && Array.isArray(branches)) customerData.branches = branches;
    if (credit !== undefined && credit !== null) customerData.credit = Number(credit);
    if (country && country.trim()) customerData.country = country.trim();
    if (address && address.trim()) customerData.address = address.trim();
    if (discount !== undefined && discount !== null) customerData.discount = Number(discount);
    if (paymentHistory && Array.isArray(paymentHistory)) customerData.paymentHistory = paymentHistory;
  }

  try {
    const customer = await Customer.create(customerData);
    return respond(res, StatusCodes.CREATED, customer, { message: 'Customer created successfully' });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      throw ApiError.badRequest(`Validation failed: ${validationErrors.join(', ')}`);
    }
    throw error;
  }
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  const updates: Record<string, unknown> = {};
  const { 
    customerType,
    name, 
    status,
    // Common fields
    shopName,
    contactPerson,
    phone,
    whatsappNumber,
    // Sender specific fields
    location,
    gstNumber,
    accountDetails,
    // Receiver specific fields
    branches,
    credit,
    country,
    address,
    discount,
    paymentHistory
  } = req.body;

  // Common fields
  if (customerType !== undefined) updates.customerType = customerType;
  if (name !== undefined) updates.name = name;
  if (status !== undefined) updates.status = status;
  if (shopName !== undefined) updates.shopName = shopName;
  if (contactPerson !== undefined) updates.contactPerson = contactPerson;
  if (phone !== undefined) updates.phone = phone;
  if (whatsappNumber !== undefined) updates.whatsappNumber = whatsappNumber;

  // Sender specific fields
  if (location !== undefined) updates.location = location;
  if (gstNumber !== undefined) updates.gstNumber = gstNumber;
  if (accountDetails !== undefined) updates.accountDetails = accountDetails;

  // Receiver specific fields
  if (branches !== undefined) updates.branches = branches;
  if (credit !== undefined) updates.credit = credit;
  if (country !== undefined) updates.country = country;
  if (address !== undefined) updates.address = address;
  if (discount !== undefined) updates.discount = discount;
  if (paymentHistory !== undefined) updates.paymentHistory = paymentHistory;

  Object.assign(customer, updates);
  await customer.save();

  return respond(res, StatusCodes.OK, customer, { message: 'Customer updated successfully' });
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  await Customer.deleteOne({ _id: customer._id });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Customer deleted successfully' });
});