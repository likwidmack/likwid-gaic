# Node.js and npm setup

The task scripts require Node.js 20 or newer and use only Node built-ins. There are no third-party runtime dependencies.

## Verify execution

**PowerShell (Windows):**

```powershell
node --version
npm --version
npm install
npm test
npm run stack:doctor
```

**Bash (macOS / Linux / WSL):**

```bash
node --version
npm --version
npm install
npm test
npm run stack:doctor
```

`stack:doctor` verifies Node, Docker client/server, Docker Compose, NVIDIA GPU
(soft-warn in CPU mode), the Hugging Face CLI, configured storage roots, and
all five fork contexts. It prints the active `FORKEDAI_COMPUTE` mode.

If PowerShell resolves `npm.ps1` but cannot find `node.exe`, repair or reinstall the current Node.js LTS release, open a new terminal, and check `Get-Command node,npm`. Node must be available in the same environment that launches npm.

## Path and shell boundary

`scripts/paths.mjs` selects host paths from `config/`:

- Windows Node → `pathWindows`
- WSL Node → `pathWsl`
- macOS / native Linux → `pathPosix` (`~/...` expanded)

Model commands launched from Windows call the WSL `hf` CLI automatically. On
macOS and native Linux, install `hf` on the host PATH. Prefer running the
Windows Docker Desktop stack from PowerShell rather than an arbitrary WSL
working directory when using the Windows Docker CLI.

No global npm package is required by this repository. Custom script catalog:
[npm scripts](../README.md#npm-scripts) in the root README.
