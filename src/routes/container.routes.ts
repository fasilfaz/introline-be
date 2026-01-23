import { Router } from 'express';
import { body, param } from 'express-validator';

import { listContainers, getContainer, createContainer, updateContainer, deleteContainer } from '../controllers/container.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

// router.use(authenticate, authorize(['manage_containers']));

router.get('/', listContainers);

router.get('/:id', [param('id').isMongoId()], validateRequest, getContainer);

router.post(
  '/',
  [
    body('companyName').notEmpty().trim().withMessage('Company name is required'),
    body('bookingDate').isISO8601().withMessage('Valid booking date is required'),
    body('bookingCharge').isFloat({ min: 0 }).withMessage('Booking charge must be a positive number'),
    body('advancePayment').optional().isFloat({ min: 0 }).withMessage('Advance payment must be a positive number'),
    body('status').optional().isIn(['pending', 'confirmed', 'completed', 'cancelled']).withMessage('Invalid status')
  ],
  validateRequest,
  createContainer
);

router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('companyName').optional().notEmpty().trim().withMessage('Company name cannot be empty'),
    body('bookingDate').optional().isISO8601().withMessage('Valid booking date is required'),
    body('bookingCharge').optional().isFloat({ min: 0 }).withMessage('Booking charge must be a positive number'),
    body('advancePayment').optional().isFloat({ min: 0 }).withMessage('Advance payment must be a positive number'),
    body('status').optional().isIn(['pending', 'confirmed', 'completed', 'cancelled']).withMessage('Invalid status')
  ],
  validateRequest,
  updateContainer
);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteContainer);

export default router;