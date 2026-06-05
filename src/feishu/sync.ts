import type { StandardCase } from "../cases/types.js";
import type { FeishuClient } from "./client.js";
import { mapFeishuRecordToCase } from "./mapper.js";

export async function syncFeishuCases(
  client: Pick<FeishuClient, "listRecords">,
  viewId?: string,
): Promise<StandardCase[]> {
  const records = await client.listRecords(viewId);
  return records.map(mapFeishuRecordToCase);
}
