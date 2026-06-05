import type { CaseStatus } from "../cases/types.js";
import type { FeishuClient } from "./client.js";

export type WritebackInput = {
  runId: string;
  status: CaseStatus;
  failure?: string;
  evidenceUrl: string;
  executedAt: string;
};

export type WritebackFields = {
  last_run_id: string;
  last_status: CaseStatus;
  last_failure: string;
  last_evidence_url: string;
  last_executed_at: string;
};

export function buildWritebackFields(input: WritebackInput): WritebackFields {
  return {
    last_run_id: input.runId,
    last_status: input.status,
    last_failure: input.failure ?? "",
    last_evidence_url: input.evidenceUrl,
    last_executed_at: input.executedAt,
  };
}

export async function writeCaseResult(
  client: Pick<FeishuClient, "updateRecord">,
  recordId: string,
  input: WritebackInput,
): Promise<void> {
  await client.updateRecord(recordId, buildWritebackFields(input));
}
