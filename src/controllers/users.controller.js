const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta, isValidPhone } = require("../utils/helpers");
const User = require("../models/User");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");

// GET /users — admin: all users, teacher: own students, student: only self
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { role } = req.query;

    const filter = {};
    if (role) filter.role = role;

    if (req.user.role === "teacher") {
      // Teachers can only see students (no sensitive management)
      filter.role = "student";
    } else if (req.user.role === "student") {
      // Students can only see themselves
      filter._id = req.user._id;
    }

    const [users, total] = await Promise.all([
      User.find(filter).select("-password").skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      ...buildPaginationMeta(total, page, limit),
      code: "usersFound",
      message: texts.usersFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /users/:id
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ code: "userNotFound", message: texts.userNotFound });
    }
    res.json({ user, code: "usersFound", message: texts.usersFound });
  } catch (err) {
    next(err);
  }
};

// POST /users — admin creates teacher or student
const createUser = async (req, res, next) => {
  const { firstName, lastName, phone, password, role, groupIds, groupId, telegramId, gender, age, source } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({ code: "missingField", message: "Ism va Familiya kiritilishi shart" });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({ code: "invalidPhone", message: texts.invalidPhone });
  }

  if (String(password)?.length < 6) {
    return res.status(400).json({ code: "invalidPassword", message: texts.invalidPassword });
  }

  const effectiveRole = role || "student";
  const allowedRoles = ["teacher", "student"];
  if (!allowedRoles.includes(effectiveRole)) {
    return res.status(400).json({ code: "roleNotAllowed", message: "Ushbu rolga ruxsat berilmaydi" });
  }

  if (effectiveRole === "teacher") {
    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ code: "missingField", message: "O'qituvchi kamida bitta guruhga biriktirilishi shart (groupIds)" });
    }
  }

  if (effectiveRole === "student") {
    if (!groupId) {
      return res.status(400).json({ code: "missingField", message: "Talaba bitta guruhga biriktirilishi shart (groupId)" });
    }
  }

  try {
    const existing = await User.findOne({ phone: Number(phone) });
    if (existing) {
      return res.status(400).json({ code: "phoneAlreadyUsed", message: texts.phoneAlreadyUsed });
    }

    // Validate groups exist before creating the user
    if (effectiveRole === "teacher") {
      const foundGroups = await Group.find({ _id: { $in: groupIds } });
      if (foundGroups.length !== groupIds.length) {
        return res.status(400).json({ code: "groupNotFound", message: "Bir yoki bir nechta guruh topilmadi" });
      }
    }

    if (effectiveRole === "student") {
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(400).json({ code: "groupNotFound", message: "Guruh topilmadi" });
      }
    }

    const user = await User.create({
      firstName,
      lastName,
      phone: Number(phone),
      password,
      role: effectiveRole,
      ...(telegramId && { telegramId }),
      ...(gender && { gender }),
      ...(age && { age: Number(age) }),
      ...(source && { source }),
    });

    // Attach to groups
    if (effectiveRole === "teacher") {
      await Group.updateMany({ _id: { $in: groupIds } }, { teacher: user._id });
    } else {
      await Enrollment.create({ student: user._id, group: groupId });
    }

    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({ user: userObj, code: "userCreated", message: texts.userCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /users/:id — admin updates any user, user updates self
const updateUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;

    // Students can only update themselves
    if (req.user.role === "student" && String(req.user._id) !== String(targetId)) {
      return res.status(403).json({ code: "forbidden", message: texts.forbidden });
    }

    const allowed = ["firstName", "lastName", "telegramId", "gender", "age", "source"];
    if (req.user.role === "admin") allowed.push("role", "password");

    const updates = pickAllowedFields(req.body, allowed);

    const user = await User.findByIdAndUpdate(targetId, updates, { new: true })
      .select("-password");

    if (!user) {
      return res.status(404).json({ code: "userNotFound", message: texts.userNotFound });
    }

    res.json({ user, code: "userUpdated", message: texts.userUpdated });
  } catch (err) {
    next(err);
  }
};

// DELETE /users/:id — admin only
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ code: "userNotFound", message: texts.userNotFound });
    }
    res.json({ code: "userDeleted", message: texts.userDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser };
