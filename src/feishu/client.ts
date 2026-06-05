import type { FeishuRecord } from "./mapper.js";

export type FeishuClientConfig = {
  appToken: string;
  tableId: string;
  bearerToken: string;
  baseUrl?: string;
};

type FeishuListRecordsResponse = {
  data?: {
    items?: FeishuRecord[];
  };
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
    const url = this.buildRecordsUrl();
    if (viewId !== undefined) {
      url.searchParams.set("view_id", viewId);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
      },
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`Feishu listRecords failed with status ${response.status}: ${bodyText}`);
    }

    const body = parseJsonBody(bodyText) as FeishuListRecordsResponse;
    return body.data?.items || [];
  }

  async updateRecord(recordId: string, fields: Record<string, unknown>): Promise<void> {
    const response = await fetch(
      `${this.buildRecordsUrl().toString()}/${encodeURIComponent(recordId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      },
    );

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`Feishu updateRecord failed with status ${response.status}: ${bodyText}`);
    }
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
