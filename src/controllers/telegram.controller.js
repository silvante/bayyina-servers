const User = require('../models/User');
const { sendBulk, getTokens } = require('../utils/telegram');

// POST /telegram/send — admin only
const sendMessage = async (req, res, next) => {
  const { message, target, telegramIds } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ code: 'missingField', message: 'Xabar matni kiritilishi shart' });
  }

  const mainToken = getTokens('admin')[0];
  if (!mainToken) {
    return res.status(500).json({ code: 'botTokenMissing', message: 'BOT_TOKEN sozlanmagan' });
  }

  try {
    let recipients = [];

    if (Array.isArray(telegramIds) && telegramIds.length > 0) {
      recipients = telegramIds.map((id) => ({ chatId: String(id), role: 'unknown' }));
    } else {
      const filter = { telegramId: { $exists: true, $ne: null, $ne: '' } };
      if (target === 'students') filter.role = 'student';
      else if (target === 'teachers') filter.role = 'teacher';

      const users = await User.find(filter).select('telegramId role');
      recipients = users
        .filter((u) => u.telegramId)
        .map((u) => ({ chatId: u.telegramId, role: u.role }));
    }

    if (recipients.length === 0) {
      return res.status(400).json({ code: 'noRecipients', message: "Telegram ID bog'langan foydalanuvchilar topilmadi" });
    }

    const result = await sendBulk(recipients, message.trim());

    res.json({
      ...result,
      code: 'messagesSent',
      message: `${result.sent} ta xabar yuborildi`,
    });
  } catch (err) {
    next(err);
  }
};

// GET /telegram/stats — admin only
const getStats = async (req, res, next) => {
  try {
    const [all, students, teachers] = await Promise.all([
      User.countDocuments({ telegramId: { $exists: true, $ne: null, $ne: '' } }),
      User.countDocuments({ role: 'student', telegramId: { $exists: true, $ne: null, $ne: '' } }),
      User.countDocuments({ role: 'teacher', telegramId: { $exists: true, $ne: null, $ne: '' } }),
    ]);
    res.json({ all, students, teachers, code: 'statsFound' });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendMessage, getStats };
