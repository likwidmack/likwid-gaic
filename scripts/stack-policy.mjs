/** Pure stack/GPU policy helpers (no Docker side effects). */

export const nvidiaOnlyProfiles = new Set(["media", "comfy"]);
export const nvidiaOnlyServices = new Set(["stable-diffusion", "comfy-backend", "comfy-frontend"]);

export function gpuServicesForProfile(gpuExclusive, profile) {
  const needed = new Set();
  for (const [service, profiles] of Object.entries(gpuExclusive.profilesByService ?? {})) {
    if (profiles.includes(profile)) needed.add(service);
  }
  return needed;
}

export function gpuConflictsForProfile(gpuExclusive, profile, runningGpuServices) {
  const needed = gpuServicesForProfile(gpuExclusive, profile);
  return runningGpuServices.filter((service) => !needed.has(service));
}

export function assertCpuAllowsProfile(computeMode, profile) {
  if (computeMode !== "cpu") return;
  if (nvidiaOnlyProfiles.has(profile)) {
    throw new Error(
      `Profile "${profile}" requires NVIDIA GPU images and is not supported when FORKEDAI_COMPUTE=cpu. Use inference or rag, or set FORKEDAI_COMPUTE=nvidia on a CUDA host.`
    );
  }
}

export function assertCpuAllowsService(computeMode, service) {
  if (computeMode !== "cpu") return;
  if (nvidiaOnlyServices.has(service)) {
    throw new Error(
      `Service "${service}" requires NVIDIA GPU images and is not supported when FORKEDAI_COMPUTE=cpu. Build/start it only with FORKEDAI_COMPUTE=nvidia on a CUDA host.`
    );
  }
}

export function assertGpuPreflight(gpuExclusive, computeMode, profile, runningGpuServices, { allowShare = false, gpuExclusiveEnabled = true } = {}) {
  assertCpuAllowsProfile(computeMode, profile);
  if (computeMode === "cpu") return;
  if (!gpuExclusiveEnabled) return;
  if (profile === "all") {
    throw new Error(
      "Starting all profiles on a single GPU host causes VRAM contention. Start one profile at a time or use `npm run stack -- switch PROFILE`."
    );
  }
  const conflicts = gpuConflictsForProfile(gpuExclusive, profile, runningGpuServices);
  if (conflicts.length && !allowShare) {
    throw new Error(
      `GPU conflict for profile "${profile}": ${conflicts.join(", ")} already running. Stop them, run \`npm run stack -- switch ${profile}\`, or pass --allow-gpu-share.`
    );
  }
}

export function parseProfileCommand(argv, startIndex = 3) {
  const flags = new Set();
  const positional = [];
  for (let index = startIndex; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--dry-run" || token === "--force" || token === "--allow-gpu-share") flags.add(token.slice(2));
    else positional.push(token);
  }
  return { profile: positional[0], flags };
}

/** CUDA backends require nvidia compute; whisper/piper may install on cpu. */
export function assertBackendAllowed(computeMode, backend) {
  const needsCuda = /cuda/i.test(backend);
  if (needsCuda && computeMode === "cpu") {
    throw new Error(
      "CUDA backend install is NVIDIA-only. With FORKEDAI_COMPUTE=cpu, LocalAI uses the CPU image backends; set FORKEDAI_COMPUTE=nvidia to install CUDA backends, or install whisper/piper without a cuda id."
    );
  }
}

export const smokeMatrix = [
  {
    step: 1,
    profile: "inference",
    expectGpu: ["localai"],
    gateway: "https://localhost:8443",
    note: "only localai holds the GPU; chat API responds"
  },
  {
    step: 2,
    profile: "media",
    expectGpu: ["stable-diffusion"],
    gateway: "https://localhost:8445",
    note: "LocalAI stops; Stable Diffusion loads"
  },
  {
    step: 3,
    profile: "rag",
    expectGpu: ["localai"],
    gateway: "https://localhost:8444",
    note: "LocalAI and PrivateGPT run; ingestion uses CPU while chat/embed hit GPU via LocalAI"
  }
];

export const gatewayProbeTargets = [
  { service: "localai", url: "https://localhost:8443/", profiles: ["inference", "rag"] },
  { service: "private-gpt", url: "https://localhost:8444/", profiles: ["rag"] },
  { service: "stable-diffusion", url: "https://localhost:8445/", profiles: ["media"] },
  { service: "comfy-frontend", url: "https://localhost:8446/", profiles: ["comfy"] },
  { service: "comfy-backend", url: "https://localhost:8447/", profiles: ["comfy"] }
];
