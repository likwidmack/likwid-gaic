import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseModelAddArgv, summarizeReady, validateModelAddArgs } from "./model-policy.mjs";
import {
  assertBackendAllowed,
  assertCpuAllowsProfile,
  assertCpuAllowsService,
  assertGpuPreflight,
  gpuConflictsForProfile,
  gpuServicesForProfile,
  parseProfileCommand,
  smokeMatrix
} from "./stack-policy.mjs";

const gpuExclusive = {
  services: ["localai", "stable-diffusion", "comfy-backend"],
  profilesByService: {
    localai: ["inference", "rag"],
    "stable-diffusion": ["media"],
    "comfy-backend": ["comfy"]
  }
};

const sha = "0123456789abcdef0123456789abcdef01234567";

describe("validateModelAddArgs", () => {
  it("requires a 40-character revision and include list", () => {
    const entry = validateModelAddArgs({
      alias: "demo",
      repo: "owner/name",
      revision: sha,
      localDir: "localai/demo",
      include: ["model.gguf"]
    });
    assert.equal(entry.revision, sha);
    assert.deepEqual(entry.include, ["model.gguf"]);
  });

  it("rejects main and empty includes", () => {
    assert.throws(
      () => validateModelAddArgs({ alias: "demo", repo: "owner/name", revision: "main", localDir: "demo", include: ["a"] }),
      /40-character/
    );
    assert.throws(
      () => validateModelAddArgs({ alias: "demo", repo: "owner/name", revision: sha, localDir: "demo", include: [] }),
      /--include/
    );
  });

  it("parses add argv with --include flags", () => {
    const entry = parseModelAddArgv(["demo", "owner/name", sha, "localai/demo", "--include", "a.gguf", "--include", "b.yaml"]);
    assert.deepEqual(entry.include, ["a.gguf", "b.yaml"]);
    assert.equal(entry.localDir, "localai/demo");
  });
});

describe("summarizeReady", () => {
  it("fails when required artifacts are missing", () => {
    const summary = summarizeReady(
      [
        { id: "a", state: "present" },
        { id: "b", state: "missing" }
      ],
      [{ id: "c", state: "missing" }]
    );
    assert.equal(summary.ok, false);
    assert.equal(summary.requiredMissing.length, 1);
    assert.equal(summary.recommendedMissing.length, 1);
  });

  it("passes when required artifacts are present", () => {
    const summary = summarizeReady([{ id: "a", state: "present" }], [{ id: "c", state: "missing" }]);
    assert.equal(summary.ok, true);
  });
});

describe("stack GPU and CPU policy", () => {
  it("maps profiles to exclusive GPU services", () => {
    assert.deepEqual([...gpuServicesForProfile(gpuExclusive, "media")], ["stable-diffusion"]);
    assert.deepEqual([...gpuServicesForProfile(gpuExclusive, "rag")], ["localai"]);
  });

  it("detects GPU conflicts", () => {
    assert.deepEqual(gpuConflictsForProfile(gpuExclusive, "media", ["localai"]), ["localai"]);
    assert.deepEqual(gpuConflictsForProfile(gpuExclusive, "inference", ["localai"]), []);
  });

  it("refuses media/comfy in CPU mode", () => {
    assert.throws(() => assertCpuAllowsProfile("cpu", "media"), /nvidia/);
    assert.throws(() => assertCpuAllowsService("cpu", "comfy-backend"), /nvidia/);
    assert.doesNotThrow(() => assertCpuAllowsProfile("cpu", "inference"));
  });

  it("blocks up when another GPU service is running", () => {
    assert.throws(
      () => assertGpuPreflight(gpuExclusive, "nvidia", "media", ["localai"], { allowShare: false }),
      /GPU conflict/
    );
    assert.doesNotThrow(() =>
      assertGpuPreflight(gpuExclusive, "nvidia", "media", ["localai"], { allowShare: true })
    );
  });

  it("allows whisper/piper backends on CPU but not CUDA ids", () => {
    assert.doesNotThrow(() => assertBackendAllowed("cpu", "whisper"));
    assert.throws(() => assertBackendAllowed("cpu", "localai@cuda13-llama-cpp"), /NVIDIA-only/);
  });

  it("parses profile command flags", () => {
    const parsed = parseProfileCommand(["node", "docker.mjs", "up", "inference", "--allow-gpu-share"], 3);
    assert.equal(parsed.profile, "inference");
    assert.ok(parsed.flags.has("allow-gpu-share"));
  });

  it("exposes the three-step smoke matrix", () => {
    assert.equal(smokeMatrix.length, 3);
    assert.equal(smokeMatrix[0].profile, "inference");
    assert.equal(smokeMatrix[1].profile, "media");
    assert.equal(smokeMatrix[2].profile, "rag");
  });
});
