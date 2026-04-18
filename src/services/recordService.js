const logger = require("../config/logger");
const Counter = require("../models/Counter");
const Record = require("../models/Record");
const { formatters } = require("../data/recordTexts");

const pad4 = (n) => String(n).padStart(4, "0");

const yyyymmdd = (date = new Date()) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

const generateCode = async (date = new Date()) => {
  const day = yyyymmdd(date);
  const counterId = `rec-${day}`;
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `REC-${day}-${pad4(counter.seq)}`;
};

const buildDescription = (eventType, entity, actor, metadata) => {
  const fn = formatters[eventType];
  if (typeof fn !== "function") return eventType;
  try {
    return fn(entity, actor, metadata);
  } catch (err) {
    logger.error("Failed to build record description", { eventType, err: err.message });
    return eventType;
  }
};

const diffFields = (before, after, allowed) => {
  const beforeDiff = {};
  const afterDiff = {};
  const fields = Array.isArray(allowed) && allowed.length
    ? allowed
    : Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));

  for (const field of fields) {
    const b = before?.[field];
    const a = after?.[field];
    const bNorm = b instanceof Date ? b.toISOString() : b;
    const aNorm = a instanceof Date ? a.toISOString() : a;
    if (JSON.stringify(bNorm) !== JSON.stringify(aNorm)) {
      beforeDiff[field] = b ?? null;
      afterDiff[field] = a ?? null;
    }
  }

  if (Object.keys(afterDiff).length === 0) return null;
  return { before: beforeDiff, after: afterDiff };
};

const actorFromReq = (req) => {
  const u = req?.user;
  if (!u) return { userId: null, role: "system", name: "Tizim" };
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "Noma'lum";
  return { userId: u._id, role: u.role || "system", name };
};

const systemActor = (name = "Tizim") => ({ userId: null, role: "system", name });

const createRecord = async ({
  eventType,
  entityType,
  entityId,
  entity,
  actor,
  refs,
  changes,
  metadata,
}) => {
  try {
    if (!eventType || !entityType || !actor) {
      logger.error("createRecord missing required fields", { eventType, entityType });
      return null;
    }

    const description = buildDescription(eventType, entity, actor, metadata);
    const code = await generateCode();

    const doc = {
      code,
      eventType,
      entityType,
      entityId: entityId ?? entity?._id ?? null,
      description,
      actor: {
        userId: actor.userId ?? null,
        role: actor.role || "system",
        name: actor.name || "Tizim",
      },
      refs: refs || {},
      ...(changes && { changes }),
      ...(metadata && { metadata }),
    };

    return await Record.create(doc);
  } catch (err) {
    logger.error("Failed to create record", {
      eventType,
      entityType,
      err: err.message,
      stack: err.stack,
    });
    return null;
  }
};

module.exports = {
  createRecord,
  generateCode,
  buildDescription,
  diffFields,
  actorFromReq,
  systemActor,
};
