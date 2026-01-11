import { Router } from 'express';
import { body, param } from 'express-validator';

import { listDeliveryPartners, getDeliveryPartner, createDeliveryPartner, updateDeliveryPartner, deleteDeliveryPartner } from '../controllers/delivery-partner.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

// router.use(authenticate, authorize(['manage_delivery_partners']));

router.get('/', listDeliveryPartners);

router.get('/:id', [param('id').isMongoId()], validateRequest, getDeliveryPartner);

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('phoneNumber').notEmpty().withMessage('Phone number is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('country').notEmpty().withMessage('Country is required'),
    body('status').optional().isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive')
  ],
  validateRequest,
  createDeliveryPartner
);

router.put('/:id', [param('id').isMongoId()], validateRequest, updateDeliveryPartner);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteDeliveryPartner);

export default router;