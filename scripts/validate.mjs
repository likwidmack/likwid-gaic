import { existsSync, readFileSync, readdirSync } from "node:fs";
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const config = JSON.parse(readFileSync(new URL("../config/repos.json", import.meta.url)));
const accounts = JSON.parse(readFileSync(new URL("../config/accounts.json", import.meta.url)));
const storage = JSON.parse(readFileSync(new URL("../config/storage.json", import.meta.url)));
const models = JSON.parse(readFileSync(new URL("../config/models.json", import.meta.url)));
const profileArtifacts = JSON.parse(readFileSync(new URL("../config/profile-artifacts.json", import.meta.url)));
const stack = JSON.parse(readFileSync(new URL("../config/stack.json", import.meta.url)));
if (pkg.private !== true) throw new Error("package.json must remain private");
if (config.repositories?.length !== 5) throw new Error("Expected five managed forks");
for (const repo of config.repositories) {
  for (const key of ["name", "github", "upstream", "pathWindows", "pathWsl", "pathPosix", "originSsh"]) {
    if (!repo[key]) throw new Error(`${repo.name ?? "repository"} is missing ${key}`);
  }
  if (!repo.pathPosix.startsWith("~/")) throw new Error(`POSIX path for ${repo.name} must start with ~/`);
  new URL(repo.github); new URL(repo.upstream);
  if (!/^git@github\.com:[\w.-]+\/[\w.-]+\.git$/.test(repo.originSsh)) throw new Error(`Invalid origin SSH URL for ${repo.name}`);
}
console.log("Configuration is valid.");
if (accounts.accounts?.hubOwner?.login !== "likwidmack") throw new Error("Hub owner must be likwidmack");
if (accounts.accounts?.forkOwner?.login !== "tamaramack") throw new Error("Fork owner must be tamaramack");
if (accounts.credentialPolicy?.storeTokensInRepository !== false) throw new Error("Tokens must never be stored in this repository");

const requiredScripts = [
  "stack",
  "stack:doctor",
  "stack:config",
  "stack:up",
  "stack:down",
  "stack:status",
  "stack:build",
  "stack:inference",
  "stack:rag",
  "stack:media",
  "stack:comfy",
  "stack:ollama",
  "models",
  "media",
  "ollama",
  "repos:status",
];
for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) throw new Error(`Missing npm script: ${script}`);
}
for (const [name, root] of Object.entries(storage.roots ?? {})) {
  if (!root.pathWindows || !root.pathWsl || !root.pathPosix) throw new Error(`Storage root ${name} needs Windows, WSL, and POSIX paths`);
  if (!root.pathPosix.startsWith("~/")) throw new Error(`POSIX path for storage root ${name} must start with ~/`);
}
for (const name of ["models", "huggingFaceCache", "torchCache", "comfyTemp", "media", "mediaBackup", "documents", "runtime", "sharedObjects", "tensors", "plugins", "tools"]) if (!storage.roots?.[name]) throw new Error("Missing storage root: " + name);
if (storage.roots.mediaBackup.pathWindows !== "E:\\VIMG" || storage.roots.mediaBackup.pathWsl !== "/mnt/e/VIMG") throw new Error("Media backup root must be E:\\VIMG");
if (storage.roots.mediaBackup.pathPosix !== "~/VIMG") throw new Error("POSIX media backup root must be ~/VIMG");
const aliases = new Set();
for (const model of models.models ?? []) {
  for (const key of ["alias", "repo", "revision", "localDir"]) if (!model[key]) throw new Error(`Model entry is missing ${key}`);
  if (aliases.has(model.alias)) throw new Error(`Duplicate model alias: ${model.alias}`);
  aliases.add(model.alias);
  if (/^(?:[A-Za-z]:[\\/]|[\\/])/.test(model.localDir) || model.localDir.split(/[\\/]/).includes("..")) throw new Error(`Model ${model.alias} escapes the model root`);
  if (!/^[0-9a-f]{40}$/i.test(model.revision)) throw new Error(`Model ${model.alias} must pin an immutable 40-character revision`);
  if (!Array.isArray(model.include) || !model.include.length) throw new Error(`Model ${model.alias} needs an explicit include list`);
  if (model.localAI) {
    const localAITypes = new Set(["chat", "embedding", "transcription", "tts"]);
    for (const key of ["configFile", "name", "model", "type"]) if (!model.localAI[key]) throw new Error(`LocalAI metadata for ${model.alias} is missing ${key}`);
    if (!localAITypes.has(model.localAI.type)) throw new Error(`LocalAI type for ${model.alias} must be chat, embedding, transcription, or tts`);
    if (model.localAI.type === "chat" || model.localAI.type === "embedding") {
      for (const key of ["contextSize", "gpuLayers"]) if (model.localAI[key] == null) throw new Error(`LocalAI metadata for ${model.alias} is missing ${key}`);
    }
    if ((model.localAI.type === "transcription" || model.localAI.type === "tts") && !model.localAI.backend) {
      throw new Error(`LocalAI metadata for ${model.alias} needs backend`);
    }
    if (!/^[\w.-]+\.ya?ml$/i.test(model.localAI.configFile)) throw new Error(`Invalid LocalAI config file for ${model.alias}`);
    if (!model.include.includes(model.localAI.model)) throw new Error(`LocalAI model file for ${model.alias} is not selected for download`);
  }
}
const artifactKinds = new Set(["model", "tensor", "plugin", "node", "directory", "object"]);
for (const [profile, spec] of Object.entries(profileArtifacts.profiles ?? {})) {
  if (!stack.profiles.includes(profile)) throw new Error(`profile-artifacts references unknown profile: ${profile}`);
  for (const tier of ["required", "stronglyRecommended"]) {
    for (const entry of spec[tier] ?? []) {
      if (!entry.id || !entry.kind || !entry.purpose) throw new Error(`Profile ${profile} ${tier} entry is missing id, kind, or purpose`);
      if (!artifactKinds.has(entry.kind)) throw new Error(`Profile ${profile} ${tier} entry ${entry.id} has invalid kind: ${entry.kind}`);
      if (entry.modelAlias && !aliases.has(entry.modelAlias)) throw new Error(`Profile ${profile} references unknown model alias: ${entry.modelAlias}`);
      if (entry.storageRoot && !storage.roots?.[entry.storageRoot]) throw new Error(`Profile ${profile} references unknown storage root: ${entry.storageRoot}`);
    }
  }
}
for (const group of Object.values(profileArtifacts.layout?.models ?? {})) {
  if (!Array.isArray(group) || !group.length) throw new Error("profile-artifacts layout.models groups must be non-empty arrays");
}
for (const dir of ["localai", "Stable-diffusion", "VAE", "Lora", "ControlNet", "embeddings"]) {
  if (!profileArtifacts.layout?.models?.a1111?.includes(dir)) throw new Error(`profile-artifacts layout.models.a1111 must include ${dir}`);
}
for (const dir of ["checkpoints", "vae", "loras", "controlnet", "upscale_models"]) {
  if (!profileArtifacts.layout?.models?.comfy?.includes(dir)) throw new Error(`profile-artifacts layout.models.comfy must include ${dir}`);
}
for (const alias of ["chat-qwen2.5-3b", "embed-nomic-v1.5", "sd15-starter"]) {
  if (!aliases.has(alias)) throw new Error(`Required managed model alias missing: ${alias}`);
}
const repoNames = new Set(config.repositories.map((repo) => repo.name));
if (stack.gateway?.defaultBindAddress !== "127.0.0.1") throw new Error("The HTTPS gateway must default to loopback");
for (const [service, port] of Object.entries({localai: 8443, "private-gpt": 8444, "stable-diffusion": 8445, comfy: 8446, "comfy-api": 8447, ollama: 8448})) if (stack.gateway?.defaultPorts?.[service] !== port) throw new Error(`Invalid HTTPS gateway port for ${service}`);
const networkKeys = new Set((stack.networks ?? []).map((network) => network.key));
for (const key of ["forkedai-edge", "forkedai-inference", "forkedai-media"]) if (!networkKeys.has(key)) throw new Error("Missing stack network: " + key);
for (const network of stack.networks ?? []) if (network.driver !== "bridge") throw new Error(`Stack network ${network.key} must use the bridge driver`);
for (const shared of stack.sharedStorage ?? []) {
  if (!storage.roots?.[shared.root]) throw new Error("Unknown shared storage root: " + shared.root);
  if (!shared.containerPath?.startsWith("/shared/")) throw new Error("Invalid shared container path: " + shared.containerPath);
  if (!["ro", "rw"].includes(shared.mode)) throw new Error("Invalid shared storage mode: " + shared.mode);
}
for (const service of stack.services ?? []) {
  if (!stack.profiles.includes(service.profile)) throw new Error(`Unknown profile for ${service.name}`);
  if (service.repository != null && !repoNames.has(service.repository)) throw new Error(`Unknown repository for ${service.name}`);
}
const gpuExclusive = stack.gpuExclusive;
if (!gpuExclusive?.services?.length) throw new Error("stack.gpuExclusive.services is required");
if (!gpuExclusive.profilesByService || typeof gpuExclusive.profilesByService !== "object") throw new Error("stack.gpuExclusive.profilesByService is required");
const gpuServiceSet = new Set(gpuExclusive.services);
for (const [service, profiles] of Object.entries(gpuExclusive.profilesByService)) {
  if (!gpuServiceSet.has(service)) throw new Error(`GPU exclusive profiles reference unknown service: ${service}`);
  if (!Array.isArray(profiles) || !profiles.length) throw new Error(`GPU exclusive service ${service} needs at least one profile`);
  for (const profile of profiles) if (!stack.profiles.includes(profile)) throw new Error(`GPU exclusive service ${service} references unknown profile: ${profile}`);
}
for (const service of gpuExclusive.services) if (!gpuExclusive.profilesByService[service]) throw new Error(`GPU exclusive service ${service} is missing profilesByService entry`);
const documentation = [
  "../AGENTS.md",
  "../README.md",
  ...readdirSync(new URL("../docs/", import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "inventory.generated.md")
    .map((entry) => `../docs/${entry.name}`)
].sort();
for (const file of documentation) {
  const url = new URL(file, import.meta.url);
  if (!existsSync(url)) throw new Error(`Missing documentation: ${file}`);
  const markdown = readFileSync(url, "utf8");
  for (const match of markdown.matchAll(/\[[^\]]+\]\((?!https?:|mailto:|#)([^)#]+)(?:#[^)]+)?\)/g)) {
    const target = new URL(match[1], url);
    if (!existsSync(target)) throw new Error(`Broken documentation link in ${file}: ${match[1]}`);
  }
}
for (const file of ["../compose.yaml", "../compose.cpu.yaml", "../.dockerignore", "../docker/Caddyfile", "../docker/gateway-auth.empty.caddy", "../docker/gateway-auth.basicauth.example.caddy", "../docker/stable-diffusion.Dockerfile", "../docker/comfy-frontend.Dockerfile", "../docker/comfyui.Dockerfile", "../scripts/paths.mjs"]) if (!existsSync(new URL(file, import.meta.url))) throw new Error(`Missing container artifact: ${file}`);
const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
for (const pattern of [".env.*", "docs/inventory.generated.md", "*.gguf", "*.safetensors", "*.sqlite", "documents/", "media/", "models/", "/shared/"]) if (!gitignore.includes(pattern)) throw new Error("Git privacy rules are missing " + pattern);
const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
if (!ciWorkflow.includes("name: Local parity")) throw new Error("CI must define a job named Local parity");
if (!ciWorkflow.includes("npm test")) throw new Error("CI Local parity must run npm test");
const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");
for (const pattern of ["**", "!docker/", "!docker/**"]) if (!dockerignore.includes(pattern)) throw new Error("Docker build-context rules are missing " + pattern);
const stableDockerfile = readFileSync(new URL("../docker/stable-diffusion.Dockerfile", import.meta.url), "utf8");
for (const repository of ["stable-diffusion-webui-assets", "stable-diffusion-stability-ai", "generative-models", "k-diffusion", "BLIP"]) if (!stableDockerfile.includes("safe.directory '/opt/stable-diffusion/repositories/" + repository + "'")) throw new Error("Stable Diffusion is missing scoped Git trust for " + repository);
for (const pattern of ["--exclude=.git", "--exclude=.env.*", "--exclude=models", "--exclude=outputs", "-r requirements_versions.txt", "--lora-dir", "/shared/models/Lora", "--vae-dir", "/shared/models/VAE"]) if (!stableDockerfile.includes(pattern)) throw new Error("Stable Diffusion build rules are missing " + pattern);
const comfyFrontendDockerfile = readFileSync(new URL("../docker/comfy-frontend.Dockerfile", import.meta.url), "utf8");
for (const pattern of ["--exclude=.git", "--exclude=.env.*", "--exclude=node_modules", "--exclude=dist"]) if (!comfyFrontendDockerfile.includes(pattern)) throw new Error("Comfy frontend build privacy rules are missing " + pattern);
const comfyNginx = readFileSync(new URL("../docker/comfy-nginx.conf.template", import.meta.url), "utf8");
// Variable proxy_pass + Docker embedded DNS so nginx re-resolves comfy-backend after recreate
// (literal proxy_pass caches the upstream IP at worker start and leaves the UI on the splash screen).
if (!comfyNginx.includes("resolver 127.0.0.11")) throw new Error("Comfy frontend nginx must use the Docker embedded DNS resolver");
if (!comfyNginx.includes("set $comfy_backend")) throw new Error("Comfy frontend nginx must proxy through a variable so DNS can re-resolve");
if (!/\$comfy_backend/.test(comfyNginx) || !comfyNginx.includes("proxy_pass $comfy_backend")) {
  throw new Error("Comfy frontend nginx must proxy_pass $comfy_backend (variable form)");
}
if (/proxy_pass\s+\$\{COMFY_BACKEND\}/.test(comfyNginx) || /proxy_pass\s+http:\/\/comfy-backend/.test(comfyNginx)) {
  throw new Error("Comfy frontend nginx must not use a literal/env-substituted proxy_pass upstream");
}
const comfyBackendDockerfile = readFileSync(new URL("../docker/comfyui.Dockerfile", import.meta.url), "utf8");
for (const pattern of ["--exclude=.git", "--exclude=.env.*", "--exclude=models", "--exclude=output", "/shared/models"]) if (!comfyBackendDockerfile.includes(pattern)) throw new Error("Comfy backend build rules are missing " + pattern);
const compose = readFileSync(new URL("../compose.yaml", import.meta.url), "utf8");
const composeCpu = readFileSync(new URL("../compose.cpu.yaml", import.meta.url), "utf8");
const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const envKeys = new Set([...envExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]));
if (!envKeys.has("FORKEDAI_COMPUTE")) throw new Error(".env.example is missing FORKEDAI_COMPUTE");
for (const variable of new Set([...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)(?::-[^}]*)?\}/g)].map((match) => match[1]))) {
  if (!envKeys.has(variable)) throw new Error(`.env.example is missing Compose variable ${variable}`);
}
if (!composeCpu.includes("localai/localai:v4.8.0")) throw new Error("compose.cpu.yaml must default LocalAI to the CPU image tag");
if (!composeCpu.includes("!reset")) throw new Error("compose.cpu.yaml must reset NVIDIA device reservations");
for (const service of ["localai", "stable-diffusion", "comfy-backend", "ollama"]) {
  if (!composeCpu.includes(`  ${service}:`)) throw new Error(`compose.cpu.yaml is missing ${service}`);
}
const storageBindings = {
  MODEL_ROOT: "models",
  HF_CACHE_ROOT: "huggingFaceCache",
  TORCH_CACHE_ROOT: "torchCache",
  COMFY_TEMP_ROOT: "comfyTemp",
  MEDIA_ROOT: "media",
  DOCUMENT_ROOT: "documents",
  RUNTIME_ROOT: "runtime",
  SHARED_OBJECT_ROOT: "sharedObjects",
  TENSOR_ROOT: "tensors",
  PLUGIN_ROOT: "plugins",
  TOOL_ROOT: "tools"
};
for (const [variable, root] of Object.entries(storageBindings)) if (!compose.includes(`\${${variable}:-${storage.roots[root].pathWsl}}`)) throw new Error(`Compose storage default for ${variable} does not match config/storage.json`);
if (compose.includes(storage.roots.mediaBackup.pathWsl) || compose.includes("MEDIA_BACKUP_ROOT")) throw new Error("Media backup storage must remain host-only and must not be mounted by Compose");
for (const service of stack.services) if (!compose.includes(`  ${service.name}:`)) throw new Error(`Compose is missing ${service.name}`);
for (const service of gpuExclusive.services) if (!compose.includes(`  ${service}:`)) throw new Error(`GPU exclusive service ${service} is missing from Compose`);
if (!compose.includes("  " + stack.gateway.service + ":")) throw new Error("Compose is missing the HTTPS gateway");
for (const network of stack.networks) if (!compose.includes("  " + network.key + ":")) throw new Error("Compose is missing network " + network.key);
for (const binding of ["LOCALAI_HTTPS_PORT:-8443", "PRIVATE_GPT_HTTPS_PORT:-8444", "STABLE_DIFFUSION_HTTPS_PORT:-8445", "COMFY_HTTPS_PORT:-8446", "COMFY_API_HTTPS_PORT:-8447", "OLLAMA_HTTPS_PORT:-8448"]) if (!compose.includes(binding)) throw new Error("Compose is missing HTTPS gateway binding " + binding);
if (!compose.includes("FORKEDAI_BIND_ADDRESS:-127.0.0.1")) throw new Error("The HTTPS gateway must publish on loopback by default");
if ((compose.match(/^    ports:/gm) ?? []).length !== 1) throw new Error("Only the HTTPS gateway may publish host ports");
if (!compose.includes("no-new-privileges:true")) throw new Error("Compose is missing the no-new-privileges baseline");
for (const mount of ["shared-models", "shared-models-inbox", "shared-tensors", "shared-objects", "shared-plugins", "shared-plugins-inbox", "shared-tools"]) if (!compose.includes("&" + mount) || !compose.includes("*" + mount)) throw new Error("Compose is missing shared mount " + mount);
for (const sharedPath of ["/shared/models", "/shared/models/inbox", "/shared/tensors", "/shared/objects", "/shared/plugins", "/shared/plugins/inbox", "/shared/tools"]) if (!compose.includes(sharedPath)) throw new Error("Compose is missing shared path " + sharedPath);
if (!compose.includes("target: /models/inbox")) throw new Error("LocalAI must mount a writable models inbox overlay at /models/inbox");
const sharedModelsBlock = compose.slice(compose.indexOf("x-shared-models:"), compose.indexOf("x-shared-models-inbox:"));
if (!sharedModelsBlock.includes("read_only: true")) throw new Error("Canonical shared models mount must remain read_only");
const modelsInboxBlock = compose.slice(compose.indexOf("x-shared-models-inbox:"), compose.indexOf("x-shared-tensors:"));
if (modelsInboxBlock.includes("read_only: true")) throw new Error("models inbox mount must be writable (omit read_only)");
const mediaScript = readFileSync(new URL("./media.mjs", import.meta.url), "utf8");
if (!mediaScript.includes("inbox")) throw new Error("media init must create models/inbox and plugins/inbox staging directories");
if (!mediaScript.includes("ensureWebuiDirBridges")) throw new Error("media init must ensure WebUI dir bridges for VAE/Lora/ControlNet");
if (!mediaScript.includes("bridgeInitExitCode")) {
  throw new Error("media init must fail closed via bridgeInitExitCode when WebUI dir bridges need manual action");
}
const webuiShare = readFileSync(new URL("./webui-share.mjs", import.meta.url), "utf8");
if (!webuiShare.includes("WEBUI_DIR_BRIDGES") || !webuiShare.includes("junction")) {
  throw new Error("webui-share.mjs must create WEBUI_DIR_BRIDGES junctions/symlinks");
}
if (!webuiShare.includes("export function bridgeInitExitCode")) {
  throw new Error("webui-share.mjs must export bridgeInitExitCode for media/models bridge failure contracts");
}
if (webuiShare.includes("rmSync")) throw new Error("webui-share.mjs must not recursively delete directories; media init is non-destructive");
if (!webuiShare.includes("if (!dryRun) mkdirSync(canonicalPath")) {
  throw new Error("webui-share dry-run must not mkdirSync canonical dirs");
}
const stackPolicy = readFileSync(new URL("./stack-policy.mjs", import.meta.url), "utf8");
if (!stackPolicy.includes("export function gpuSwitchPlan")) {
  throw new Error("stack-policy.mjs must export gpuSwitchPlan for CPU/nvidia switch stop/keep planning");
}
const dockerScript = readFileSync(new URL("./docker.mjs", import.meta.url), "utf8");
if (!dockerScript.includes("gpuSwitchPlan")) {
  throw new Error("docker.mjs switch must use gpuSwitchPlan for GPU stop/keep planning");
}
for (const endpoint of ["127.0.0.1:8080/v1/models", "127.0.0.1:7860/", "127.0.0.1:8188/system_stats", "127.0.0.1/"]) if (!compose.includes(endpoint)) throw new Error("Compose health checks are missing " + endpoint);
if (!compose.includes('"ollama", "list"')) throw new Error('Compose ollama healthcheck must use CMD ollama list (image has no curl)');
const caddyfile = readFileSync(new URL("../docker/Caddyfile", import.meta.url), "utf8");
for (const route of ["{$GATEWAY_HOSTNAME:localhost}:8443", "{$GATEWAY_HOSTNAME:localhost}:8444", "{$GATEWAY_HOSTNAME:localhost}:8445", "{$GATEWAY_HOSTNAME:localhost}:8446", "{$GATEWAY_HOSTNAME:localhost}:8447", "{$GATEWAY_HOSTNAME:localhost}:8448"]) if (!caddyfile.includes(route)) throw new Error("Caddy is missing hostname route " + route);
if (!caddyfile.includes("import /etc/caddy/snippets/gateway-auth.caddy")) throw new Error("Caddy must import the gateway-auth snippet");
if (!caddyfile.includes("import gateway_auth")) throw new Error("Caddy local_security must import gateway_auth");
for (const upstream of ["localai:8080", "private-gpt:8080", "stable-diffusion:7860", "comfy-frontend:80", "comfy-backend:8188", "ollama:11434"]) if (!caddyfile.includes(upstream)) throw new Error("Caddy is missing upstream " + upstream);
const caddy8443 = caddyfile.slice(caddyfile.indexOf(":8443 {"), caddyfile.indexOf(":8444 {"));
const caddyInference = caddyfile.includes("(inference_upstream)")
  ? caddyfile.slice(caddyfile.indexOf("(inference_upstream)"), caddyfile.indexOf(":8443 {"))
  : caddy8443;
const caddyUnified = caddyInference + caddy8443;
if (!caddyUnified.includes("localai:8080") || !caddyUnified.includes("ollama:11434")) {
  throw new Error("Caddy :8443 must health-check reverse_proxy to localai:8080 and ollama:11434");
}
if (!caddyUnified.includes("/readyz") || !caddyUnified.includes("/api/tags")) {
  throw new Error("Caddy :8443 must use /readyz for LocalAI and /api/tags for Ollama health checks");
}
if (!caddy8443.includes('Cache-Control "no-store"') || !caddy8443.includes("/v1/models")) {
  throw new Error("Caddy :8443 must set Cache-Control no-store on /v1/models");
}
if (!dockerScript.includes("models-refresh") || !dockerScript.includes("printModelsRefreshHint")) {
  throw new Error("docker.mjs must implement models-refresh and print a switch hint for inference/rag/ollama");
}
if (!caddyfile.includes("tls internal") || !caddyfile.includes("admin off")) throw new Error("Caddy must use its internal CA with the admin API disabled");
if (!compose.includes("gateway-auth.caddy")) throw new Error("Compose must mount the gateway-auth snippet");
if (!envKeys.has("GATEWAY_HOSTNAME")) throw new Error(".env.example is missing GATEWAY_HOSTNAME");
const emptyAuth = readFileSync(new URL("../docker/gateway-auth.empty.caddy", import.meta.url), "utf8");
if (!emptyAuth.includes("(gateway_auth)")) throw new Error("gateway-auth.empty.caddy must define the gateway_auth snippet");
const emptyAuthBody = emptyAuth
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");
if (/\bbasicauth\b/i.test(emptyAuthBody)) throw new Error("gateway-auth.empty.caddy must not enable basicauth");
console.log("Storage, model, media, and Compose configuration is valid.");
