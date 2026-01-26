import { Router } from 'express';
import { body, param } from 'express-validator';
import validator from 'validator';

import { listBookings, getBooking, createBooking, updateBooking, deleteBooking } from '../controllers/booking.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

// router.use(authenticate, authorize(['manage_bookings']));

router.get('/', listBookings);

router.get('/:id', [param('id').isMongoId()], validateRequest, getBooking);

router.post(
  '/',
  [
    body('sender').isMongoId().withMessage('Valid sender ID is required'),
    body('receiver').isMongoId().withMessage('Valid receiver ID is required'),
    body('receiverBranch').optional().isString().withMessage('Receiver branch must be a string'),
    body('pickupPartner').custom((value) => {
      // Allow special string values or valid MongoDB ObjectId
      if (value === 'Self' || value === 'Central') {
        return true;
      }
      // Otherwise, it must be a valid MongoDB ObjectId
      return validator.isMongoId(value);
    }).withMessage('Valid pickup partner ID is required or "Self" or "Central"'),
    body('date').isISO8601().withMessage('Valid booking date is required'),
    body('expectedReceivingDate').isISO8601().withMessage('Valid expected receiving date is required'),
    body('bundleCount').isInt({ min: 1 }).withMessage('Bundle count must be at least 1'),
    body('status').optional().isIn(['pending', 'success']).withMessage('Status must be pending or success'),
    body('store').optional().isMongoId().withMessage('Valid store ID is required')
  ],
  validateRequest,
  createBooking
);

router.put('/:id', [
  param('id').isMongoId(),
  body('sender').optional().isMongoId().withMessage('Valid sender ID is required'),
  body('receiver').optional().isMongoId().withMessage('Valid receiver ID is required'),
  body('receiverBranch').optional().isString().withMessage('Receiver branch must be a string'),
  body('pickupPartner').optional().custom((value) => {
    // Allow special string values or valid MongoDB ObjectId
    if (value === 'Self' || value === 'Central') {
      return true;
    }
    // Otherwise, it must be a valid MongoDB ObjectId
    return validator.isMongoId(value);
  }).withMessage('Valid pickup partner ID is required or "Self" or "Central"'),
  body('date').optional().isISO8601().withMessage('Valid booking date is required'),
  body('expectedReceivingDate').optional().isISO8601().withMessage('Valid expected receiving date is required'),
  body('bundleCount').optional().isInt({ min: 1 }).withMessage('Bundle count must be at least 1'),
  body('status').optional().isIn(['pending', 'success']).withMessage('Status must be pending or success'),
  body('store').optional().isMongoId().withMessage('Valid store ID is required')
], validateRequest, updateBooking);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteBooking);

export default router;