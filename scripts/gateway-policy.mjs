/** Pure gateway bind/auth policy helpers. */

export function isLoopbackBind(address) {
  const value = String(address ?? "127.0.0.1").trim().toLowerCase();
  return (
    value === "" ||
    value === "127.0.0.1" ||
    value === "localhost" ||
    value === "::1" ||
    value === "0:0:0:0:0:0:0:1"
  );
}

export function gatewayAuthSnippetHasBasicAuth(text) {
  return /\bbasicauth\b/i.test(String(text ?? ""));
}

/**
 * Non-loopback binds require a runtime auth snippet that enables basicauth.
 * Loopback keeps the no-op empty snippet.
 */
export function assertGatewayAuthForBind({ bindAddress, authSnippetText }) {
  if (isLoopbackBind(bindAddress)) return;
  if (!gatewayAuthSnippetHasBasicAuth(authSnippetText)) {
    throw new Error(
      `FORKEDAI_BIND_ADDRESS=${bindAddress} is not loopback. Install hashed gateway basicauth in RUNTIME_ROOT/caddy/gateway-auth.caddy (see docker/gateway-auth.basicauth.example.caddy and docs/network-security.md) before exposing the gateway.`
    );
  }
}
