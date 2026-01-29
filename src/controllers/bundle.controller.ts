import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { Bundle } from '../models/bundle.model';
import { PackingList } from '../models/packing-list.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listBundles = asyncHandler(async (req: Request, res: Response) => {
  const { packingListId, status, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (packingListId && typeof packingListId === 'string') {
    if (!Types.ObjectId.isValid(packingListId)) {
      throw ApiError.badRequest('Invalid packing list ID');
    }
    filters.packingList = new Types.ObjectId(packingListId);
  }

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { description: new RegExp(search, 'i') }
    ];
  }

  const query = Bundle.find(filters)
    .populate('packingList', 'packingListCode bookingReference');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [bundles, total] = await Promise.all([query.exec(), Bundle.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, bundles, buildPaginationMeta(page, limit, total));
});

export const getBundle = asyncHandler(async (req: Request, res: Response) => {
  const bundle = await Bundle.findById(req.params.id)
    .populate('packingList', 'packingListCode bookingReference');

  if (!bundle) {
    throw ApiError.notFound('Bundle not found');
  }

  return respond(res, StatusCodes.OK, bundle);
});

export const createBundle = asyncHandler(async (req: Request, res: Response) => {
  const { 
    packingListId, 
    bundleNumber, 
    description, 
    quantity, 
    netWeight, 
    grossWeight, 
    actualCount, 
    status,
    products 
  } = req.body;

  // Validate packing list exists
  const packingList = await PackingList.findById(packingListId);
  if (!packingList) {
    throw ApiError.badRequest('Invalid packing list ID');
  }

  // Check if bundle number already exists for this packing list
  const existingBundle = await Bundle.findOne({ 
    packingList: packingListId, 
    bundleNumber 
  });
  if (existingBundle) {
    throw ApiError.conflict(`Bundle number ${bundleNumber} already exists for this packing list`);
  }

  console.log('Creating bundle with data:', {
    packingListId,
    bundleNumber,
    description,
    quantity,
    netWeight,
    grossWeight,
    actualCount,
    status: status || 'pending',
    products: products || []
  });

  const bundle = await Bundle.create({
    packingList: new Types.ObjectId(packingListId),
    bundleNumber,
    description,
    quantity,
    netWeight,
    grossWeight,
    actualCount,
    status: status || 'pending',
    products: products || []
  });

  console.log('Created bundle:', bundle);

  // Populate the response
  const populatedBundle = await Bundle.findById(bundle._id)
    .populate('packingList', 'packingListCode bookingReference');

  return respond(res, StatusCodes.CREATED, populatedBundle, { message: 'Bundle created successfully' });
});

export const updateBundle = asyncHandler(async (req: Request, res: Response) => {
  const bundle = await Bundle.findById(req.params.id);

  if (!bundle) {
    throw ApiError.notFound('Bundle not found');
  }

  const { 
    packingListId, 
    bundleNumber, 
    description, 
    quantity, 
    netWeight, 
    grossWeight, 
    actualCount, 
    status,
    products 
  } = req.body;

  // If packing list is being changed, validate it
  if (packingListId && packingListId !== bundle.packingList.toString()) {
    const packingList = await PackingList.findById(packingListId);
    if (!packingList) {
      throw ApiError.badRequest('Invalid packing list ID');
    }

    // Check if bundle number already exists for this new packing list
    const existingBundle = await Bundle.findOne({ 
      packingList: packingListId,
      bundleNumber,
      _id: { $ne: bundle._id }
    });
    if (existingBundle) {
      throw ApiError.conflict(`Bundle number ${bundleNumber} already exists for this packing list`);
    }

    bundle.packingList = new Types.ObjectId(packingListId);
  }

  // If bundle number is being changed, check for conflicts
  if (bundleNumber !== undefined && bundleNumber !== bundle.bundleNumber) {
    const existingBundle = await Bundle.findOne({ 
      packingList: bundle.packingList,
      bundleNumber,
      _id: { $ne: bundle._id }
    });
    if (existingBundle) {
      throw ApiError.conflict(`Bundle number ${bundleNumber} already exists for this packing list`);
    }
    bundle.bundleNumber = bundleNumber;
  }

  // Update other fields
  if (description !== undefined) bundle.description = description;
  if (quantity !== undefined) bundle.quantity = quantity;
  if (netWeight !== undefined) bundle.netWeight = netWeight;
  if (grossWeight !== undefined) bundle.grossWeight = grossWeight;
  if (actualCount !== undefined) bundle.actualCount = actualCount;
  if (status !== undefined) bundle.status = status;
  if (products !== undefined) bundle.products = products;

  await bundle.save();

  // Populate the response
  const updatedBundle = await Bundle.findById(bundle._id)
    .populate('packingList', 'packingListCode bookingReference');

  return respond(res, StatusCodes.OK, updatedBundle, { message: 'Bundle updated successfully' });
});

export const deleteBundle = asyncHandler(async (req: Request, res: Response) => {
  const bundle = await Bundle.findById(req.params.id);

  if (!bundle) {
    throw ApiError.notFound('Bundle not found');
  }

  await bundle.deleteOne();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Bundle deleted successfully' });
});

// Additional endpoints for bundle management

export const getBundlesByPackingList = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid packing list ID');
  }

  const bundles = await Bundle.find({ packingList: id })
    .sort({ bundleNumber: 1 });

  return respond(res, StatusCodes.OK, bundles);
});

export const getBundleStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params; // packing list id
  
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid packing list ID');
  }

  const stats = await Bundle.aggregate([
    { $match: { packingList: new Types.ObjectId(id) } },
    {
      $group: {
        _id: null,
        totalBundles: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalNetWeight: { $sum: { $ifNull: ['$netWeight', 0] } },
        totalGrossWeight: { $sum: { $ifNull: ['$grossWeight', 0] } },
        totalProducts: { $sum: { $size: { $ifNull: ['$products', []] } } },
        statusCounts: {
          $push: '$status'
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalBundles: 1,
        totalQuantity: 1,
        totalNetWeight: 1,
        totalGrossWeight: 1,
        totalProducts: 1,
        statusCounts: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: ['$statusCounts'] },
              as: 'status',
              in: {
                k: '$$status',
                v: {
                  $size: {
                    $filter: {
                      input: '$statusCounts',
                      cond: { $eq: ['$$this', '$$status'] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  ]);

  return respond(res, StatusCodes.OK, stats[0] || {
    totalBundles: 0,
    totalQuantity: 0,
    totalNetWeight: 0,
    totalGrossWeight: 0,
    totalProducts: 0,
    statusCounts: {}
  });
});