import type { FeishuRecord } from "./mapper.js";

export type FeishuClientConfig = {
  appToken: string;
  tableId: string;
  bearerToken: string;
  baseUrl?: string;
};

type FeishuApiEnvelope<TData> = {
  code?: number;
  msg?: string;
  data?: TData;
};

type FeishuListRecordsData = {
  has_more?: boolean;
  page_token?: string;
  items?: FeishuRecord[];
};

export class FeishuClient {
  private readonly appToken: string;
  private readonly tableId: string;
  private readonly bearerToken: string;
  private readonly baseUrl: string;

  constructor(config: FeishuClientConfig) {
    this.appToken = config.appToken;
    this.tableId = config.tableId;
    this.bearerToken = config.bearerToken;
    this.baseUrl = config.baseUrl ?? "https://open.feishu.cn/open-apis";
  }

  async listRecords(viewId?: string): Promise<FeishuRecord[]> {
    const records: FeishuRecord[] = [];
    let pageToken: string | undefined;

    do {
      const url = this.buildRecordsUrl();
      url.searchParams.set("page_size", "500");
      if (viewId !== undefined) {
        url.searchParams.set("view_id", viewId);
      }
      if (pageToken !== undefined) {
        url.searchParams.set("page_token", pageToken);
      }

      const body = await this.requestJson<FeishuListRecordsData>("listRecords", url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
      });
      const data = body.data;

      records.push(...(data?.items ?? []));
      pageToken = data?.has_more === true ? data.page_token : undefined;
    } while (pageToken !== undefined);

    return records;
  }

  async updateRecord(recordId: string, fields: Record<string, unknown>): Promise<void> {
    await this.requestJson("updateRecord", `${this.buildRecordsUrl()}/${encodeURIComponent(recordId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });
  }

  private buildRecordsUrl(): URL {
    return new URL(
      `${this.normalizedBaseUrl()}/bitable/v1/apps/${encodeURIComponent(
        this.appToken,
      )}/tables/${encodeURIComponent(this.tableId)}/records`,
    );
  }

  private normalizedBaseUrl(): string {
    return this.baseUrl.replace(/\/+$/, "");
  }

  private async requestJson<TData>(
    operation: "listRecords" | "updateRecord",
    input: RequestInfo | URL,
    init: RequestInit,
  ): Promise<FeishuApiEnvelope<TData>> {
    const response = await fetch(input, init);
    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`Feishu ${operation} failed with status ${response.status}: ${bodyText}`);
    }

    const body = parseJsonBody(bodyText) as FeishuApiEnvelope<TData>;
    assertFeishuSuccess(operation, body);
    return body;
  }
}

export function createFeishuClient(config: FeishuClientConfig): FeishuClient {
  return new FeishuClient(config);
}

function parseJsonBody(bodyText: string): unknown {
  if (bodyText.trim().length === 0) {
    return {};
  }

  return JSON.parse(bodyText) as unknown;
}

function assertFeishuSuccess<TData>(
  operation: "listRecords" | "updateRecord",
  body: FeishuApiEnvelope<TData>,
): void {
  if (body.code !== undefined && body.code !== 0) {
    throw new Error(`Feishu ${operation} failed with code ${body.code}: ${body.msg ?? ""}`);
  }
}
