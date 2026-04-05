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

module.exports = {
  getRandomNumber,
  upperFirstLetter,
  pickAllowedFields,
  getPagination,
  buildPaginationMeta,
  isValidPhone,
};
