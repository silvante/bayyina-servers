const axios = require('axios');

// Resolve ordered list of bot tokens to try.
// Students: try STUDENT_BOT_TOKEN first (they register via student bot),
//           then fall back to main bot token.
// Others:   main bot only.
function getTokens(role) {
  const main    = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.MAIN_BOT_TOKEN;
  const student = process.env.STUDENT_BOT_TOKEN;

  if (role === 'student' && student && student !== 'your_student_bot_token_here') {
    return [student, main].filter(Boolean);
  }
  return [main].filter(Boolean);
}

// Send a single Telegram message, trying tokens in order until one succeeds.
// Returns true if sent, false if all tokens fail.
async function sendOne(chatId, text, role) {
  const tokens = getTokens(role);
  for (const token of tokens) {
    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id:    chatId,
        text,
        parse_mode: 'HTML',
      });
      return true;
    } catch { /* try next */ }
  }
  return false;
}

// Send to many recipients, returns { sent, failed, total }.
async function sendBulk(recipients, text) {
  let sent = 0, failed = 0;
  for (const { chatId, role } of recipients) {
    const ok = await sendOne(chatId, text, role);
    ok ? sent++ : failed++;
  }
  return { sent, failed, total: recipients.length };
}

module.exports = { sendOne, sendBulk, getTokens };
