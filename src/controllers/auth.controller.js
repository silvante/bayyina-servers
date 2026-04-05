const texts = require("../data/texts");
const { generateToken } = require("../utils/jwt");
const { getRandomNumber, isValidPhone } = require("../utils/helpers");
const User = require("../models/User");
const VerificationCode = require("../models/VerificationCode");

// Login with phone + password
const login = async (req, res, next) => {
  const password = req.body.password;
  const phone = Number(req.body.phone);

  if (!isValidPhone(phone)) {
    return res.status(400).json({ code: "invalidPhone", message: texts.invalidPhone });
  }

  if (String(password)?.length < 6) {
    return res.status(400).json({ code: "invalidPassword", message: texts.invalidPassword });
  }

  try {
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(400).json({ code: "invalidCredentials", message: texts.invalidCredentials });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ code: "invalidCredentials", message: texts.invalidCredentials });
    }

    const token = generateToken(user);
    const userObj = user.toObject();
    delete userObj.password;

    res.json({ user: userObj, token, code: "loginSuccess", message: texts.loginSuccess });
  } catch (err) {
    next(err);
  }
};

// Send OTP to phone
const sendOtp = async (req, res, next) => {
  const phone = Number(req.body.phone);

  if (!isValidPhone(phone)) {
    return res.status(400).json({ code: "invalidPhone", message: texts.invalidPhone });
  }

  try {
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ code: "userNotFound", message: texts.userNotFound });
    }

    const lastCode = await VerificationCode.findOne({ phone }).sort({ createdAt: -1 });

    if (lastCode) {
      const diff = (Date.now() - lastCode.createdAt.getTime()) / 1000;
      if (diff < 60) {
        return res.json({
          code: "codeAlreadySent",
          createdAt: lastCode.createdAt,
          expiresAt: lastCode.expiresAt,
          message: texts.codeAlreadySent,
        });
      }
    }

    const code = getRandomNumber(100000, 999999);
    const verificationCode = await VerificationCode.create({ code, phone, isSent: true });

    // TODO: integrate actual SMS/bot sending here

    res.json({
      code: "codeSent",
      createdAt: verificationCode.createdAt,
      expiresAt: verificationCode.expiresAt,
      message: texts.codeSent,
    });
  } catch (err) {
    next(err);
  }
};

// Verify OTP → issue token
const verifyOtp = async (req, res, next) => {
  const code = Number(req.body.code);
  const phone = Number(req.body.phone);

  if (!isValidPhone(phone)) {
    return res.status(400).json({ code: "invalidPhone", message: texts.invalidPhone });
  }

  try {
    const verificationCode = await VerificationCode.findOne({ phone, code });
    if (!verificationCode) {
      return res.status(400).json({ code: "codeInvalid", message: texts.codeInvalid });
    }

    const seconds = (Date.now() - verificationCode.createdAt.getTime()) / 1000;
    if (seconds > 300) {
      return res.status(400).json({ code: "codeExpired", message: texts.codeExpired });
    }

    const user = await User.findOne({ phone }).select("-password");
    if (!user) {
      return res.status(404).json({ code: "userNotFound", message: texts.userNotFound });
    }

    const token = generateToken(user);

    res.json({ user, token, code: "loginSuccess", message: texts.loginSuccess });
  } catch (err) {
    next(err);
  }
};

// Get current user profile
const profile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate("avatar").select("-password");
    res.json({ user, code: "profileSuccess", message: texts.profileSuccess });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, sendOtp, verifyOtp, profile };
