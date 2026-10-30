import { createAssignmentPreviewHandler } from "./handler.ts";

function assert(value: unknown): asserts value { if (!value) throw new Error("Assertion failed"); }
const body = { sessionId: "00000000-0000-4031-8000-000000000001", purpose: "start", expectedToken: "token", configuration: {} };
const request = () => new Request("https://preview.test", { method: "POST", body: JSON.stringify(body) });
Deno.test("reject host denial before optimization or publication", async () => {
  let expensive = false;
  const handler = createAssignmentPreviewHandler({ prepare: async () => { throw new Error("not_host"); },
    optimizer: { optimize: async () => { expensive = true; throw new Error("must not run"); } },
    publish: async () => { expensive = true; } });
  assert((await handler(request())).status === 403 && !expensive);
});
Deno.test("reuse ready or pending preparation without solving", async () => {
  for (const prepared of [{ proposalId: "ready", assignments: {} }, { issue: "preview_pending", retryAfterSeconds: 1 }]) {
    const handler = createAssignmentPreviewHandler({ prepare: async () => prepared,
      publish: async () => { throw new Error("must not publish"); } });
    assert(JSON.stringify(await (await handler(request())).json()) === JSON.stringify(prepared));
  }
});
Deno.test("generate validated 3/3/1 assignments and publish only to the reserved identity", async () => {
  const handler = createAssignmentPreviewHandler({ prepare: async () => ({ proposalId: "reserved", input: {
    participants: [{ id: "a", target: 3 }, { id: "b", target: 3 }, { id: "c", target: 1 }],
    pool: ["one", "two", "three", "four"], commonMatchId: "common", sharing: 2, policy: "preference",
  } }), publish: async (id, result) => {
    assert(id === "reserved" && result.assignments.a.length === 3 && result.assignments.c.length === 1);
    assert(result.assignments.a.filter(match => result.assignments.b.includes(match)).length === 2);
    return { proposalId: id, ...result };
  } });
  assert((await handler(request())).status === 200);
});
Deno.test("bound malformed and oversized ingress before preparation", async () => {
  const handler = createAssignmentPreviewHandler({ prepare: async () => { throw new Error("must not prepare"); }, publish: async () => null });
  assert((await handler(new Request("https://preview.test", { method: "POST", body: "{" }))).status === 400);
  assert((await handler(new Request("https://preview.test", { method: "POST", headers: { "content-length": "8388609" }, body: "{}" }))).status === 413);
});
