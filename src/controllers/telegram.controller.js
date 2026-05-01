const axios = require('axios');
const User = require('../models/User');

// POST /telegram/send — admin only
const sendMessage = async (req, res, next) => {
  const { message, target, telegramIds } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ code: 'missingField', message: 'Xabar matni kiritilishi shart' });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.MAIN_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return res.status(500).json({ code: 'botTokenMissing', message: 'BOT_TOKEN sozlanmagan' });
  }

  try {
    let ids = [];

    if (Array.isArray(telegramIds) && telegramIds.length > 0) {
      ids = telegramIds.map(String);
    } else {
      const filter = { telegramId: { $exists: true, $ne: null, $ne: '' } };
      if (target === 'students') filter.role = 'student';
      else if (target === 'teachers') filter.role = 'teacher';

      const users = await User.find(filter).select('telegramId');
      ids = users.map((u) => u.telegramId).filter(Boolean);
    }

    if (ids.length === 0) {
      return res.status(400).json({ code: 'noRecipients', message: "Telegram ID bog'langan foydalanuvchilar topilmadi" });
    }

    let sent = 0;
    let failed = 0;

    for (const chatId of ids) {
      try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: message.trim(),
          parse_mode: 'HTML',
        });
        sent++;
      } catch {
        failed++;
      }
    }

    res.json({
      sent,
      failed,
      total: ids.length,
      code: 'messagesSent',
      message: `${sent} ta xabar yuborildi`,
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
