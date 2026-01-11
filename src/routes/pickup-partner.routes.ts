import { Router } from 'express';
import { body, param } from 'express-validator';

import { listPickupPartners, getPickupPartner, createPickupPartner, updatePickupPartner, deletePickupPartner } from '../controllers/pickup-partner.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

// router.use(authenticate, authorize(['manage_pickup_partners']));

router.get('/', listPickupPartners);

router.get('/:id', [param('id').isMongoId()], validateRequest, getPickupPartner);

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('phoneNumber').notEmpty().withMessage('Phone number is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('status').optional().isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive')
  ],
  validateRequest,
  createPickupPartner
);

router.put('/:id', [param('id').isMongoId()], validateRequest, updatePickupPartner);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deletePickupPartner);

export default router;