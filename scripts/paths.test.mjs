import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { expandHome, hostPath, isAutoComputeEnv, pathFlavor, pathKey, pathModule, resolveComputeMode, usesPosixPaths } from "./paths.mjs";

describe("expandHome", () => {
  it("expands ~/ relative paths with os.homedir()", () => {
    assert.equal(expandHome("~/gaic/models"), path.join(os.homedir(), "gaic", "models"));
  });

  it("expands bare ~ to the home directory", () => {
    assert.equal(expandHome("~"), os.homedir());
  });

  it("leaves absolute and empty values unchanged", () => {
    assert.equal(expandHome("/tmp/models"), "/tmp/models");
    assert.equal(expandHome(""), "");
    assert.equal(expandHome(null), null);
  });
});

describe("hostPath", () => {
  const entry = {
    pathWindows: "C:\\gaic\\models",
    pathWsl: "/mnt/c/gaic/models",
    pathPosix: "~/gaic/models"
  };

  it("selects Windows, WSL, and POSIX keys by flavor", () => {
    assert.equal(hostPath(entry, "windows"), "C:\\gaic\\models");
    assert.equal(hostPath(entry, "wsl"), "/mnt/c/gaic/models");
    assert.equal(hostPath(entry, "posix"), path.join(os.homedir(), "gaic", "models"));
  });

  it("throws when the flavor key is missing", () => {
    assert.throws(() => hostPath({ pathWindows: "C:\\x" }, "posix"), /pathPosix/);
  });
});

describe("path helpers", () => {
  it("maps flavors to config keys and path modules", () => {
    assert.equal(pathKey("windows"), "pathWindows");
    assert.equal(pathKey("wsl"), "pathWsl");
    assert.equal(pathKey("posix"), "pathPosix");
    assert.equal(usesPosixPaths("windows"), false);
    assert.equal(usesPosixPaths("posix"), true);
    assert.equal(pathModule("windows"), path.win32);
    assert.equal(pathModule("posix"), path.posix);
  });

  it("reports a known path flavor for the current process", () => {
    assert.ok(["windows", "wsl", "posix"].includes(pathFlavor()));
  });
});

describe("resolveComputeMode", () => {
  it("honors explicit nvidia and cpu values without probing", () => {
    let probed = 0;
    const probe = () => {
      probed += 1;
      return true;
    };
    assert.equal(resolveComputeMode({ FORKEDAI_COMPUTE: "nvidia" }, "darwin", { probe }), "nvidia");
    assert.equal(resolveComputeMode({ FORKEDAI_COMPUTE: "CPU" }, "win32", { probe }), "cpu");
    assert.equal(probed, 0);
  });

  it("treats unset and auto as probe-driven", () => {
    assert.equal(resolveComputeMode({}, "darwin", { probe: () => true }), "nvidia");
    assert.equal(resolveComputeMode({ FORKEDAI_COMPUTE: "auto" }, "linux", { probe: () => true }), "nvidia");
    assert.equal(resolveComputeMode({}, "win32", { probe: () => false }), "cpu");
    assert.equal(resolveComputeMode({ FORKEDAI_COMPUTE: "AUTO" }, "darwin", { probe: () => false }), "cpu");
  });

  it("rejects invalid values", () => {
    assert.throws(
      () => resolveComputeMode({ FORKEDAI_COMPUTE: "metal" }, "darwin", { probe: () => true }),
      /Invalid FORKEDAI_COMPUTE/
    );
  });
});

describe("isAutoComputeEnv", () => {
  it("is true for unset and auto, false for pinned modes", () => {
    assert.equal(isAutoComputeEnv({}), true);
    assert.equal(isAutoComputeEnv({ FORKEDAI_COMPUTE: "auto" }), true);
    assert.equal(isAutoComputeEnv({ FORKEDAI_COMPUTE: " AUTO " }), true);
    assert.equal(isAutoComputeEnv({ FORKEDAI_COMPUTE: "nvidia" }), false);
    assert.equal(isAutoComputeEnv({ FORKEDAI_COMPUTE: "cpu" }), false);
  });
});
