import { Router } from 'express';
import { body, param } from 'express-validator';

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
    body('pickupPartner').isMongoId().withMessage('Valid pickup partner ID is required'),
    body('date').isISO8601().withMessage('Valid booking date is required'),
    body('expectedReceivingDate').isISO8601().withMessage('Valid expected receiving date is required'),
    body('bundleCount').isInt({ min: 1 }).withMessage('Bundle count must be at least 1'),
    body('status').optional().isIn(['pending', 'success']).withMessage('Status must be pending or success')
  ],
  validateRequest,
  createBooking
);

router.put('/:id', [param('id').isMongoId()], validateRequest, updateBooking);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteBooking);

export default router;