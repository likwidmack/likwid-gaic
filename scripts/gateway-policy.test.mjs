import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertGatewayAuthForBind, gatewayAuthSnippetHasBasicAuth, isLoopbackBind } from "./gateway-policy.mjs";

describe("gateway bind policy", () => {
  it("treats loopback addresses as local", () => {
    assert.equal(isLoopbackBind("127.0.0.1"), true);
    assert.equal(isLoopbackBind("localhost"), true);
    assert.equal(isLoopbackBind("::1"), true);
    assert.equal(isLoopbackBind("0.0.0.0"), false);
    assert.equal(isLoopbackBind("192.168.1.10"), false);
  });

  it("detects basicauth in auth snippets", () => {
    assert.equal(gatewayAuthSnippetHasBasicAuth("(gateway_auth) {\n}\n"), false);
    assert.equal(gatewayAuthSnippetHasBasicAuth("(gateway_auth) {\n\tbasicauth bcrypt {\n\t\tuser hash\n\t}\n}\n"), true);
  });

  it("requires basicauth when bind is not loopback", () => {
    assert.doesNotThrow(() => assertGatewayAuthForBind({ bindAddress: "127.0.0.1", authSnippetText: "(gateway_auth) {\n}\n" }));
    assert.throws(
      () => assertGatewayAuthForBind({ bindAddress: "0.0.0.0", authSnippetText: "(gateway_auth) {\n}\n" }),
      /basicauth/
    );
    assert.doesNotThrow(() =>
      assertGatewayAuthForBind({
        bindAddress: "0.0.0.0",
        authSnippetText: "(gateway_auth) {\n\tbasicauth bcrypt {\n\t\top hash\n\t}\n}\n"
      })
    );
  });
});
