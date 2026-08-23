import { existsSync, readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const config = JSON.parse(readFileSync(new URL("../config/repos.json", import.meta.url)));
const accounts = JSON.parse(readFileSync(new URL("../config/accounts.json", import.meta.url)));
const storage = JSON.parse(readFileSync(new URL("../config/storage.json", import.meta.url)));
const models = JSON.parse(readFileSync(new URL("../config/models.json", import.meta.url)));
const stack = JSON.parse(readFileSync(new URL("../config/stack.json", import.meta.url)));
if (pkg.private !== true) throw new Error("package.json must remain private");
if (config.repositories?.length !== 4) throw new Error("Expected four managed forks");
for (const repo of config.repositories) {
  for (const key of ["name", "github", "upstream", "pathWindows", "pathWsl"]) {
    if (!repo[key]) throw new Error(`${repo.name ?? "repository"} is missing ${key}`);
  }
  new URL(repo.github); new URL(repo.upstream);
}
console.log("Configuration is valid.");
if (accounts.accounts?.hubOwner?.login !== "likwidmack") throw new Error("Hub owner must be likwidmack");
if (accounts.accounts?.forkOwner?.login !== "tamaramack") throw new Error("Fork owner must be tamaramack");
if (accounts.credentialPolicy?.storeTokensInRepository !== false) throw new Error("Tokens must never be stored in this repository");

for (const script of ["stack", "models", "media", "repos:status"]) if (!pkg.scripts?.[script]) throw new Error(`Missing npm script: ${script}`);
for (const [name, root] of Object.entries(storage.roots ?? {})) if (!root.pathWindows || !root.pathWsl) throw new Error(`Storage root ${name} needs Windows and WSL paths`);
const aliases = new Set();
for (const model of models.models ?? []) {
  for (const key of ["alias", "repo", "revision", "localDir"]) if (!model[key]) throw new Error(`Model entry is missing ${key}`);
  if (aliases.has(model.alias)) throw new Error(`Duplicate model alias: ${model.alias}`);
  aliases.add(model.alias);
  if (model.localDir.split(/[\\/]/).includes("..")) throw new Error(`Model ${model.alias} escapes the model root`);
  if (!Array.isArray(model.include) || !model.include.length) throw new Error(`Model ${model.alias} needs an explicit include list`);
  if (model.localAI) {
    for (const key of ["configFile", "name", "model", "type", "contextSize", "gpuLayers"]) if (!model.localAI[key]) throw new Error(`LocalAI metadata for ${model.alias} is missing ${key}`);
    if (!model.include.includes(model.localAI.model)) throw new Error(`LocalAI model file for ${model.alias} is not selected for download`);
  }
}
const repoNames = new Set(config.repositories.map((repo) => repo.name));
if (stack.network?.driver !== "bridge") throw new Error("The shared stack network must use the bridge driver");
if (stack.network?.defaultBindAddress !== "127.0.0.1") throw new Error("Container ports must default to loopback");
for (const service of stack.services ?? []) {
  if (!stack.profiles.includes(service.profile)) throw new Error(`Unknown profile for ${service.name}`);
  if (!repoNames.has(service.repository)) throw new Error(`Unknown repository for ${service.name}`);
}
for (const file of ["../compose.yaml", "../.dockerignore", "../docker/stable-diffusion.Dockerfile", "../docker/comfy-frontend.Dockerfile"]) if (!existsSync(new URL(file, import.meta.url))) throw new Error(`Missing container artifact: ${file}`);
const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
for (const pattern of [".env.*", "docs/inventory.generated.md", "*.gguf", "*.safetensors", "*.sqlite", "documents/", "media/", "models/"]) if (!gitignore.includes(pattern)) throw new Error("Git privacy rules are missing " + pattern);
const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");
for (const pattern of ["**", "!docker/", "!docker/**"]) if (!dockerignore.includes(pattern)) throw new Error("Docker build-context rules are missing " + pattern);
const stableDockerfile = readFileSync(new URL("../docker/stable-diffusion.Dockerfile", import.meta.url), "utf8");
for (const repository of ["stable-diffusion-webui-assets", "stable-diffusion-stability-ai", "generative-models", "k-diffusion", "BLIP"]) if (!stableDockerfile.includes("safe.directory '/opt/stable-diffusion/repositories/" + repository + "'")) throw new Error("Stable Diffusion is missing scoped Git trust for " + repository);
for (const pattern of ["--exclude=.git", "--exclude=.env.*", "--exclude=models", "--exclude=outputs", "-r requirements_versions.txt"]) if (!stableDockerfile.includes(pattern)) throw new Error("Stable Diffusion build rules are missing " + pattern);
const comfyDockerfile = readFileSync(new URL("../docker/comfy-frontend.Dockerfile", import.meta.url), "utf8");
for (const pattern of ["--exclude=.git", "--exclude=.env.*", "--exclude=node_modules", "--exclude=dist"]) if (!comfyDockerfile.includes(pattern)) throw new Error("Comfy build privacy rules are missing " + pattern);
const compose = readFileSync(new URL("../compose.yaml", import.meta.url), "utf8");
for (const service of stack.services) if (!compose.includes(`  ${service.name}:`)) throw new Error(`Compose is missing ${service.name}`);
if (!compose.includes("  " + stack.network.key + ":")) throw new Error("Compose is missing the shared network");
if (!compose.includes("FORKEDAI_BIND_ADDRESS:-127.0.0.1")) throw new Error("Compose ports must default to loopback");
if (!compose.includes("no-new-privileges:true")) throw new Error("Compose is missing the no-new-privileges baseline");
for (const endpoint of ["127.0.0.1:8080/v1/models", "127.0.0.1:7860/", "127.0.0.1/"]) if (!compose.includes(endpoint)) throw new Error("Compose health checks are missing " + endpoint);
console.log("Storage, model, media, and Compose configuration is valid.");
