import { readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const config = JSON.parse(readFileSync(new URL("../config/repos.json", import.meta.url)));
const accounts = JSON.parse(readFileSync(new URL("../config/accounts.json", import.meta.url)));
if (pkg.private !== true) throw new Error("package.json must remain private");
if (config.repositories?.length !== 3) throw new Error("Expected three managed forks");
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
