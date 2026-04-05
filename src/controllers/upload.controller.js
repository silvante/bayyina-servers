const texts = require("../data/texts");
const { uploadFile } = require("../services/uploadService");

const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: "noFileProvided", message: texts.noFileProvided });
    }

    const image = await uploadFile(req.file, req.user._id);

    res.status(201).json({ image, code: "imageUploaded", message: texts.imageUploaded });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadImage };
