import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  parseModelAddArgv,
  resolveModelPromote,
  resolvePluginPromote,
  summarizeReady,
  validateModelAddArgs,
  WEBUI_DIR_BRIDGES,
  webuiHardLinkFromPromote,
  webuiHardLinkPlans
} from "./model-policy.mjs";
import {
  assertBackendAllowed,
  assertCpuAllowsProfile,
  assertCpuAllowsService,
  assertGpuPreflight,
  gpuConflictsForProfile,
  gpuServicesForProfile,
  gpuSwitchPlan,
  parseProfileCommand,
  assertSmokeRunAllowed,
  readinessAction,
  smokeMatrix
} from "./stack-policy.mjs";

const gpuExclusive = {
  services: ["localai", "stable-diffusion", "comfy-backend", "ollama"],
  profilesByService: {
    localai: ["inference", "rag"],
    "stable-diffusion": ["media"],
    "comfy-backend": ["comfy"],
    ollama: ["ollama"]
  }
};

const sha = "0123456789abcdef0123456789abcdef01234567";
const modelsScript = fileURLToPath(new URL("./models.mjs", import.meta.url));

function runModels(...args) {
  return spawnSync(process.execPath, [modelsScript, ...args], { encoding: "utf8" });
}

describe("models download guidance", () => {
  it("directs non-Hub artifacts to each profile's recommendations", () => {
    const backend = runModels("download", "localai-backend");
    assert.equal(backend.status, 1);
    assert.match(backend.stderr, /npm run models -- recommendations inference/);
    assert.doesNotMatch(backend.stderr, /sdxl-base|sd15-starter/);

    const vae = runModels("download", "vae-directory");
    assert.equal(vae.status, 1);
    assert.match(vae.stderr, /media.*VAE/s);
    assert.match(vae.stderr, /comfy.*vae/s);
    assert.match(vae.stderr, /npm run models -- recommendations media/);
    assert.match(vae.stderr, /npm run models -- recommendations comfy/);
  });
});

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

describe("promote path policy", () => {
  const allowed = ["checkpoints", "localai", "Stable-diffusion", "loras"];

  it("maps inbox relative paths into the catalog layout", () => {
    const resolved = resolveModelPromote("checkpoints/demo.safetensors", allowed);
    assert.equal(resolved.relative, "checkpoints/demo.safetensors");
    assert.equal(resolved.preferred, true);
  });

  it("rejects path escape and unknown top dirs", () => {
    assert.throws(() => resolveModelPromote("../secrets.bin", allowed), /inbox/);
    assert.throws(() => resolveModelPromote("not-a-layout/x.safetensors", allowed), /allowed layout/);
  });

  it("requires --allow-pickle for pth/ckpt", () => {
    assert.throws(() => resolveModelPromote("checkpoints/x.pth", allowed), /allow-pickle/);
    assert.doesNotThrow(() => resolveModelPromote("checkpoints/x.pth", allowed, { allowPickle: true }));
  });

  it("resolves plugin promotes under a service", () => {
    const resolved = resolvePluginPromote("comfyui", "my-node", ["comfyui", "stable-diffusion"]);
    assert.equal(resolved.service, "comfyui");
    assert.equal(resolved.relative, "my-node");
  });
});

describe("webui hard link plans", () => {
  it("maps checkpoint pins into Stable-diffusion/", () => {
    const plans = webuiHardLinkPlans({
      localDir: "checkpoints",
      include: ["v1-5-pruned-emaonly-fp16.safetensors"]
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0].sourceRel, "checkpoints/v1-5-pruned-emaonly-fp16.safetensors");
    assert.equal(plans[0].targetRel, "Stable-diffusion/v1-5-pruned-emaonly-fp16.safetensors");
  });

  it("plans links after promoting checkpoints files", () => {
    const plan = webuiHardLinkFromPromote("checkpoints/demo.safetensors");
    assert.equal(plan.targetRel, "Stable-diffusion/demo.safetensors");
    assert.equal(webuiHardLinkFromPromote("localai/x.gguf"), null);
  });

  it("maps Comfy dirs to WebUI aliases for shared catalog bridges", () => {
    assert.deepEqual(
      WEBUI_DIR_BRIDGES.map((entry) => `${entry.canonical}->${entry.webui}`),
      ["vae->VAE", "loras->Lora", "controlnet->ControlNet"]
    );
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

  it("refuses media/comfy in CPU mode but allows ollama", () => {
    assert.throws(() => assertCpuAllowsProfile("cpu", "media"), /inference, rag, or ollama/);
    assert.throws(() => assertCpuAllowsProfile("cpu", "comfy"), /inference, rag, or ollama/);
    assert.doesNotThrow(() => assertCpuAllowsProfile("cpu", "ollama"));
    assert.throws(() => assertCpuAllowsService("cpu", "comfy-backend"), /nvidia/);
    assert.doesNotThrow(() => assertCpuAllowsService("cpu", "ollama"));
    assert.doesNotThrow(() => assertCpuAllowsProfile("cpu", "inference"));
  });

  it("maps ollama profile to the ollama GPU service", () => {
    assert.deepEqual([...gpuServicesForProfile(gpuExclusive, "ollama")], ["ollama"]);
    assert.deepEqual(gpuConflictsForProfile(gpuExclusive, "ollama", ["localai"]), ["localai"]);
  });

  it("CPU switch stops NVIDIA-only leftovers but keeps LocalAI+Ollama coexistence", () => {
    const withMedia = gpuSwitchPlan("cpu", gpuExclusive, "ollama", ["localai", "stable-diffusion", "ollama"]);
    assert.deepEqual(withMedia.toStop, ["stable-diffusion"]);
    assert.deepEqual(withMedia.toKeep, []);
    assert.equal(withMedia.warnStaleGpu, true);

    const coexistence = gpuSwitchPlan("cpu", gpuExclusive, "ollama", ["localai"]);
    assert.deepEqual(coexistence.toStop, []);
    assert.deepEqual(coexistence.toKeep, []);
    assert.equal(coexistence.warnStaleGpu, true);

    const idle = gpuSwitchPlan("cpu", gpuExclusive, "inference", []);
    assert.deepEqual(idle.toStop, []);
    assert.equal(idle.warnStaleGpu, false);
  });

  it("nvidia switch uses exclusive conflict stops", () => {
    const plan = gpuSwitchPlan("nvidia", gpuExclusive, "ollama", ["localai", "comfy-backend"]);
    assert.deepEqual(plan.toStop, ["localai", "comfy-backend"]);
    assert.deepEqual(plan.toKeep, ["ollama"]);
    assert.equal(plan.warnStaleGpu, false);
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
    const parsed = parseProfileCommand(["node", "docker.mjs", "up", "inference", "--allow-gpu-share", "--require-ready"], 3);
    assert.equal(parsed.profile, "inference");
    assert.ok(parsed.flags.has("allow-gpu-share"));
    assert.ok(parsed.flags.has("require-ready"));
  });

  it("maps soft readiness actions", () => {
    assert.equal(readinessAction({ missingRequired: false }), "continue");
    assert.equal(readinessAction({ missingRequired: true }), "warn");
    assert.equal(readinessAction({ missingRequired: true, requireReady: true }), "fail");
    assert.equal(readinessAction({ missingRequired: true, skipReady: true }), "continue");
  });

  it("exposes the three-step smoke matrix", () => {
    assert.equal(smokeMatrix.length, 3);
    assert.equal(smokeMatrix[0].profile, "inference");
    assert.equal(smokeMatrix[1].profile, "media");
    assert.equal(smokeMatrix[2].profile, "rag");
  });

  it("refuses smoke --run in CPU mode", () => {
    assert.throws(() => assertSmokeRunAllowed("cpu"), /nvidia/);
    assert.doesNotThrow(() => assertSmokeRunAllowed("nvidia"));
  });
});
