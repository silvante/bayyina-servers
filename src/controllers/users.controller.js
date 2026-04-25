const texts = require("../data/texts");
const {
  pickAllowedFields,
  getPagination,
  buildPaginationMeta,
  isValidPhone,
  buildSearchRegex,
} = require("../utils/helpers");
const User = require("../models/User");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");
const recordService = require("../services/recordService");

const USER_UPDATABLE_FIELDS = [
  "firstName",
  "lastName",
  "telegramId",
  "gender",
  "age",
  "source",
  "role",
];

const roleToEventType = (role) => {
  if (role === "teacher") return "USER_TEACHER_CREATED";
  if (role === "admin") return "USER_ADMIN_CREATED";
  return "USER_STUDENT_CREATED";
};

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
      User.find(filter)
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
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
    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ code: "userNotFound", message: texts.userNotFound });
    }
    res.json({ user, code: "usersFound", message: texts.usersFound });
  } catch (err) {
    next(err);
  }
};

// POST /users — admin creates teacher or student
const createUser = async (req, res, next) => {
  const {
    firstName,
    lastName,
    phone,
    password,
    role,
    groupIds,
    telegramId,
    gender,
    age,
    source,
  } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({
      code: "missingField",
      message: "Ism va Familiya kiritilishi shart",
    });
  }

  if (!isValidPhone(phone)) {
    return res
      .status(400)
      .json({ code: "invalidPhone", message: texts.invalidPhone });
  }

  if (String(password)?.length < 6) {
    return res
      .status(400)
      .json({ code: "invalidPassword", message: texts.invalidPassword });
  }

  const effectiveRole = role || "student";
  const allowedRoles = ["teacher", "student"];
  if (!allowedRoles.includes(effectiveRole)) {
    return res.status(400).json({
      code: "roleNotAllowed",
      message: "Ushbu rolga ruxsat berilmaydi",
    });
  }

  // they should be uptional

  // if (effectiveRole === "teacher") {
  //   if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
  //     return res.status(400).json({ code: "missingField", message: "O'qituvchi kamida bitta guruhga biriktirilishi shart (groupIds)" });
  //   }
  // }

  // if (effectiveRole === "student") {
  //   if (!groupId) {
  //     return res.status(400).json({ code: "missingField", message: "Talaba bitta guruhga biriktirilishi shart (groupId)" });
  //   }
  // }

  try {
    const existing = await User.findOne({ phone: Number(phone) });
    if (existing) {
      return res
        .status(400)
        .json({ code: "phoneAlreadyUsed", message: texts.phoneAlreadyUsed });
    }

    // Validate groups exist before creating the user
    if (
      effectiveRole === "teacher" &&
      groupIds &&
      Array.isArray(groupIds) &&
      groupIds.length !== 0
    ) {
      const foundGroups = await Group.find({ _id: { $in: groupIds } });
      if (foundGroups.length !== groupIds.length) {
        return res.status(400).json({
          code: "groupNotFound",
          message: "Bir yoki bir nechta guruh topilmadi",
        });
      }
    }

    if (
      effectiveRole === "student" &&
      groupIds &&
      Array.isArray(groupIds) &&
      groupIds.length !== 0
    ) {
      const foundGroups = await Group.find({ _id: { $in: groupIds } });
      if (foundGroups.length !== groupIds.length) {
        return res.status(400).json({
          code: "groupNotFound",
          message: "Bir yoki bir nechta guruh topilmadi",
        });
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

    const enrolledDate = new Date();
    const resolvedPaymentDay = enrolledDate.getDate();

    const actor = recordService.actorFromReq(req);

    await recordService.createRecord({
      eventType: roleToEventType(effectiveRole),
      entityType: "User",
      entityId: user._id,
      entity: user,
      actor,
      refs: {
        studentId: effectiveRole === "student" ? user._id : undefined,
        teacherId: effectiveRole === "teacher" ? user._id : undefined,
      },
    });

    // Attach to groups
    let createdEnrollments = [];
    if (effectiveRole === "teacher") {
      if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
        await Group.updateMany(
          { _id: { $in: groupIds } },
          { teacher: user._id },
        );
      }
    } else {
      if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
        await Enrollment.insertMany(
          groupIds.map((gid) => ({
            student: user._id,
            group: gid,
            enrolledAt: enrolledDate,
            paymentDay: resolvedPaymentDay,
            nextPaymentDate: enrolledDate,
          })),
        );

        createdEnrollments = await Enrollment.find({ student: user._id })
          .populate({ path: "group", select: "name" });

        for (const enr of createdEnrollments) {
          await recordService.createRecord({
            eventType: "ENROLLMENT_CREATED",
            entityType: "Enrollment",
            entityId: enr._id,
            entity: { ...enr.toObject(), student: user },
            actor,
            refs: {
              studentId: user._id,
              groupId: enr.group?._id,
              enrollmentId: enr._id,
            },
          });
        }
      }
    }

    const userObj = user.toObject();
    delete userObj.password;

    if (effectiveRole === "student") {
      const enrollments = await Enrollment.find({ student: user._id })
        .select("-student -__v")
        .populate("group", "name description price schedule room");
      userObj.enrollments = enrollments;
    }

    res
      .status(201)
      .json({ user: userObj, code: "userCreated", message: texts.userCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /users/:id — admin updates any user, user updates self
const updateUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;

    // Students can only update themselves
    if (
      req.user.role === "student" &&
      String(req.user._id) !== String(targetId)
    ) {
      return res
        .status(403)
        .json({ code: "forbidden", message: texts.forbidden });
    }

    const allowed = [
      "firstName",
      "lastName",
      "telegramId",
      "gender",
      "age",
      "source",
    ];
    if (req.user.role === "admin") allowed.push("role", "password");

    const updates = pickAllowedFields(req.body, allowed);

    const existing = await User.findById(targetId).select("-password");
    if (!existing) {
      return res
        .status(404)
        .json({ code: "userNotFound", message: texts.userNotFound });
    }

    const user = await User.findByIdAndUpdate(targetId, updates, {
      new: true,
    }).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ code: "userNotFound", message: texts.userNotFound });
    }

    const diff = recordService.diffFields(
      existing.toObject(),
      user.toObject(),
      USER_UPDATABLE_FIELDS,
    );

    if (diff) {
      await recordService.createRecord({
        eventType: "USER_UPDATED",
        entityType: "User",
        entityId: user._id,
        entity: user,
        actor: recordService.actorFromReq(req),
        refs: {
          studentId: user.role === "student" ? user._id : undefined,
          teacherId: user.role === "teacher" ? user._id : undefined,
        },
        changes: diff,
      });
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
      return res
        .status(404)
        .json({ code: "userNotFound", message: texts.userNotFound });
    }

    await recordService.createRecord({
      eventType: "USER_DELETED",
      entityType: "User",
      entityId: user._id,
      entity: user,
      actor: recordService.actorFromReq(req),
      refs: {
        studentId: user.role === "student" ? user._id : undefined,
        teacherId: user.role === "teacher" ? user._id : undefined,
      },
    });

    res.json({ code: "userDeleted", message: texts.userDeleted });
  } catch (err) {
    next(err);
  }
};

// GET /users/teachers — admin only
const getTeachers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const [users, total] = await Promise.all([
      User.find({ role: "teacher" })
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments({ role: "teacher" }),
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

// GET /users/students — admin only
const getStudents = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const [students, total] = await Promise.all([
      User.find({ role: "student" })
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments({ role: "student" }),
    ]);

    const studentIds = students.map((s) => s._id);
    const enrollments = await Enrollment.find({ student: { $in: studentIds } })
      .select("-student -__v")
      .populate("group", "name description price schedule room");

    const enrollmentsByStudent = {};
    for (const enrollment of enrollments) {
      const sid = String(enrollment.student);
      if (!enrollmentsByStudent[sid]) enrollmentsByStudent[sid] = [];
      enrollmentsByStudent[sid].push(enrollment);
    }

    const users = students.map((student) => ({
      ...student.toObject(),
      enrollments: enrollmentsByStudent[String(student._id)] || [],
    }));

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

// Builds a $or clause for searching users by free-text q across multiple fields.
// Searches firstName, lastName, source, gender (text fields) and phone, age (numeric).
const buildUserSearchOr = (q) => {
  const regex = buildSearchRegex(q);
  if (!regex) return null;
  const orClauses = [
    { firstName: regex },
    { lastName: regex },
    { source: regex },
    { gender: regex },
  ];
  const numeric = Number(String(q).trim());
  if (!Number.isNaN(numeric)) {
    orClauses.push({ phone: numeric });
    orClauses.push({ age: numeric });
  }
  return orClauses;
};

// Applies field-level filters from query to a user filter object.
const applyUserFieldFilters = (filter, query) => {
  if (query.firstName) filter.firstName = buildSearchRegex(query.firstName);
  if (query.lastName) filter.lastName = buildSearchRegex(query.lastName);
  if (query.gender) filter.gender = String(query.gender).toLowerCase();
  if (query.source) filter.source = buildSearchRegex(query.source);
  if (query.phone !== undefined && query.phone !== "") {
    const phoneNum = Number(query.phone);
    if (!Number.isNaN(phoneNum)) filter.phone = phoneNum;
  }
  if (query.age !== undefined && query.age !== "") {
    const ageNum = Number(query.age);
    if (!Number.isNaN(ageNum)) filter.age = ageNum;
  }
  if (query.minAge !== undefined || query.maxAge !== undefined) {
    const ageRange = {};
    const min = Number(query.minAge);
    const max = Number(query.maxAge);
    if (!Number.isNaN(min)) ageRange.$gte = min;
    if (!Number.isNaN(max)) ageRange.$lte = max;
    if (Object.keys(ageRange).length) filter.age = ageRange;
  }
};

// GET /users/students/search — admin only
const searchStudents = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { role: "student" };

    applyUserFieldFilters(filter, req.query);

    const orClauses = buildUserSearchOr(req.query.q);
    if (orClauses) filter.$or = orClauses;

    const [students, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    const studentIds = students.map((s) => s._id);
    const enrollments = await Enrollment.find({ student: { $in: studentIds } })
      .select("-student -__v")
      .populate("group", "name description price schedule room");

    const enrollmentsByStudent = {};
    for (const enrollment of enrollments) {
      const sid = String(enrollment.student);
      if (!enrollmentsByStudent[sid]) enrollmentsByStudent[sid] = [];
      enrollmentsByStudent[sid].push(enrollment);
    }

    const users = students.map((student) => ({
      ...student.toObject(),
      enrollments: enrollmentsByStudent[String(student._id)] || [],
    }));

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

// GET /users/teachers/search — admin only
const searchTeachers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { role: "teacher" };

    applyUserFieldFilters(filter, req.query);

    const orClauses = buildUserSearchOr(req.query.q);
    if (orClauses) filter.$or = orClauses;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
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

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getTeachers,
  getStudents,
  searchStudents,
  searchTeachers,
};
