const fullName = (u) => {
  if (!u) return "Noma'lum";
  const parts = [u.firstName, u.lastName].filter(Boolean);
  return parts.join(" ").trim() || "Noma'lum";
};

const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const fmtAmount = (n) => {
  if (n == null) return "0";
  return Number(n).toLocaleString("uz-UZ");
};

const LEAD_STATUS_LABELS = {
  new: "yangi",
  contacted: "bog'lanildi",
  interested: "qiziqqan",
  scheduled: "rejalashtirilgan",
  converted: "o'quvchiga aylantirildi",
  rejected: "rad etildi",
};

const ENROLLMENT_STATUS_LABELS = {
  active: "faol",
  completed: "yakunlangan",
  dropped: "chiqib ketgan",
};

const formatters = {
  // Users
  USER_STUDENT_CREATED: (u, a) =>
    `${a.name} yangi o'quvchi ${fullName(u)} ni qo'shdi`,
  USER_TEACHER_CREATED: (u, a) =>
    `${a.name} yangi o'qituvchi ${fullName(u)} ni qo'shdi`,
  USER_ADMIN_CREATED: (u, a) =>
    `${a.name} yangi admin ${fullName(u)} ni qo'shdi`,
  USER_UPDATED: (u, a) =>
    `${a.name} foydalanuvchi ${fullName(u)} ma'lumotlarini yangiladi`,
  USER_DELETED: (u, a) =>
    `${a.name} foydalanuvchi ${fullName(u)} ni o'chirdi`,

  // Leads
  LEAD_CREATED: (l, a) =>
    `${a.name} yangi murojaat "${l?.firstName ?? "—"}" ni qo'shdi`,
  LEAD_UPDATED: (l, a) =>
    `${a.name} "${l?.firstName ?? "—"}" murojaatini yangiladi`,
  LEAD_STATUS_CHANGED: (l, a, m) => {
    const from = LEAD_STATUS_LABELS[m?.from] ?? m?.from ?? "—";
    const to = LEAD_STATUS_LABELS[m?.to] ?? m?.to ?? "—";
    return `"${l?.firstName ?? "—"}" murojaati holati: ${from} → ${to}`;
  },
  LEAD_DELETED: (l, a) =>
    `${a.name} "${l?.firstName ?? "—"}" murojaatini o'chirdi`,
  LEAD_LINK_CLICKED: (l) =>
    `"${l?.firstName ?? "—"}" murojaati havolasini bosdi`,

  // Enrollments
  ENROLLMENT_CREATED: (e, a) =>
    `${fullName(e?.student)} "${e?.group?.name ?? "—"}" guruhiga yozildi`,
  ENROLLMENT_UPDATED: (e, a) =>
    `${a.name} ${fullName(e?.student)} ning "${e?.group?.name ?? "—"}" yozuvini yangiladi`,
  ENROLLMENT_COMPLETED: (e) =>
    `${fullName(e?.student)} "${e?.group?.name ?? "—"}" guruhini yakunladi`,
  ENROLLMENT_DROPPED: (e) =>
    `${fullName(e?.student)} "${e?.group?.name ?? "—"}" guruhidan chiqdi`,
  ENROLLMENT_DELETED: (e, a) =>
    `${a.name} ${fullName(e?.student)} ning "${e?.group?.name ?? "—"}" yozuvini o'chirdi`,

  // Groups
  GROUP_CREATED: (g, a) =>
    `${a.name} yangi "${g?.name ?? "—"}" guruhini yaratdi`,
  GROUP_UPDATED: (g, a) =>
    `${a.name} "${g?.name ?? "—"}" guruhini yangiladi`,
  GROUP_DELETED: (g, a) =>
    `${a.name} "${g?.name ?? "—"}" guruhini o'chirdi`,

  // Payments
  PAYMENT_CREATED: (p, a, m) =>
    `${a.name} ${fullName(m?.student)} uchun ${fmtAmount(p?.amount)} so'm to'lov qo'shdi`,
  PAYMENT_PAID: (p, a, m) =>
    `${fullName(m?.student)} to'lovi qabul qilindi (${fmtAmount(p?.amount)} so'm)`,
  PAYMENT_OVERDUE: (p, a, m) =>
    `${fullName(m?.student)} to'lovi muddati o'tdi (${fmtAmount(p?.amount)} so'm)`,
  PAYMENT_UPDATED: (p, a, m) =>
    `${a.name} ${fullName(m?.student)} to'lovini yangiladi`,
  PAYMENT_DELETED: (p, a, m) =>
    `${a.name} ${fullName(m?.student)} to'lovini o'chirdi`,

  // Attendance
  ATTENDANCE_MARKED: (at, a, m) => {
    const status = at?.status === "present" ? "keldi" : "kelmadi";
    return `${fullName(m?.student)} — ${status} (${fmtDate(at?.date)})`;
  },
  ATTENDANCE_UPDATED: (at, a, m) => {
    const status = at?.status === "present" ? "keldi" : "kelmadi";
    return `${a.name} ${fullName(m?.student)} davomatini yangiladi: ${status} (${fmtDate(at?.date)})`;
  },
  ATTENDANCE_DELETED: (at, a, m) =>
    `${a.name} ${fullName(m?.student)} davomatini o'chirdi (${fmtDate(at?.date)})`,

  // Salaries
  SALARY_CREATED: (s, a, m) =>
    `${a.name} ${fullName(m?.teacher)} uchun ${fmtAmount(s?.netAmount)} so'm oylik shakllantirdi`,
  SALARY_UPDATED: (s, a, m) =>
    `${a.name} ${fullName(m?.teacher)} oyligini yangiladi`,
  SALARY_PAID: (s, a, m) =>
    `${a.name} ${fullName(m?.teacher)} ga ${fmtAmount(s?.netAmount)} so'm oylik to'ladi`,
  SALARY_DELETED: (s, a, m) =>
    `${a.name} ${fullName(m?.teacher)} oyligini o'chirdi`,
};

module.exports = {
  formatters,
  ENROLLMENT_STATUS_LABELS,
  LEAD_STATUS_LABELS,
};
