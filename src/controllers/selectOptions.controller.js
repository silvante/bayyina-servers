const LeadSource      = require("../models/LeadSource");
const CourseType      = require("../models/CourseType");
const RejectionReason = require("../models/RejectionReason");

// ─── Static enum options (system values — not editable by admin) ──────────────
const STATIC = {
  lead_status: [
    { _id: "new",        value: "new",        label: "Kutilmoqda"      },
    { _id: "contacted",  value: "contacted",  label: "Bog'lashildi"    },
    { _id: "interested", value: "interested", label: "Qiziqmoqda"      },
    { _id: "scheduled",  value: "scheduled",  label: "Rejalashtirildi" },
    { _id: "converted",  value: "converted",  label: "Qabul qilindi"   },
    { _id: "rejected",   value: "rejected",   label: "Bekor qilindi"   },
  ],
  enrollment_status: [
    { _id: "active",    value: "active",    label: "Faol"              },
    { _id: "completed", value: "completed", label: "Tugatilgan"        },
    { _id: "dropped",   value: "dropped",   label: "Tashlab ketilgan"  },
  ],
  payment_status: [
    { _id: "pending", value: "pending", label: "Kutilmoqda"     },
    { _id: "paid",    value: "paid",    label: "To'langan"      },
    { _id: "overdue", value: "overdue", label: "Muddati o'tgan" },
  ],
  salary_status: [
    { _id: "pending", value: "pending", label: "Kutilmoqda" },
    { _id: "paid",    value: "paid",    label: "To'langan"  },
  ],
  gender: [
    { _id: "male",   value: "male",   label: "Erkak" },
    { _id: "female", value: "female", label: "Ayol"  },
  ],
  user_role: [
    { _id: "student", value: "student", label: "O'quvchi"   },
    { _id: "teacher", value: "teacher", label: "O'qituvchi" },
    { _id: "admin",   value: "admin",   label: "Admin"      },
  ],
  days: [
    { _id: "Monday",    value: "Monday",    label: "Dushanba" },
    { _id: "Tuesday",   value: "Tuesday",   label: "Seshanba" },
    { _id: "Wednesday", value: "Wednesday", label: "Chorshanba" },
    { _id: "Thursday",  value: "Thursday",  label: "Payshanba" },
    { _id: "Friday",    value: "Friday",    label: "Juma"      },
    { _id: "Saturday",  value: "Saturday",  label: "Shanba"    },
    { _id: "Sunday",    value: "Sunday",    label: "Yakshanba" },
  ],
  entity_type: [
    { _id: "Lead",       value: "Lead",       label: "Murojaat"       },
    { _id: "User",       value: "User",       label: "Foydalanuvchi"  },
    { _id: "Group",      value: "Group",      label: "Guruh"          },
    { _id: "Enrollment", value: "Enrollment", label: "Ro'yxatga olish" },
    { _id: "Payment",    value: "Payment",    label: "To'lov"         },
    { _id: "Attendance", value: "Attendance", label: "Davomat"        },
    { _id: "Salary",     value: "Salary",     label: "Maosh"          },
  ],
};

// ─── DB-backed option fetchers ────────────────────────────────────────────────
const DB_FETCHERS = {
  lead_source: async () => {
    const docs = await LeadSource.find().sort({ createdAt: 1 }).lean();
    return docs.map((d) => ({ _id: d._id, value: String(d._id), label: d.name }));
  },
  course_type: async () => {
    const docs = await CourseType.find().sort({ createdAt: 1 }).lean();
    return docs.map((d) => ({ _id: d._id, value: String(d._id), label: d.name }));
  },
  rejection_reason: async () => {
    const docs = await RejectionReason.find().sort({ createdAt: 1 }).lean();
    return docs.map((d) => ({ _id: d._id, value: String(d._id), label: d.title }));
  },
};

const VALID_TYPES = new Set([...Object.keys(STATIC), ...Object.keys(DB_FETCHERS)]);

// GET /select-options?type=lead_source
const getSelectOptions = async (req, res, next) => {
  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({ code: "missingField", message: "type parametri talab etiladi" });
    }

    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({ code: "invalidType", message: `Noma'lum tur: ${type}` });
    }

    const options = DB_FETCHERS[type]
      ? await DB_FETCHERS[type]()
      : STATIC[type];

    return res.json({ options, type });
  } catch (err) {
    next(err);
  }
};

// GET /select-options/types — list of all available types
const getTypes = async (req, res) => {
  const types = [
    { type: "lead_source",       label: "Lead manbalari",     kind: "dynamic" },
    { type: "course_type",       label: "Kurs turlari",        kind: "dynamic" },
    { type: "rejection_reason",  label: "Rad etish sabablari", kind: "dynamic" },
    { type: "lead_status",       label: "Lead holatlari",      kind: "static"  },
    { type: "enrollment_status", label: "Ro'yxat holatlari",   kind: "static"  },
    { type: "payment_status",    label: "To'lov holatlari",    kind: "static"  },
    { type: "salary_status",     label: "Maosh holatlari",     kind: "static"  },
    { type: "gender",            label: "Jins",                kind: "static"  },
    { type: "user_role",         label: "Foydalanuvchi roli",  kind: "static"  },
    { type: "days",              label: "Hafta kunlari",       kind: "static"  },
    { type: "entity_type",       label: "Obyekt turlari",      kind: "static"  },
  ];
  res.json({ types });
};

module.exports = { getSelectOptions, getTypes };
