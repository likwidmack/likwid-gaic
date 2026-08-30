import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { after, describe, it } from "node:test";
import { ensureWebuiDirBridges } from "./webui-share.mjs";

// "Lora" and "loras" differ on case-insensitive filesystems too, so this bridge
// is the one exercised on every platform.
const WEBUI = "Lora";
const CANONICAL = "loras";
const LABEL = `${WEBUI} → ${CANONICAL}`;

const tempRoots = [];

function tempRoot() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "forkedai-webui-"));
  tempRoots.push(dir);
  return dir;
}

function samePath(a, b) {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function assertLinkedTo(root) {
  const webuiPath = path.join(root, WEBUI);
  const target = path.resolve(path.dirname(webuiPath), readlinkSync(webuiPath));
  assert.ok(samePath(target, path.join(root, CANONICAL)), `${webuiPath} should point at ${CANONICAL}/`);
}

after(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

describe("ensureWebuiDirBridges", () => {
  it("never deletes a real WebUI directory that holds content", () => {
    const root = tempRoot();
    const keep = path.join(root, WEBUI, "style.safetensors");
    mkdirSync(path.join(root, WEBUI), { recursive: true });
    writeFileSync(keep, "weights");

    const result = ensureWebuiDirBridges(root);

    assert.ok(existsSync(keep), "existing WebUI content must survive");
    assert.equal(lstatSync(path.join(root, WEBUI)).isSymbolicLink(), false);
    assert.ok(!result.ok.some((line) => line.startsWith(LABEL)));
    const error = result.errors.find((line) => line.startsWith(LABEL));
    assert.match(error, /merge them into loras\/ manually/);
  });

  it("keeps failing closed on a populated directory even with force", () => {
    const root = tempRoot();
    const keep = path.join(root, WEBUI, "style.safetensors");
    mkdirSync(path.join(root, WEBUI), { recursive: true });
    writeFileSync(keep, "weights");

    const result = ensureWebuiDirBridges(root, { force: true });

    assert.ok(existsSync(keep), "force must not delete WebUI content");
    assert.ok(result.errors.some((line) => line.startsWith(LABEL)));
  });

  it("replaces an empty WebUI directory with a bridge", () => {
    const root = tempRoot();
    mkdirSync(path.join(root, WEBUI), { recursive: true });

    const result = ensureWebuiDirBridges(root);

    assert.ok(result.ok.includes(LABEL));
    assertLinkedTo(root);
  });

  it("creates the bridge when the WebUI directory is missing", () => {
    const root = tempRoot();

    const result = ensureWebuiDirBridges(root);

    assert.ok(result.ok.includes(LABEL));
    assert.ok(existsSync(path.join(root, CANONICAL)));
    assertLinkedTo(root);
  });

  it("leaves an already correct bridge in place", () => {
    const root = tempRoot();
    ensureWebuiDirBridges(root);

    const result = ensureWebuiDirBridges(root);

    assert.ok(result.ok.includes(`${LABEL} (already linked)`));
    assert.ok(!result.errors.some((line) => line.startsWith(LABEL)));
    assertLinkedTo(root);
  });

  it("repoints a stray link with force without touching what it pointed at", () => {
    const root = tempRoot();
    const stray = path.join(root, "stray");
    const keep = path.join(stray, "style.safetensors");
    mkdirSync(stray, { recursive: true });
    writeFileSync(keep, "weights");
    if (process.platform === "win32") symlinkSync(stray, path.join(root, WEBUI), "junction");
    else symlinkSync("stray", path.join(root, WEBUI), "dir");

    const withoutForce = ensureWebuiDirBridges(root);
    assert.match(
      withoutForce.errors.find((line) => line.startsWith(LABEL)),
      /points elsewhere/
    );

    const result = ensureWebuiDirBridges(root, { force: true });

    assert.ok(result.ok.includes(LABEL));
    assert.ok(existsSync(keep), "the previous link target must keep its content");
    assertLinkedTo(root);
  });

  it("changes nothing under dry-run", () => {
    const root = tempRoot();

    const result = ensureWebuiDirBridges(root, { dryRun: true });

    assert.ok(result.ok.includes(`${LABEL} (dry-run)`));
    assert.equal(existsSync(path.join(root, WEBUI)), false);
  });
});
