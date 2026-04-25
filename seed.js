/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");

const User = require("./src/models/User");
const Group = require("./src/models/Group");
const Enrollment = require("./src/models/Enrollment");
const Payment = require("./src/models/Payment");
const Attendance = require("./src/models/Attendance");
const Lead = require("./src/models/Lead");
const Notification = require("./src/models/Notification");
const Record = require("./src/models/Record");
const Counter = require("./src/models/Counter");
const VerificationCode = require("./src/models/VerificationCode");
const Salary = require("./src/models/Salary");

const STUDENT_COUNT = 500;
const TEACHER_COUNT = 30;
const GROUP_COUNT = 40;
const LEAD_COUNT = 150;
const NOTIFICATION_COUNT = 60;
const ATTENDANCE_WINDOW_DAYS = 60;
const SALARY_MONTHS = 4;

const FIRST_NAMES_MALE = [
  "Ali", "Akbar", "Bekzod", "Dilshod", "Eldor", "Fazliddin", "Hasan", "Husan",
  "Ibrohim", "Jasur", "Kamol", "Lutfulla", "Murod", "Nodir", "Otabek", "Polat",
  "Rustam", "Sardor", "Temur", "Umid", "Valijon", "Yusuf", "Zafar", "Doniyor",
  "Sherzod", "Aziz", "Bahodir", "Sohibjon", "Anvar", "Komil", "Davron", "Olim",
  "Farhod", "Sanjar", "Rashid", "Botir", "Shavkat", "Muzaffar", "Asror", "Hamid",
];

const FIRST_NAMES_FEMALE = [
  "Aziza", "Barno", "Charos", "Dilfuza", "Elnura", "Feruza", "Gulnora", "Hilola",
  "Iroda", "Jamila", "Kamola", "Laylo", "Madina", "Nilufar", "Oynura", "Parvina",
  "Rayhona", "Sevara", "Tursunoy", "Umida", "Yulduz", "Zuhra", "Sabina", "Robia",
  "Maftuna", "Surayyo", "Munisa", "Nargiza", "Shahzoda", "Zarina", "Mohira",
];

const LAST_NAMES = [
  "Karimov", "Tursunov", "Yusupov", "Rahimov", "Saidov", "Toshmatov", "Nazarov",
  "Mahmudov", "Abdullayev", "Sharipov", "Olimov", "Ismoilov", "Yo'ldoshev",
  "Boboyev", "Hasanov", "Qodirov", "Aliyev", "Sodiqov", "Murodov", "Jo'rayev",
  "Rajabov", "Salimov", "Tojiyev", "Ergashev", "Mirzayev",
];

const GROUP_TEMPLATES = [
  { subject: "Tajwid", levels: ["Boshlang'ich", "O'rta", "Yuqori"] },
  { subject: "Arab tili", levels: ["A1", "A2", "B1", "B2"] },
  { subject: "Qur'on tilovati", levels: ["1-bosqich", "2-bosqich", "3-bosqich"] },
  { subject: "Aqida", levels: ["Asoslar", "Kengaytirilgan"] },
  { subject: "Hadis", levels: ["Boshlang'ich", "O'rta"] },
  { subject: "Fiqh", levels: ["Boshlang'ich", "O'rta"] },
  { subject: "Sira", levels: ["Asosiy"] },
];

const SCHEDULE_OPTIONS = [
  { days: ["Monday", "Wednesday", "Friday"], time: "08:00-09:30" },
  { days: ["Tuesday", "Thursday", "Saturday"], time: "10:00-11:30" },
  { days: ["Monday", "Wednesday", "Friday"], time: "14:00-15:30" },
  { days: ["Tuesday", "Thursday", "Saturday"], time: "16:00-17:30" },
  { days: ["Saturday", "Sunday"], time: "10:00-12:00" },
  { days: ["Monday", "Wednesday"], time: "18:00-19:30" },
  { days: ["Tuesday", "Thursday"], time: "18:00-19:30" },
  { days: ["Monday", "Tuesday", "Wednesday", "Thursday"], time: "09:00-10:00" },
];

const ROOMS = [
  "1-xona", "2-xona", "3-xona", "4-xona", "5-xona", "Asosiy zal", "Kichik zal", "Kutubxona",
];

const PROFESSIONS = [
  "O'qituvchi", "Talaba", "Muhandis", "Shifokor", "Tadbirkor", "Dasturchi",
  "Buxgalter", "Sotuvchi", "Haydovchi", "Quruvchi", "Uy bekasi", "Imom",
];

const LEAD_SOURCES = ["telegram", "instagram", "referral", "offline", "other"];
const STUDENT_SOURCES = ["telegram", "instagram", "referral", "offline", "tanish-bilishlar"];
const LEAD_STATUSES = ["new", "contacted", "interested", "scheduled", "converted", "rejected"];
const LEVELS = ["Boshlang'ich", "O'rta", "Yuqori"];

const REJECTION_REASONS = [
  "Narx qimmat",
  "Vaqti to'g'ri kelmaydi",
  "Boshqa kursni tanladi",
  "Aloqaga chiqmadi",
  "Manzil uzoq",
];

const LEAD_INTERESTS = [
  "Qur'on tilovati o'rganmoqchi",
  "Bola uchun guruh izlamoqda",
  "Arab tili kursi kerak",
  "Tajwid darslari",
  "Hadis o'rganmoqchi",
  "Aqida darslari",
];

const LEAD_NOTES = [
  "Qiziqishi yuqori",
  "Telefon javob bermadi",
  "Keyingi haftaga qaytib qo'ng'iroq qilish",
  "Aka-ukasi bizda o'qigan",
  "Onasi bilan kelgan",
  "",
];

const NOTIFICATION_TITLES = [
  "Dars vaqti haqida savol",
  "Mashg'ulot bo'lmaydi",
  "Bayram tabrigi",
  "Imtihon natijalari",
  "To'lov haqida ma'lumot",
  "Yo'qlama haqida shikoyat",
  "Yangi qo'llanma haqida",
  "Dars davomi haqida",
  "Auditoriya o'zgarishi",
];

const NOTIFICATION_MESSAGES = [
  "Hurmatli o'qituvchi, dars haqida savolim bor edi.",
  "Ertangi mashg'ulot qoldirilsin, iltimos.",
  "Bayramingiz bilan! Ish faoliyatingizga omad.",
  "Imtihon natijalarini qachon e'lon qilasiz?",
  "To'lov tartibida muammo bor.",
  "Davomatda xato bor, ko'rib chiqing.",
  "Yangi kitoblar qachon keladi?",
  "Dars qaerda davom etadi, aniqlik kiritsangiz?",
  "Dasturni biroz tezroq olib bersak yaxshi bo'lardi.",
];

const NOTIFICATION_TYPES = ["complaint", "suggestion", "question", "other"];
const NOTIFICATION_STATUSES = ["open", "in_progress", "resolved"];

const FEEDBACK_MESSAGES = [
  "Tushundim, hozir hal qilamiz.",
  "Iltimos, batafsil yozib bering.",
  "Bu masala bo'yicha javobgar bilan gaplashdim.",
  "Rahmat, muammo bartaraf etildi.",
  "Sabringiz uchun rahmat.",
];

const DISCOUNT_REASONS = [
  "Aka-uka chegirmasi",
  "Yetim bola",
  "Ko'p bolali oilaga",
  "Imtiyozli o'quvchi",
  "Ijtimoiy himoyaga muhtoj",
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generatePhonePool(count, start = 998900000001) {
  const phones = [];
  for (let i = 0; i < count; i++) phones.push(start + i);
  return phones;
}

function getNextPaymentDate(fromDate, day) {
  const d = new Date(fromDate);
  d.setMonth(d.getMonth() + 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekdayName(date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
}

async function main() {
  const url = process.env.MONGODB_URL;
  if (!url) {
    console.error("MONGODB_URL .env faylida topilmadi!");
    process.exit(1);
  }

  console.log("MongoDB ga ulanmoqda...");
  await mongoose.connect(url);
  console.log("Ulandi ✅");

  console.log("Eski ma'lumotlar tozalanmoqda...");
  await Promise.all([
    User.deleteMany({}),
    Group.deleteMany({}),
    Enrollment.deleteMany({}),
    Payment.deleteMany({}),
    Attendance.deleteMany({}),
    Lead.deleteMany({}),
    Notification.deleteMany({}),
    Record.deleteMany({}),
    Counter.deleteMany({}),
    VerificationCode.deleteMany({}),
    Salary.deleteMany({}),
  ]);
  console.log("Tozalandi ✅");

  // ========== ADMIN ==========
  const adminPhone = Number(process.env.ADMIN_PHONE) || 998901234567;
  const admin = await User.create({
    role: "admin",
    firstName: "Admin",
    lastName: "Bayyina",
    phone: adminPhone,
    password: "admin1234",
    gender: "male",
    age: 35,
    source: "internal",
  });
  console.log(`Admin: ${admin.phone} / admin1234`);

  // ========== PHONE POOL ==========
  const totalPhones = TEACHER_COUNT + STUDENT_COUNT + LEAD_COUNT + 10;
  const phonePool = generatePhonePool(totalPhones, 998900000001);
  let pIdx = 0;

  // ========== TEACHERS ==========
  console.log(`${TEACHER_COUNT} ta o'qituvchi yaratilmoqda...`);
  const teacherDocs = [];
  for (let i = 0; i < TEACHER_COUNT; i++) {
    const gender = Math.random() < 0.6 ? "male" : "female";
    const firstName = gender === "male" ? pick(FIRST_NAMES_MALE) : pick(FIRST_NAMES_FEMALE);
    const lastName = pick(LAST_NAMES);
    teacherDocs.push({
      role: "teacher",
      firstName,
      lastName,
      phone: phonePool[pIdx++],
      password: "teacher1234",
      gender,
      age: randInt(24, 55),
      source: "internal",
    });
  }
  const teachers = await User.insertMany(teacherDocs);
  console.log(`✅ ${teachers.length} o'qituvchi`);

  // ========== STUDENTS ==========
  console.log(`${STUDENT_COUNT} ta o'quvchi yaratilmoqda...`);
  const studentDocs = [];
  for (let i = 0; i < STUDENT_COUNT; i++) {
    const gender = Math.random() < 0.5 ? "male" : "female";
    const firstName = gender === "male" ? pick(FIRST_NAMES_MALE) : pick(FIRST_NAMES_FEMALE);
    const lastName = pick(LAST_NAMES);
    studentDocs.push({
      role: "student",
      firstName,
      lastName,
      phone: phonePool[pIdx++],
      password: "student1234",
      gender,
      age: randInt(8, 45),
      source: pick(STUDENT_SOURCES),
    });
  }
  const students = await User.insertMany(studentDocs);
  console.log(`✅ ${students.length} o'quvchi`);

  // ========== GROUPS ==========
  console.log(`${GROUP_COUNT} ta guruh yaratilmoqda...`);
  const groupDocs = [];
  for (let i = 0; i < GROUP_COUNT; i++) {
    const tpl = pick(GROUP_TEMPLATES);
    const lvl = pick(tpl.levels);
    const teacher = teachers[i % teachers.length];
    const sched = pick(SCHEDULE_OPTIONS);
    const price = pick([200000, 250000, 300000, 350000, 400000, 500000]);
    const salaryType = pickWeighted(
      ["percentage", "per_student", "fixed"],
      [60, 25, 15]
    );
    let salaryValue;
    if (salaryType === "percentage") salaryValue = pick([25, 30, 35, 40, 45, 50]);
    else if (salaryType === "per_student") salaryValue = pick([30000, 50000, 70000, 100000]);
    else salaryValue = pick([1500000, 2000000, 2500000, 3000000, 3500000, 4000000]);
    groupDocs.push({
      name: `${tpl.subject} — ${lvl} (${i + 1}-guruh)`,
      description: `${tpl.subject} fanidan ${lvl} darajadagi guruh.`,
      price,
      teacher: teacher._id,
      schedule: { days: sched.days, time: sched.time },
      room: pick(ROOMS),
      salaryType,
      salaryValue,
      createdBy: admin._id,
    });
  }
  const groups = await Group.insertMany(groupDocs);
  console.log(`✅ ${groups.length} guruh`);

  // ========== ENROLLMENTS ==========
  console.log("Yozilishlar yaratilmoqda...");
  const enrollmentDocs = [];
  const now = new Date();
  const usedPairs = new Set();

  for (const stu of students) {
    const numEnroll = pickWeighted([1, 2, 3], [70, 25, 5]);
    const candidates = shuffle(groups).slice(0, numEnroll);
    for (const grp of candidates) {
      const key = `${stu._id}-${grp._id}`;
      if (usedPairs.has(key)) continue;
      usedPairs.add(key);

      const status = pickWeighted(["active", "completed", "dropped"], [82, 10, 8]);
      const enrolledDaysAgo = randInt(15, 240);
      const enrolledAt = new Date(now.getTime() - enrolledDaysAgo * 86400000);
      const paymentDay = randInt(1, 28);

      let discount = 0;
      let discountReason;
      if (Math.random() < 0.18) {
        discount = pick([20000, 30000, 50000, 100000]);
        discountReason = pick(DISCOUNT_REASONS);
      }

      const lastPaymentDate = status === "active"
        ? new Date(now.getTime() - randInt(0, 35) * 86400000)
        : null;
      const nextPaymentDate = status === "active"
        ? getNextPaymentDate(lastPaymentDate || enrolledAt, paymentDay)
        : null;

      const fs = pickWeighted(["clean", "debt", "balance"], [60, 25, 15]);
      let debt = 0, balance = 0;
      if (status === "active") {
        if (fs === "debt") debt = pick([50000, 100000, 150000, 200000]);
        if (fs === "balance") balance = pick([20000, 50000, 80000]);
      }

      enrollmentDocs.push({
        student: stu._id,
        group: grp._id,
        status,
        enrolledAt,
        discount,
        discountReason,
        paymentDay,
        ...(lastPaymentDate && { lastPaymentDate }),
        ...(nextPaymentDate && { nextPaymentDate }),
        debt,
        balance,
      });
    }
  }
  const enrollments = await Enrollment.insertMany(enrollmentDocs, { ordered: false });
  console.log(`✅ ${enrollments.length} yozilish`);

  // ========== PAYMENTS ==========
  console.log("To'lovlar yaratilmoqda...");
  const groupMap = new Map(groups.map((g) => [String(g._id), g]));
  const paymentDocs = [];

  for (const en of enrollments) {
    const group = groupMap.get(String(en.group));
    if (!group) continue;

    const monthsSpan = Math.floor((now - new Date(en.enrolledAt)) / (30 * 86400000));
    const monthsToGenerate = en.status === "active"
      ? Math.min(6, monthsSpan)
      : Math.min(4, monthsSpan);

    const effectiveFee = Math.max(0, (group.price || 0) - (en.discount || 0));

    for (let m = monthsToGenerate; m >= 1; m--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const choice = pickWeighted(
        ["paid", "paid_partial", "overdue", "skip"],
        [70, 10, 12, 8]
      );
      if (choice === "skip") continue;

      let amount, status, paidAt;
      if (choice === "paid") {
        amount = effectiveFee;
        status = "paid";
        paidAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(1, 25));
      } else if (choice === "paid_partial") {
        amount = Math.floor(effectiveFee * (Math.random() * 0.5 + 0.3));
        status = "paid";
        paidAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), randInt(1, 28));
      } else {
        amount = effectiveFee;
        status = "overdue";
      }

      paymentDocs.push({
        enrollment: en._id,
        student: en.student,
        amount,
        month: monthDate,
        status,
        ...(paidAt && { paidAt }),
        ...(choice === "paid_partial" && { note: "Qisman to'lov" }),
        createdBy: admin._id,
      });
    }

    if (en.status === "active" && Math.random() < 0.4) {
      paymentDocs.push({
        enrollment: en._id,
        student: en.student,
        amount: effectiveFee,
        month: new Date(now.getFullYear(), now.getMonth(), 1),
        status: "pending",
        createdBy: admin._id,
      });
    }
  }

  const PAY_CHUNK = 1000;
  for (let i = 0; i < paymentDocs.length; i += PAY_CHUNK) {
    await Payment.insertMany(paymentDocs.slice(i, i + PAY_CHUNK), { ordered: false });
  }
  console.log(`✅ ${paymentDocs.length} to'lov`);

  // ========== SALARIES ==========
  console.log("Oyliklar yaratilmoqda...");
  const enrollmentToGroup = new Map(
    enrollments.map((en) => [String(en._id), String(en.group)])
  );
  const activeStudentsByGroup = new Map();
  for (const en of enrollments) {
    if (en.status !== "active") continue;
    const k = String(en.group);
    activeStudentsByGroup.set(k, (activeStudentsByGroup.get(k) || 0) + 1);
  }

  const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;
  const revenueByGroupMonth = new Map();
  const paidStudentsByGroupMonth = new Map();
  for (const p of paymentDocs) {
    if (p.status !== "paid") continue;
    const gid = enrollmentToGroup.get(String(p.enrollment));
    if (!gid) continue;
    const k = `${gid}|${monthKey(p.month)}`;
    revenueByGroupMonth.set(k, (revenueByGroupMonth.get(k) || 0) + p.amount);
    if (!paidStudentsByGroupMonth.has(k)) paidStudentsByGroupMonth.set(k, new Set());
    paidStudentsByGroupMonth.get(k).add(String(p.student));
  }

  const groupsByTeacher = new Map();
  for (const g of groups) {
    const tid = String(g.teacher);
    if (!groupsByTeacher.has(tid)) groupsByTeacher.set(tid, []);
    groupsByTeacher.get(tid).push(g);
  }

  const salaryDocs = [];
  for (const t of teachers) {
    const tGroups = groupsByTeacher.get(String(t._id)) || [];
    if (!tGroups.length) continue;

    for (let m = SALARY_MONTHS; m >= 1; m--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mKey = monthKey(monthDate);

      const breakdown = tGroups.map((g) => {
        const gid = String(g._id);
        const studentCount = activeStudentsByGroup.get(gid) || 0;
        const k = `${gid}|${mKey}`;
        const groupRevenue = revenueByGroupMonth.get(k) || 0;
        const paidStudentsCount = (paidStudentsByGroupMonth.get(k) || new Set()).size;

        let amount = 0;
        if (g.salaryType === "percentage") {
          amount = (groupRevenue * g.salaryValue) / 100;
        } else if (g.salaryType === "per_student") {
          amount = paidStudentsCount * g.salaryValue;
        } else if (g.salaryType === "fixed") {
          amount = g.salaryValue;
        }

        return {
          group: g._id,
          groupName: g.name,
          salaryType: g.salaryType,
          salaryValue: g.salaryValue,
          studentCount,
          paidStudentsCount,
          groupRevenue: Math.round(groupRevenue),
          amount: Math.round(amount),
        };
      });

      const totalAmount = breakdown.reduce((s, b) => s + b.amount, 0);
      const bonus = Math.random() < 0.18 ? pick([100000, 200000, 300000, 500000]) : 0;
      const deduction = Math.random() < 0.1 ? pick([50000, 100000, 150000]) : 0;
      const netAmount = Math.max(0, Math.round(totalAmount + bonus - deduction));

      const status = m === 1
        ? pickWeighted(["paid", "pending"], [45, 55])
        : pickWeighted(["paid", "pending"], [88, 12]);

      const paidAt = status === "paid"
        ? new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, randInt(1, 15))
        : undefined;

      const note = pickWeighted(
        [
          "",
          "Oylik o'z vaqtida hisoblandi",
          "Bonus: yaxshi natija uchun",
          "Bir kunlik ishga chiqmagani uchun chegirma",
          "Davomat asosida hisoblandi",
        ],
        [70, 10, 8, 5, 7]
      );

      salaryDocs.push({
        teacher: t._id,
        month: monthDate,
        groups: breakdown,
        totalAmount: Math.round(totalAmount),
        bonus,
        deduction,
        netAmount,
        status,
        ...(paidAt && { paidAt }),
        ...(note && { note }),
        createdBy: admin._id,
      });
    }
  }

  const SAL_CHUNK = 500;
  let salInserted = 0;
  for (let i = 0; i < salaryDocs.length; i += SAL_CHUNK) {
    try {
      const inserted = await Salary.insertMany(
        salaryDocs.slice(i, i + SAL_CHUNK),
        { ordered: false }
      );
      salInserted += inserted.length;
    } catch (err) {
      if (err.insertedDocs) salInserted += err.insertedDocs.length;
    }
  }
  console.log(`✅ ${salInserted} oylik`);

  // ========== ATTENDANCE ==========
  console.log("Davomatlar yaratilmoqda...");
  const attendanceDocs = [];

  for (const en of enrollments) {
    if (en.status === "dropped") continue;
    const group = groupMap.get(String(en.group));
    if (!group) continue;

    const allowedDays = new Set(group.schedule.days);
    const startMs = Math.max(
      new Date(en.enrolledAt).getTime(),
      now.getTime() - ATTENDANCE_WINDOW_DAYS * 86400000
    );
    const startDate = new Date(startMs);
    const cursor = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    ));
    const endCursor = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ));

    while (cursor <= endCursor) {
      if (allowedDays.has(weekdayName(cursor))) {
        const present = Math.random() < 0.85;
        attendanceDocs.push({
          enrollment: en._id,
          group: en.group,
          student: en.student,
          date: new Date(cursor.getTime()),
          status: present ? "present" : "absent",
          markedBy: group.teacher,
          ...(Math.random() < 0.05 && {
            note: present ? "Vaqtida keldi" : "Kasallik bilan",
          }),
        });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const ATT_CHUNK = 2000;
  let attInserted = 0;
  for (let i = 0; i < attendanceDocs.length; i += ATT_CHUNK) {
    try {
      const inserted = await Attendance.insertMany(
        attendanceDocs.slice(i, i + ATT_CHUNK),
        { ordered: false }
      );
      attInserted += inserted.length;
    } catch (err) {
      if (err.insertedDocs) attInserted += err.insertedDocs.length;
    }
  }
  console.log(`✅ ${attInserted} davomat`);

  // ========== LEADS ==========
  console.log(`${LEAD_COUNT} ta lead yaratilmoqda...`);
  const leadDocs = [];
  for (let i = 0; i < LEAD_COUNT; i++) {
    const gender = Math.random() < 0.5 ? "male" : "female";
    const firstName = gender === "male" ? pick(FIRST_NAMES_MALE) : pick(FIRST_NAMES_FEMALE);
    const status = pickWeighted(LEAD_STATUSES, [25, 15, 18, 12, 18, 12]);
    const source = pick(LEAD_SOURCES);
    const createdAt = new Date(now.getTime() - randInt(0, 90) * 86400000);
    const isConverted = status === "converted";
    const isRejected = status === "rejected";

    leadDocs.push({
      firstName,
      phone: phonePool[pIdx++],
      gender,
      age: randInt(8, 50),
      profession: pick(PROFESSIONS),
      source,
      interest: pick(LEAD_INTERESTS),
      uniqueLink: `BAY-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      ...(Math.random() < 0.6 && {
        linkClickedAt: new Date(createdAt.getTime() + randInt(1, 48) * 3600000),
      }),
      ...(Math.random() < 0.5 && { group: pick(groups)._id }),
      level: pick(LEVELS),
      status,
      ...(isRejected && { rejectionReason: pick(REJECTION_REASONS) }),
      paymentStatus: isConverted ? pick(["paid", "partial"]) : "unpaid",
      ...(["scheduled", "interested"].includes(status) && {
        scheduledAt: new Date(now.getTime() + randInt(1, 14) * 86400000),
      }),
      lastActivityAt: new Date(createdAt.getTime() + randInt(0, 5) * 86400000),
      notes: pick(LEAD_NOTES),
      createdBy: admin._id,
    });
  }
  const leads = await Lead.insertMany(leadDocs, { ordered: false });
  console.log(`✅ ${leads.length} lead`);

  // ========== NOTIFICATIONS ==========
  console.log(`${NOTIFICATION_COUNT} ta xabar yaratilmoqda...`);
  const notifDocs = [];
  for (let i = 0; i < NOTIFICATION_COUNT; i++) {
    const senderIsTeacher = Math.random() < 0.5;
    const sender = senderIsTeacher ? pick(teachers) : pick(students);
    const grp = pick(groups);
    const status = pickWeighted(NOTIFICATION_STATUSES, [40, 25, 35]);

    const feedback = [];
    if (status !== "open") {
      const fbCount = randInt(1, 3);
      for (let k = 0; k < fbCount; k++) {
        feedback.push({
          role: pick(["teacher", "admin"]),
          author: Math.random() < 0.5 ? admin._id : pick(teachers)._id,
          message: pick(FEEDBACK_MESSAGES),
        });
      }
    }

    notifDocs.push({
      group: grp._id,
      sender: sender._id,
      title: pick(NOTIFICATION_TITLES),
      message: pick(NOTIFICATION_MESSAGES),
      type: pick(NOTIFICATION_TYPES),
      status,
      feedback,
    });
  }
  const notifications = await Notification.insertMany(notifDocs);
  console.log(`✅ ${notifications.length} xabar`);

  // ========== RECORDS (audit log) ==========
  console.log("Audit yozuvlari yaratilmoqda...");
  const seqByDay = new Map();
  const pad4 = (n) => String(n).padStart(4, "0");
  const codeFor = (date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    const day = `${y}${m}${d}`;
    const seq = (seqByDay.get(day) || 0) + 1;
    seqByDay.set(day, seq);
    return `REC-${day}-${pad4(seq)}`;
  };

  const adminActor = { userId: admin._id, role: "admin", name: "Admin Bayyina" };
  const recordDocs = [];

  for (const t of teachers) {
    const ts = new Date(now.getTime() - randInt(60, 200) * 86400000);
    recordDocs.push({
      code: codeFor(ts),
      eventType: "USER_TEACHER_CREATED",
      entityType: "User",
      entityId: t._id,
      description: `Admin Bayyina yangi o'qituvchi ${t.firstName} ${t.lastName} ni qo'shdi`,
      actor: adminActor,
      refs: { teacherId: t._id },
    });
  }

  for (const grp of groups) {
    const ts = new Date(now.getTime() - randInt(60, 200) * 86400000);
    recordDocs.push({
      code: codeFor(ts),
      eventType: "GROUP_CREATED",
      entityType: "Group",
      entityId: grp._id,
      description: `Admin Bayyina yangi "${grp.name}" guruhini yaratdi`,
      actor: adminActor,
      refs: { groupId: grp._id, teacherId: grp.teacher },
    });
  }

  const sampleEnrollments = shuffle(enrollments).slice(0, Math.min(200, enrollments.length));
  for (const en of sampleEnrollments) {
    const ts = new Date(en.enrolledAt);
    recordDocs.push({
      code: codeFor(ts),
      eventType: "ENROLLMENT_CREATED",
      entityType: "Enrollment",
      entityId: en._id,
      description: "O'quvchi guruhga yozildi",
      actor: adminActor,
      refs: { studentId: en.student, groupId: en.group, enrollmentId: en._id },
    });
  }

  for (let i = 0; i < 80; i++) {
    const ts = new Date(now.getTime() - randInt(0, 30) * 86400000);
    const lead = pick(leads);
    recordDocs.push({
      code: codeFor(ts),
      eventType: "LEAD_CREATED",
      entityType: "Lead",
      entityId: lead._id,
      description: `Admin Bayyina yangi murojaat "${lead.firstName}" ni qo'shdi`,
      actor: adminActor,
      refs: { leadId: lead._id },
    });
  }

  await Record.insertMany(recordDocs, { ordered: false });
  console.log(`✅ ${recordDocs.length} audit yozuvi`);

  console.log("\n=========================================");
  console.log("SEED YAKUNLANDI ✅");
  console.log("=========================================");
  console.log(`Admin       : ${admin.phone} / admin1234`);
  console.log(`Teacher (1) : ${teachers[0].phone} / teacher1234`);
  console.log(`Student (1) : ${students[0].phone} / student1234`);
  console.log("=========================================\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed jarayonida xatolik:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
