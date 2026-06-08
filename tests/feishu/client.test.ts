import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";

import { FeishuClient } from "../../src/feishu/client.js";
import type { FeishuRecord } from "../../src/feishu/mapper.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("FeishuClient", () => {
  it("lists all records by preserving view_id and following page_token", async () => {
    const requests: URL[] = [];
    const recordsByPage: FeishuRecord[][] = [
      [{ record_id: "rec1", fields: { title: "First" } }],
      [{ record_id: "rec2", fields: { title: "Second" } }],
    ];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      requests.push(url);

      const pageIndex = requests.length - 1;
      return new Response(
        JSON.stringify({
          code: 0,
          msg: "success",
          data: {
            has_more: pageIndex === 0,
            page_token: pageIndex === 0 ? "next-page-token" : undefined,
            items: recordsByPage[pageIndex],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const client = new FeishuClient({
      appToken: "app-token",
      tableId: "table-id",
      bearerToken: "bearer-token",
      baseUrl: "https://feishu.example/open-apis",
    });

    const records = await client.listRecords("view-123");

    assert.deepEqual(records, recordsByPage.flat());
    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.searchParams.get("page_size"), "500");
    assert.equal(requests[0]?.searchParams.get("view_id"), "view-123");
    assert.equal(requests[0]?.searchParams.has("page_token"), false);
    assert.equal(requests[1]?.searchParams.get("page_size"), "500");
    assert.equal(requests[1]?.searchParams.get("view_id"), "view-123");
    assert.equal(requests[1]?.searchParams.get("page_token"), "next-page-token");
  });

  it("throws when listRecords receives a non-zero Feishu code in an HTTP 200 response", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          code: 1254001,
          msg: "invalid view_id",
          data: {},
        }),
        { status: 200 },
      )) as typeof fetch;

    const client = new FeishuClient({
      appToken: "app-token",
      tableId: "table-id",
      bearerToken: "bearer-token",
      baseUrl: "https://feishu.example/open-apis",
    });

    await assert.rejects(
      () => client.listRecords("bad-view"),
      /Feishu listRecords failed with code 1254001: invalid view_id/,
    );
  });

  it("throws when updateRecord receives a non-zero Feishu code in an HTTP 200 response", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          code: 1254002,
          msg: "invalid record_id",
          data: {},
        }),
        { status: 200 },
      )) as typeof fetch;

    const client = new FeishuClient({
      appToken: "app-token",
      tableId: "table-id",
      bearerToken: "bearer-token",
      baseUrl: "https://feishu.example/open-apis",
    });

    await assert.rejects(
      () => client.updateRecord("bad-record", { status: "passed" }),
      /Feishu updateRecord failed with code 1254002: invalid record_id/,
    );
  });

  it("updates records with PUT and a JSON fields payload", async () => {
    let method: string | undefined;
    let body: string | undefined;

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      method = init?.method;
      body = init?.body?.toString();

      return new Response(JSON.stringify({ code: 0, msg: "success", data: {} }), { status: 200 });
    }) as typeof fetch;

    const client = new FeishuClient({
      appToken: "app-token",
      tableId: "table-id",
      bearerToken: "bearer-token",
      baseUrl: "https://feishu.example/open-apis",
    });

    await client.updateRecord("rec1", { status: "passed" });

    assert.equal(method, "PUT");
    assert.equal(body, JSON.stringify({ fields: { status: "passed" } }));
  });
});
