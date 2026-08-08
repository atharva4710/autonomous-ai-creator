import { Router } from 'express';
import {
  getActivity,
  getActivitySummary,
  getLatestActivity,
  getPostExplanation,
} from '../controllers/activity.controller';

const router = Router();

router.get('/activity', getActivity);
router.get('/activity/summary', getActivitySummary);
router.get('/activity/latest', getLatestActivity);
router.get('/posts/:postId/explanation', getPostExplanation);

export default router;
