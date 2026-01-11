import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { PriceListing } from '../models/price-listing.model';
import { DeliveryPartner } from '../models/delivery-partner.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listPriceListings = asyncHandler(async (req: Request, res: Response) => {
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
      { fromCountry: new RegExp(search, 'i') },
      { toCountry: new RegExp(search, 'i') }
    ];
  }

  const query = PriceListing.find(filters).populate('deliveryPartnerId', 'name price');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [priceListings, total] = await Promise.all([query.exec(), PriceListing.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, priceListings, buildPaginationMeta(page, limit, total));
});

export const getPriceListing = asyncHandler(async (req: Request, res: Response) => {
  const priceListing = await PriceListing.findById(req.params.id).populate('deliveryPartnerId', 'name price');

  if (!priceListing) {
    throw ApiError.notFound('Price listing not found');
  }

  return respond(res, StatusCodes.OK, priceListing);
});
export const createPriceListing = asyncHandler(async (req: Request, res: Response) => {
  const { fromCountry, toCountry, deliveryPartnerId, amount, status } = req.body;

  // Validate required fields
  if (!fromCountry || !toCountry || amount === undefined) {
    throw ApiError.badRequest('From country, to country, and amount are required');
  }

  let totalAmount = Number(amount);
  
  // If delivery partner is selected, add their delivery charge
  if (deliveryPartnerId) {
    const deliveryPartner = await DeliveryPartner.findById(deliveryPartnerId);
    if (!deliveryPartner) {
      throw ApiError.badRequest('Invalid delivery partner selected');
    }
    totalAmount += deliveryPartner.price;
  }

  const priceListingData = {
    fromCountry: fromCountry.trim(),
    toCountry: toCountry.trim(),
    deliveryPartnerId: deliveryPartnerId || undefined,
    amount: Number(amount),
    totalAmount,
    status: status || 'Active'
  };

  try {
    const priceListing = await PriceListing.create(priceListingData);
    const populatedPriceListing = await PriceListing.findById(priceListing._id).populate('deliveryPartnerId', 'name price');
    return respond(res, StatusCodes.CREATED, populatedPriceListing, { message: 'Price listing created successfully' });
  } catch (error: any) {
    console.error('Error creating price listing:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      throw ApiError.badRequest(`Validation failed: ${validationErrors.join(', ')}`);
    }
    throw error;
  }
});

export const updatePriceListing = asyncHandler(async (req: Request, res: Response) => {
  const priceListing = await PriceListing.findById(req.params.id);

  if (!priceListing) {
    throw ApiError.notFound('Price listing not found');
  }

  const updates: Record<string, unknown> = {};
  const { fromCountry, toCountry, deliveryPartnerId, amount, status } = req.body;

  if (fromCountry !== undefined) updates.fromCountry = fromCountry;
  if (toCountry !== undefined) updates.toCountry = toCountry;
  if (deliveryPartnerId !== undefined) updates.deliveryPartnerId = deliveryPartnerId;
  if (amount !== undefined) updates.amount = amount;
  if (status !== undefined) updates.status = status;

  // Recalculate total amount if amount or delivery partner changed
  if (amount !== undefined || deliveryPartnerId !== undefined) {
    let totalAmount = Number(amount !== undefined ? amount : priceListing.amount);
    
    const partnerId = deliveryPartnerId !== undefined ? deliveryPartnerId : priceListing.deliveryPartnerId;
    if (partnerId) {
      const deliveryPartner = await DeliveryPartner.findById(partnerId);
      if (!deliveryPartner) {
        throw ApiError.badRequest('Invalid delivery partner selected');
      }
      totalAmount += deliveryPartner.price;
    }
    
    updates.totalAmount = totalAmount;
  }

  Object.assign(priceListing, updates);
  await priceListing.save();

  const updatedPriceListing = await PriceListing.findById(priceListing._id).populate('deliveryPartnerId', 'name price');
  return respond(res, StatusCodes.OK, updatedPriceListing, { message: 'Price listing updated successfully' });
});

export const deletePriceListing = asyncHandler(async (req: Request, res: Response) => {
  const priceListing = await PriceListing.findById(req.params.id);

  if (!priceListing) {
    throw ApiError.notFound('Price listing not found');
  }

  await PriceListing.deleteOne({ _id: priceListing._id });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Price listing deleted successfully' });
});