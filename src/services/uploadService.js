const sharp = require("sharp");
const s3 = require("../config/s3");
const Image = require("../models/Image");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

const uploadBuffer = async (folder, buffer, mimetype, filename) => {
  const params = {
    Body: buffer,
    ACL: "public-read",
    ContentType: mimetype,
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: `${folder}/${Date.now()}-${filename}`,
  };

  await s3.send(new PutObjectCommand(params));

  return `${process.env.DO_SPACES_ENDPOINT}/${process.env.DO_SPACES_BUCKET}/${params.Key}`;
};

const uploadFile = async (file, userId, folder = "images") => {
  const originalUrl = await uploadBuffer(
    folder,
    file.buffer,
    file.mimetype,
    file.originalname
  );

  const metadata = await sharp(file.buffer).metadata();
  const { width: originalWidth, height: originalHeight } = metadata;

  const resizeAndUpload = async (targetWidth, label) => {
    if (targetWidth > originalWidth) {
      return {
        size: file.size,
        url: originalUrl,
        width: originalWidth,
        height: originalHeight,
        name: file.originalname,
      };
    }

    const buffer = await sharp(file.buffer).resize(targetWidth).toBuffer();
    const meta = await sharp(buffer).metadata();

    const url = await uploadBuffer(
      folder,
      buffer,
      file.mimetype,
      `${label}-${file.originalname}`
    );

    return {
      url,
      size: meta.size,
      width: meta.width,
      height: meta.height,
      name: file.originalname,
    };
  };

  const sm = await resizeAndUpload(200, "small");
  const md = await resizeAndUpload(600, "medium");
  const lg = await resizeAndUpload(1200, "large");

  const image = await Image.create({
    createdBy: userId,
    name: file.originalname,
    sizes: { small: sm, medium: md, large: lg },
    original: {
      size: file.size,
      url: originalUrl,
      width: originalWidth,
      height: originalHeight,
    },
  });

  return image;
};

const uploadFiles = async (files, userId, folder = "images") => {
  return Promise.all(files.map((file) => uploadFile(file, userId, folder)));
};

module.exports = { uploadFile, uploadFiles };
