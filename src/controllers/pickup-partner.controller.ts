import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { PickupPartner } from '../models/pickup-partner.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listPickupPartners = asyncHandler(async (req: Request, res: Response) => {
  const { status, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { name: new RegExp(search, 'i') },
      { phoneNumber: new RegExp(search, 'i') }
    ];
  }

  const query = PickupPartner.find(filters);

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [pickupPartners, total] = await Promise.all([query.exec(), PickupPartner.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, pickupPartners, buildPaginationMeta(page, limit, total));
});

export const getPickupPartner = asyncHandler(async (req: Request, res: Response) => {
  const pickupPartner = await PickupPartner.findById(req.params.id);

  if (!pickupPartner) {
    throw ApiError.notFound('Pickup partner not found');
  }

  return respond(res, StatusCodes.OK, pickupPartner);
});

export const createPickupPartner = asyncHandler(async (req: Request, res: Response) => {
  const { name, phoneNumber, price, status } = req.body;

  // Validate required fields
  if (!name || !phoneNumber || price === undefined) {
    throw ApiError.badRequest('Name, phone number, and price are required');
  }

  const pickupPartnerData = {
    name: name.trim(),
    phoneNumber: phoneNumber.trim(),
    price: Number(price),
    status: status || 'Active'
  };

  try {
    const pickupPartner = await PickupPartner.create(pickupPartnerData);
    return respond(res, StatusCodes.CREATED, pickupPartner, { message: 'Pickup partner created successfully' });
  } catch (error: any) {
    console.error('Error creating pickup partner:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      throw ApiError.badRequest(`Validation failed: ${validationErrors.join(', ')}`);
    }
    throw error;
  }
});

export const updatePickupPartner = asyncHandler(async (req: Request, res: Response) => {
  const pickupPartner = await PickupPartner.findById(req.params.id);

  if (!pickupPartner) {
    throw ApiError.notFound('Pickup partner not found');
  }

  const updates: Record<string, unknown> = {};
  const { name, phoneNumber, price, status } = req.body;

  if (name !== undefined) updates.name = name;
  if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
  if (price !== undefined) updates.price = price;
  if (status !== undefined) updates.status = status;

  Object.assign(pickupPartner, updates);
  await pickupPartner.save();

  return respond(res, StatusCodes.OK, pickupPartner, { message: 'Pickup partner updated successfully' });
});

export const deletePickupPartner = asyncHandler(async (req: Request, res: Response) => {
  const pickupPartner = await PickupPartner.findById(req.params.id);

  if (!pickupPartner) {
    throw ApiError.notFound('Pickup partner not found');
  }

  await PickupPartner.deleteOne({ _id: pickupPartner._id });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Pickup partner deleted successfully' });
});