const getRandomNumber = (min = 0, max = 1) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const upperFirstLetter = (value) => {
  return String(value)?.charAt(0)?.toUpperCase() + String(value)?.slice(1);
};

const pickAllowedFields = (source, allowedFields = []) => {
  const updates = {};
  allowedFields.forEach((field) => {
    if (source[field] !== undefined) updates[field] = source[field];
  });
  return updates;
};

const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

const isValidPhone = (phone) => {
  const num = Number(phone);
  return !isNaN(num) && String(num).length === 12;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const normaliseDate = (input) => {
  if (!input) return null;
  const raw = typeof input === "string" ? input : new Date(input).toISOString();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (isNaN(date.getTime())) return null;
  return date;
};

const getWeekdayName = (date) => WEEKDAYS[date.getUTCDay()];

const expandScheduleDates = (days, from, to) => {
  if (!Array.isArray(days) || days.length === 0) return [];
  const start = normaliseDate(from);
  const end = normaliseDate(to);
  if (!start || !end || start > end) return [];
  const allowed = new Set(days);
  const out = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const name = getWeekdayName(cursor);
    if (allowed.has(name)) {
      out.push({ date: new Date(cursor.getTime()), weekday: name });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
};

module.exports = {
  getRandomNumber,
  upperFirstLetter,
  pickAllowedFields,
  getPagination,
  buildPaginationMeta,
  isValidPhone,
  normaliseDate,
  getWeekdayName,
  expandScheduleDates,
};
