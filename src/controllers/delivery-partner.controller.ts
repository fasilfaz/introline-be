import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { DeliveryPartner } from '../models/delivery-partner.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listDeliveryPartners = asyncHandler(async (req: Request, res: Response) => {
  const { status, search, fromCountry, toCountry } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (fromCountry && fromCountry !== 'all') {
    filters.fromCountry = fromCountry;
  }

  if (toCountry && toCountry !== 'all') {
    filters.toCountry = toCountry;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { name: new RegExp(search, 'i') },
      { phoneNumber: new RegExp(search, 'i') },
      { fromCountry: new RegExp(search, 'i') },
      { toCountry: new RegExp(search, 'i') }
    ];
  }

  const query = DeliveryPartner.find(filters);

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [deliveryPartners, total] = await Promise.all([query.exec(), DeliveryPartner.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, deliveryPartners, buildPaginationMeta(page, limit, total));
});

export const getDeliveryPartner = asyncHandler(async (req: Request, res: Response) => {
  const deliveryPartner = await DeliveryPartner.findById(req.params.id);

  if (!deliveryPartner) {
    throw ApiError.notFound('Delivery partner not found');
  }

  return respond(res, StatusCodes.OK, deliveryPartner);
});

export const createDeliveryPartner = asyncHandler(async (req: Request, res: Response) => {
  const { name, phoneNumber, price, fromCountry, toCountry, status } = req.body;

  // Validate required fields
  if (!name || !phoneNumber || price === undefined || !fromCountry || !toCountry) {
    throw ApiError.badRequest('Name, phone number, price, from country, and to country are required');
  }

  const deliveryPartnerData = {
    name: name.trim(),
    phoneNumber: phoneNumber.trim(),
    price: Number(price),
    fromCountry: fromCountry.trim(),
    toCountry: toCountry.trim(),
    status: status || 'Active'
  };

  try {
    const deliveryPartner = await DeliveryPartner.create(deliveryPartnerData);
    return respond(res, StatusCodes.CREATED, deliveryPartner, { message: 'Delivery partner created successfully' });
  } catch (error: any) {
    console.error('Error creating delivery partner:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      throw ApiError.badRequest(`Validation failed: ${validationErrors.join(', ')}`);
    }
    throw error;
  }
});

export const updateDeliveryPartner = asyncHandler(async (req: Request, res: Response) => {
  const deliveryPartner = await DeliveryPartner.findById(req.params.id);

  if (!deliveryPartner) {
    throw ApiError.notFound('Delivery partner not found');
  }

  const updates: Record<string, unknown> = {};
  const { name, phoneNumber, price, fromCountry, toCountry, status } = req.body;

  if (name !== undefined) updates.name = name;
  if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
  if (price !== undefined) updates.price = price;
  if (fromCountry !== undefined) updates.fromCountry = fromCountry;
  if (toCountry !== undefined) updates.toCountry = toCountry;
  if (status !== undefined) updates.status = status;

  Object.assign(deliveryPartner, updates);
  await deliveryPartner.save();

  return respond(res, StatusCodes.OK, deliveryPartner, { message: 'Delivery partner updated successfully' });
});

export const deleteDeliveryPartner = asyncHandler(async (req: Request, res: Response) => {
  const deliveryPartner = await DeliveryPartner.findById(req.params.id);

  if (!deliveryPartner) {
    throw ApiError.notFound('Delivery partner not found');
  }

  await DeliveryPartner.deleteOne({ _id: deliveryPartner._id });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Delivery partner deleted successfully' });
});