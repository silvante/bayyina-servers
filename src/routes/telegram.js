const express = require('express');
const router = express.Router();

const { sendMessage, getStats } = require('../controllers/telegram.controller');
const { auth, roleCheck } = require('../middlewares/auth');

/**
 * GET /telegram/stats
 * How many users have linked Telegram ID
 * Access: admin only
 */
router.get('/stats', auth, roleCheck(['admin']), getStats);

/**
 * POST /telegram/send
 * Send Telegram message to users
 * Body: { message, target?: 'all'|'students'|'teachers', telegramIds?: string[] }
 * Access: admin only
 */
router.post('/send', auth, roleCheck(['admin']), sendMessage);

module.exports = router;
