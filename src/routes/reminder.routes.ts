import { Router } from 'express';
import { body, param } from 'express-validator';

import { listReminders, getReminder, createReminder, updateReminder, deleteReminder } from '../controllers/reminder.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

// router.use(authenticate, authorize(['manage_reminders']));

router.get('/', listReminders);

router.get('/:id', [param('id').isMongoId()], validateRequest, getReminder);

router.post(
  '/',
  [
    body('date').isISO8601().withMessage('Valid date is required'),
    body('description').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Description is required and must be between 1-500 characters'),
    body('purpose').isString().trim().isLength({ min: 1, max: 200 }).withMessage('Purpose is required and must be between 1-200 characters'),
    body('whatsapp').optional().isBoolean().withMessage('WhatsApp must be a boolean value')
  ],
  validateRequest,
  createReminder
);

router.put('/:id', [param('id').isMongoId()], validateRequest, updateReminder);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteReminder);

export default router;