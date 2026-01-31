import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { Bundle } from '../models/bundle.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

/**
 * Get all bundles with 'completed' status for the Ready to Ship module
 */
export const listReadyToShipBundles = asyncHandler(async (req: Request, res: Response) => {
  const { search, sortField = 'createdAt', sortOrder = 'desc', priority, readyToShipStatus } = req.query;
  const { page, limit } = getPaginationParams(req);

  // Build filters for completed bundles only
  const filters: Record<string, unknown> = {
    status: 'completed'
  };

  // Add priority filter if provided
  if (priority && priority !== 'all') {
    filters.priority = priority;
  }

  // Add readyToShipStatus filter if provided
  if (readyToShipStatus && readyToShipStatus !== 'all') {
    filters.readyToShipStatus = readyToShipStatus;
  }

  // Add search functionality if provided
  if (search && typeof search === 'string') {
    filters.$or = [
      { bundleNumber: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Build the query to populate container, packing list, and booking data
  const query = Bundle.find(filters)
    .populate({
      path: 'packingList',
      select: 'packingListCode bookingReference netWeight grossWeight packedBy plannedBundleCount actualBundleCount packingStatus createdAt updatedAt',
      populate: {
        path: 'bookingReference',
        select: 'bookingCode sender receiver pickupPartner date expectedReceivingDate bundleCount status repacking store createdAt updatedAt'
      }
    })
    .populate('container', 'containerCode');

  // Add sorting
  const sortObj: Record<string, 1 | -1> = {};
  if (sortField && typeof sortField === 'string') {
    sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;
  } else {
    sortObj.createdAt = -1; // Default to newest first
  }
  query.sort(sortObj);

  // Add pagination
  query.skip((page - 1) * limit).limit(limit);

  const [bundles, total] = await Promise.all([query.exec(), Bundle.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, bundles, buildPaginationMeta(page, limit, total));
});

/**
 * Get a single ready to ship bundle by ID
 */
export const getReadyToShipBundle = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const bundle = await Bundle.findById(id)
    .populate({
      path: 'packingList',
      select: 'packingListCode bookingReference netWeight grossWeight packedBy plannedBundleCount actualBundleCount packingStatus createdAt updatedAt',
      populate: {
        path: 'bookingReference',
        select: 'bookingCode sender receiver pickupPartner date expectedReceivingDate bundleCount status repacking store createdAt updatedAt'
      }
    })
    .populate('container', 'containerCode');

  if (!bundle) {
    throw ApiError.notFound('Bundle not found');
  }

  // Ensure bundle is in completed status
  if (bundle.status !== 'completed') {
    throw ApiError.badRequest('Bundle is not in completed status and cannot be viewed in Ready to Ship');
  }

  return respond(res, StatusCodes.OK, bundle);
});

/**
 * Update a ready to ship bundle
 */
export const updateReadyToShipBundle = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    bundleNumber, 
    description, 
    quantity, 
    netWeight, 
    grossWeight, 
    actualCount, 
    products,
    priority,
    readyToShipStatus,
    container
  } = req.body;

  const bundle = await Bundle.findById(id);

  if (!bundle) {
    throw ApiError.notFound('Bundle not found');
  }

  // Ensure bundle is in completed status before allowing updates in Ready to Ship
  if (bundle.status !== 'completed') {
    throw ApiError.badRequest('Bundle is not in completed status and cannot be updated in Ready to Ship');
  }

  // Update fields that are allowed in Ready to Ship module
  if (bundleNumber !== undefined) bundle.bundleNumber = bundleNumber;
  if (description !== undefined) bundle.description = description;
  if (quantity !== undefined) bundle.quantity = quantity;
  if (netWeight !== undefined) bundle.netWeight = netWeight;
  if (grossWeight !== undefined) bundle.grossWeight = grossWeight;
  if (actualCount !== undefined) bundle.actualCount = actualCount;
  if (products !== undefined) bundle.products = products;
  if (priority !== undefined) bundle.priority = priority;
  if (readyToShipStatus !== undefined) bundle.readyToShipStatus = readyToShipStatus;
  
  // Handle container assignment - only if readyToShipStatus is 'stuffed' or 'dispatched'
  if ((readyToShipStatus === 'stuffed' || readyToShipStatus === 'dispatched') && container !== undefined && container !== '') {
    if (!Types.ObjectId.isValid(container)) {
      throw ApiError.badRequest('Invalid container ID');
    }
    bundle.container = new Types.ObjectId(container);
  } else if (readyToShipStatus !== 'stuffed' && readyToShipStatus !== 'dispatched') {
    // Clear container if status is neither stuffed nor dispatched
    bundle.container = undefined;
  }

  await bundle.save();

  // Populate the updated bundle before returning
  const updatedBundle = await Bundle.findById(bundle._id)
    .populate({
      path: 'packingList',
      select: 'packingListCode bookingReference netWeight grossWeight packedBy plannedBundleCount actualBundleCount packingStatus createdAt updatedAt',
      populate: {
        path: 'bookingReference',
        select: 'bookingCode sender receiver pickupPartner date expectedReceivingDate bundleCount status repacking store createdAt updatedAt'
      }
    })
    .populate('container', 'containerCode');

  return respond(res, StatusCodes.OK, updatedBundle, { message: 'Bundle updated successfully' });
});

/**
 * Get statistics for ready to ship bundles
 */
export const getReadyToShipStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await Bundle.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: null,
        totalBundles: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalNetWeight: { $sum: { $ifNull: ['$netWeight', 0] } },
        totalGrossWeight: { $sum: { $ifNull: ['$grossWeight', 0] } },
        totalProducts: { $sum: { $size: { $ifNull: ['$products', []] } } }
      }
    }
  ]);

  return respond(res, StatusCodes.OK, stats[0] || {
    totalBundles: 0,
    totalQuantity: 0,
    totalNetWeight: 0,
    totalGrossWeight: 0,
    totalProducts: 0
  });
});