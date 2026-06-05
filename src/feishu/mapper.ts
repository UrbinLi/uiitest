import { normalizeCaseRecord } from "../cases/schema.js";
import type { StandardCase } from "../cases/types.js";

export type FeishuRecord = {
  record_id: string;
  fields: Record<string, unknown>;
};

const STRUCTURED_FIELDS = ["steps", "hard_assertions", "ai_assertions"] as const;

type StructuredField = (typeof STRUCTURED_FIELDS)[number];

export function mapFeishuRecordToCase(record: FeishuRecord): StandardCase {
  const fields: Record<string, unknown> = {
    ...record.fields,
    feishu_record_id: record.record_id,
  };

  for (const field of STRUCTURED_FIELDS) {
    fields[field] = parseStructuredField(field, fields[field]);
  }

  return normalizeCaseRecord(fields);
}

function parseStructuredField(field: StructuredField, value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${field} must be valid JSON when stored as text`);
  }
}
