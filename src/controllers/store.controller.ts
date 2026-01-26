import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { Store, type StoreDocument } from '../models/store.model';
import { User, type UserDocument } from '../models/user.model';
import { Inventory } from '../models/inventory.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const createStore = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { name, code, managerId, phone, email, address, city, state, postalCode, country, bankName, bankAccountNumber, ifscCode, ibanCode, taxCode } = req.body;

  const existing = await Store.findOne({ code });
  if (existing) {
    throw ApiError.conflict('Store with this code already exists');
  }

  // Create the store with role-based assignment
  const storeData: any = {
    // Removed company field since we're removing company context
    name,
    code,
    phone,
    email,
    address,
    city,
    state,
    postalCode,
    country,
    bankName,
    bankAccountNumber,
    ifscCode,
    ibanCode,
    taxCode
  };

  // Assign the selected role to the store
  if (managerId) {
    storeData.role = managerId; // Store the role name directly
  }

  const store = await Store.create(storeData);

  const populatedStore = await Store.findById(store._id);

  return respond(res, StatusCodes.CREATED, populatedStore, { message: 'Store created successfully' });
});

export const updateStore = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const store = await Store.findById(req.params.id);

  if (!store) {
    throw ApiError.notFound('Store not found');
  }

  const { name, managerId, phone, email, address, city, state, postalCode, country, bankName, bankAccountNumber, ifscCode, ibanCode, taxCode, isActive } = req.body;

  if (name) store.name = name;
  if (phone !== undefined) store.phone = phone;
  if (email !== undefined) store.email = email;
  if (address !== undefined) store.address = address;
  if (city !== undefined) store.city = city;
  if (state !== undefined) store.state = state;
  if (postalCode !== undefined) store.postalCode = postalCode;
  if (country !== undefined) store.country = country;
  if (bankName !== undefined) store.bankName = bankName;
  if (bankAccountNumber !== undefined) store.bankAccountNumber = bankAccountNumber;
  if (ifscCode !== undefined) store.ifscCode = ifscCode;
  if (ibanCode !== undefined) store.ibanCode = ibanCode;
  if (taxCode !== undefined) store.taxCode = taxCode;
  if (typeof isActive === 'boolean') store.isActive = isActive;

  // Handle role-based assignment
  if (managerId !== undefined) {
    if (managerId === null || managerId === '') {
      // Clear the role assignment
      store.role = undefined;
    } else {
      // Assign the selected role to the store
      store.role = managerId;
    }
  }

  await store.save();

  const updatedStore = await Store.findById(store._id);

  return respond(res, StatusCodes.OK, updatedStore, { message: 'Store updated successfully' });
});

export const listStores = asyncHandler(async (req: Request, res: Response) => {
  // Get user info from request
  const userId = req.query.userId as string || (req.user ? req.user.id : null);
  const userRole = req.query.userRole as string || (req.user as any)?.role || (req.user as any)?.role_name;

  // Build base query conditions
  const baseFilters: any = { isActive: true };

  // Add search functionality if provided
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search as string, 'i');
    baseFilters.$or = [
      { name: searchRegex },
      { code: searchRegex }
    ];
  }

  // Log initial request info
  console.log('=== Store List Request ===');
  console.log('Query params:', req.query);
  console.log('User from req.user:', req.user);
  console.log('Extracted userId:', userId);
  console.log('Extracted userRole:', userRole);

  let stores: any[];

  // Apply role-based filtering
  if (userRole && userRole !== 'admin' && userRole !== 'superadmin') {
    // For non-admin users, filter based on their role
    baseFilters.role = userRole;
  }

  // Log the final filters
  console.log('Final baseFilters:', JSON.stringify(baseFilters, null, 2));

  // First, let's check all stores to see what's in the database
  const allStores = await Store.find({ isActive: true }).select('name code role');
  console.log('All active stores in database:');
  allStores.forEach(store => {
    console.log(`- ${store.name} (${store.code}): role=${store.role}`);
  });

  // Execute the query
  stores = await Store.find(baseFilters)
    .sort({ name: 1 });

  // Log for debugging
  console.log('Store filtering - userRole:', userRole);
  console.log('Store filtering - baseFilters:', baseFilters);
  console.log('Store filtering - found stores:', stores.length);
  console.log('Found stores:', stores.map(s => ({ name: s.name, code: s.code })));
  console.log('=== End Store List Request ===');

  return respond(res, StatusCodes.OK, stores);
});

export const getStore = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const store = await Store.findOne({ _id: req.params.id, isActive: true });

  if (!store) {
    throw ApiError.notFound('Store not found');
  }

  return respond(res, StatusCodes.OK, store);
});

export const deleteStore = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const store = await Store.findById(req.params.id);

  if (!store) {
    throw ApiError.notFound('Store not found');
  }

  // Check if store has any associated inventory records
  const inventoryCount = await Inventory.countDocuments({ store: store._id });
  
  if (inventoryCount > 0) {
    throw ApiError.badRequest('Cannot delete store with associated inventory records');
  }

  // Instead of deleting, we'll mark it as inactive
  store.isActive = false;
  await store.save();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Store deactivated successfully' });
});