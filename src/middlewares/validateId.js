const mongoose = require("mongoose");
const { upperFirstLetter } = require("../utils/helpers");

const validateId = (params) => {
  return (req, res, next) => {
    const paramArray = Array.isArray(params) ? params : [params];

    for (const param of paramArray) {
      const id = req.params[param];

      if (!id) {
        return res.status(400).json({
          code: "missingParameter",
          message: `${param} topilmadi`,
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          code: "invalidId",
          message: `${upperFirstLetter(param)} noto'g'ri kiritildi`,
        });
      }
    }

    next();
  };
};

module.exports = validateId;
