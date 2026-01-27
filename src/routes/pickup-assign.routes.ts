import { Router } from 'express';
import {
  createPickupAssign,
  getPickupAssigns,
  getPickupAssignById,
  updatePickupAssign,
  deletePickupAssign,
  updateLRStatus
} from '../controllers/pickup-assign.controller';

const router = Router();

// Create a new pickup assignment
router.post('/', createPickupAssign);

// Get all pickup assignments with pagination and filters
router.get('/', getPickupAssigns);

// Get a single pickup assignment by ID
router.get('/:id', getPickupAssignById);

// Update a pickup assignment
router.put('/:id', updatePickupAssign);

// Delete a pickup assignment
router.delete('/:id', deletePickupAssign);

// Update LR number status
router.patch('/:id/lr-status', updateLRStatus);

export default router;