import { Request, Response } from 'express';
import { PickupAssign, IPickupAssign, LRNumber } from '../models/pickup-assign.model';
import { PickupPartner } from '../models/pickup-partner.model';
import mongoose from 'mongoose';

// Create a new pickup assignment
export const createPickupAssign = async (req: Request, res: Response) => {
  try {
    const { transportPartnerId, lrNumbers, assignDate, status } = req.body;

    // Validate transport partner exists
    const transportPartner = await PickupPartner.findById(transportPartnerId);
    if (!transportPartner) {
      return res.status(404).json({
        success: false,
        message: 'Transport partner not found'
      });
    }

    // Validate LR numbers
    if (!lrNumbers || !Array.isArray(lrNumbers) || lrNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one LR number is required'
      });
    }

    // Create pickup assignment
    const pickupAssign = new PickupAssign({
      transportPartnerId,
      lrNumbers: lrNumbers.map((lr: any) => ({
        lrNumber: lr.lrNumber,
        status: lr.status || 'Not Collected'
      })),
      assignDate: new Date(assignDate),
      status: status || 'Pending'
    });

    await pickupAssign.save();
    
    // Populate transport partner details
    await pickupAssign.populate('transportPartner');

    res.status(201).json({
      success: true,
      message: 'Pickup assignment created successfully',
      data: pickupAssign
    });
  } catch (error: any) {
    console.error('Error creating pickup assignment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get all pickup assignments with pagination and filters
export const getPickupAssigns = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      transportPartnerId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter: any = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (transportPartnerId) {
      filter.transportPartnerId = transportPartnerId;
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Get total count for pagination
    const total = await PickupAssign.countDocuments(filter);

    // Get pickup assignments with populated transport partner
    let query = PickupAssign.find(filter)
      .populate('transportPartner', 'name phoneNumber')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    // Add search functionality if provided
    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      
      // First get transport partners that match the search
      const matchingPartners = await PickupPartner.find({
        $or: [
          { name: searchRegex },
          { phoneNumber: searchRegex }
        ]
      }).select('_id');

      const partnerIds = matchingPartners.map(p => p._id);

      // Update filter to include search criteria
      filter.$or = [
        { transportPartnerId: { $in: partnerIds } },
        { 'lrNumbers.lrNumber': searchRegex }
      ];

      // Re-run query with updated filter
      query = PickupAssign.find(filter)
        .populate('transportPartner', 'name phoneNumber')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum);
    }

    const pickupAssigns = await query.exec();

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: pickupAssigns,
      meta: {
        total,
        totalPages,
        currentPage: pageNum,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error: any) {
    console.error('Error fetching pickup assignments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Get a single pickup assignment by ID
export const getPickupAssignById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pickup assignment ID'
      });
    }

    const pickupAssign = await PickupAssign.findById(id)
      .populate('transportPartner', 'name phoneNumber price');

    if (!pickupAssign) {
      return res.status(404).json({
        success: false,
        message: 'Pickup assignment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: pickupAssign
    });
  } catch (error: any) {
    console.error('Error fetching pickup assignment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update a pickup assignment
export const updatePickupAssign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { transportPartnerId, lrNumbers, assignDate, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pickup assignment ID'
      });
    }

    // Validate transport partner exists if provided
    if (transportPartnerId) {
      const transportPartner = await PickupPartner.findById(transportPartnerId);
      if (!transportPartner) {
        return res.status(404).json({
          success: false,
          message: 'Transport partner not found'
        });
      }
    }

    // Validate LR numbers if provided
    if (lrNumbers && (!Array.isArray(lrNumbers) || lrNumbers.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'At least one LR number is required'
      });
    }

    const updateData: any = {};
    
    if (transportPartnerId) updateData.transportPartnerId = transportPartnerId;
    if (lrNumbers) {
      updateData.lrNumbers = lrNumbers.map((lr: any) => ({
        lrNumber: lr.lrNumber,
        status: lr.status || 'Not Collected'
      }));
    }
    if (assignDate) updateData.assignDate = new Date(assignDate);
    if (status) updateData.status = status;

    const pickupAssign = await PickupAssign.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('transportPartner', 'name phoneNumber price');

    if (!pickupAssign) {
      return res.status(404).json({
        success: false,
        message: 'Pickup assignment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Pickup assignment updated successfully',
      data: pickupAssign
    });
  } catch (error: any) {
    console.error('Error updating pickup assignment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Delete a pickup assignment
export const deletePickupAssign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pickup assignment ID'
      });
    }

    const pickupAssign = await PickupAssign.findByIdAndDelete(id);

    if (!pickupAssign) {
      return res.status(404).json({
        success: false,
        message: 'Pickup assignment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Pickup assignment deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting pickup assignment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update LR number status
export const updateLRStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { lrNumber, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pickup assignment ID'
      });
    }

    if (!lrNumber || !status) {
      return res.status(400).json({
        success: false,
        message: 'LR number and status are required'
      });
    }

    if (!['Collected', 'Not Collected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "Collected" or "Not Collected"'
      });
    }

    const pickupAssign = await PickupAssign.findOneAndUpdate(
      { _id: id, 'lrNumbers.lrNumber': lrNumber },
      { $set: { 'lrNumbers.$.status': status } },
      { new: true, runValidators: true }
    ).populate('transportPartner', 'name phoneNumber price');

    if (!pickupAssign) {
      return res.status(404).json({
        success: false,
        message: 'Pickup assignment or LR number not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'LR number status updated successfully',
      data: pickupAssign
    });
  } catch (error: any) {
    console.error('Error updating LR status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};