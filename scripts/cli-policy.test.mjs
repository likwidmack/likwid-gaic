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
  assertHostOllamaGpuPreflight,
  computePowerLimitWatts,
  gpuConflictsForProfile,
  gpuServicesForProfile,
  gpuSwitchPlan,
  gatewayModelsUrl,
  gatewayProbeTargets,
  inferActiveEngine,
  isBuildableService,
  parseGatewayModelIds,
  parsePercent,
  parsePowerWatts,
  parseProfileCommand,
  planPowerCapAction,
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

  it("refuses host Ollama when Compose GPU services are running", () => {
    assert.throws(
      () => assertHostOllamaGpuPreflight(["localai"], { allowShare: false }),
      /Host Ollama refused/
    );
    assert.doesNotThrow(() =>
      assertHostOllamaGpuPreflight(["localai"], { allowShare: true })
    );
    assert.doesNotThrow(() =>
      assertHostOllamaGpuPreflight(["localai"], { gpuExclusiveEnabled: false })
    );
    assert.doesNotThrow(() => assertHostOllamaGpuPreflight([], { allowShare: false }));
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
    const matrix = smokeMatrix({});
    assert.equal(matrix.length, 3);
    assert.equal(matrix[0].profile, "inference");
    assert.equal(matrix[1].profile, "media");
    assert.equal(matrix[2].profile, "rag");
  });

  it("honors GATEWAY_HOSTNAME/port overrides in the smoke matrix and gateway probes", () => {
    const env = { GATEWAY_HOSTNAME: "dev.local", LOCALAI_HTTPS_PORT: "9443" };
    assert.equal(smokeMatrix(env)[0].gateway, "https://dev.local:9443");
    const probes = gatewayProbeTargets(env);
    assert.equal(probes[0].url, "https://dev.local:9443/");
  });

  it("refuses smoke --run in CPU mode", () => {
    assert.throws(() => assertSmokeRunAllowed("cpu"), /nvidia/);
    assert.doesNotThrow(() => assertSmokeRunAllowed("nvidia"));
  });

  it("builds the unified gateway models URL from env", () => {
    assert.equal(gatewayModelsUrl({}), "https://localhost:8443/v1/models");
    assert.equal(
      gatewayModelsUrl({ GATEWAY_HOSTNAME: "dev.local", LOCALAI_HTTPS_PORT: "9443" }),
      "https://dev.local:9443/v1/models"
    );
  });

  it("parses OpenAI model list payloads", () => {
    const body = JSON.stringify({ data: [{ id: "chat-qwen2.5-3b" }, { id: "embed-nomic-v1.5" }] });
    assert.deepEqual(parseGatewayModelIds(body), ["chat-qwen2.5-3b", "embed-nomic-v1.5"]);
    assert.throws(() => parseGatewayModelIds("not-json"), /valid JSON/);
    assert.throws(() => parseGatewayModelIds("{}"), /data array/);
  });

  it("infers the active inference engine from container state", () => {
    assert.equal(inferActiveEngine({ runningLocalai: true, runningOllama: false, httpOk: true }), "localai");
    assert.equal(inferActiveEngine({ runningLocalai: false, runningOllama: true, httpOk: true }), "ollama");
    assert.equal(inferActiveEngine({ runningLocalai: true, runningOllama: true, httpOk: true }), "localai");
    assert.equal(inferActiveEngine({ runningLocalai: false, runningOllama: false, httpOk: false }), "none");
  });

  it("treats buildable as an explicit flag, not repository presence", () => {
    assert.equal(isBuildableService({ buildable: true }), true);
    assert.equal(isBuildableService({ buildable: true, repository: "LocalAI-Prt" }), true);
    assert.equal(isBuildableService({ repository: "LocalAI-Prt" }), false);
    assert.equal(isBuildableService({}), false);
  });

  it("computes a whole-watt power limit from a percentage of max", () => {
    assert.equal(computePowerLimitWatts(320, 85), 272);
    assert.equal(computePowerLimitWatts(450, 85), 382);
    assert.equal(computePowerLimitWatts(320, 100), 320);
    assert.equal(computePowerLimitWatts(320, 1), 3);
  });

  it("rejects an out-of-range percentage", () => {
    assert.throws(() => computePowerLimitWatts(320, 0), /percent/i);
    assert.throws(() => computePowerLimitWatts(320, 101), /percent/i);
    assert.throws(() => computePowerLimitWatts(320, -5), /percent/i);
  });

  it("parses power watts from nvidia-smi CSV output", () => {
    assert.equal(parsePowerWatts("320.00", "power.max_limit"), 320);
    assert.throws(() => parsePowerWatts("[N/A]", "power.max_limit"), /unusable power\.max_limit/);
    assert.throws(() => parsePowerWatts("", "power.limit"), /unusable power\.limit/);
    assert.throws(() => parsePowerWatts("-5", "power.limit"), /unusable power\.limit/);
    assert.throws(() => parsePowerWatts("abc", "power.limit"), /unusable power\.limit/);
  });

  it("parses GAIC_GPU_POWER_LIMIT_PERCENT with an 85 default", () => {
    assert.equal(parsePercent("75"), 75);
    assert.equal(parsePercent(undefined), 85);
    assert.equal(parsePercent(""), 85);
    assert.equal(parsePercent("   "), 85);
  });

  it("gpu:cap-power dry-run previews without ever suggesting an apply happened", () => {
    const belowTarget = planPowerCapAction({ maxWatts: 600, currentWatts: 600, minWatts: 400, percent: 85, dryRun: true });
    assert.equal(belowTarget.kind, "dry-run-preview");
    assert.equal(belowTarget.targetWatts, 510);
    assert.equal(belowTarget.exitCode, 0);
    assert.ok(belowTarget.messages.some((m) => m.includes("Would apply: nvidia-smi -pl 510")));

    const alreadyAtTarget = planPowerCapAction({ maxWatts: 600, currentWatts: 510, minWatts: 400, percent: 85, dryRun: true });
    assert.equal(alreadyAtTarget.kind, "dry-run-preview");
    assert.ok(alreadyAtTarget.messages.some((m) => m.includes("would make no change")));
  });

  it("gpu:cap-power refuses to plan an apply below the GPU's minimum power limit", () => {
    // 300W target (50% of 600W) is below a 400W floor -- must fail closed, not call nvidia-smi -pl.
    const plan = planPowerCapAction({ maxWatts: 600, currentWatts: 600, minWatts: 400, percent: 50, dryRun: false });
    assert.equal(plan.kind, "below-min");
    assert.equal(plan.exitCode, 1);
    assert.ok(plan.messages.some((m) => /below this GPU's minimum power limit \(400W\)/.test(m)));
    assert.ok(plan.messages.some((m) => /raise GAIC_GPU_POWER_LIMIT_PERCENT to at least 67/.test(m)));

    // Same below-min check applies in dry-run mode too.
    const dryPlan = planPowerCapAction({ maxWatts: 600, currentWatts: 600, minWatts: 400, percent: 50, dryRun: true });
    assert.equal(dryPlan.kind, "below-min");
  });

  it("gpu:cap-power reports already-capped without an apply plan", () => {
    const plan = planPowerCapAction({ maxWatts: 600, currentWatts: 510, minWatts: 400, percent: 85, dryRun: false });
    assert.equal(plan.kind, "already-capped");
    assert.equal(plan.exitCode, 0);
  });

  it("gpu:cap-power plans a real apply only outside dry-run and above the minimum", () => {
    const plan = planPowerCapAction({ maxWatts: 600, currentWatts: 600, minWatts: 400, percent: 85, dryRun: false });
    assert.equal(plan.kind, "apply");
    assert.equal(plan.targetWatts, 510);
    assert.equal(plan.exitCode, 0);
  });

  it("gpu-power-cap.mjs does not execute main() when merely imported (safe for tests)", async () => {
    // Importing must never touch nvidia-smi or process.exitCode; this guards
    // against a regression of the import.meta.url guard.
    const before = process.exitCode;
    await import("./gpu-power-cap.mjs");
    assert.equal(process.exitCode, before);
  });
});
