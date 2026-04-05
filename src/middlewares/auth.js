const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      code: "tokenMissing",
      message: "Token mavjud emas",
    });
  }

  const token = authHeader.split(" ")[1];

  if (token.length > 500) {
    return res.status(401).json({
      code: "invalidToken",
      message: "Yaroqsiz token kiritildi",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      maxAge: "30d",
    });

    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({
        code: "userNotFound",
        message: "Foydalanuvchi topilmadi",
      });
    }

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        code: "tokenExpired",
        message: "Token muddati tugagan",
      });
    }

    return res.status(401).json({
      code: "invalidToken",
      message: "Yaroqsiz token kiritildi",
    });
  }
};

const roleCheck = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        code: "forbidden",
        message: "Ruxsat berilmadi",
      });
    }
    next();
  };
};

module.exports = { auth, roleCheck };
