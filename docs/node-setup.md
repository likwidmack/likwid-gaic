# Node.js and npm setup

The task scripts require Node.js 20 or newer and use only Node built-ins. There are no third-party runtime dependencies.

## Verify Windows execution

Run the tasks from a Windows PowerShell session:

```powershell
node --version
npm --version
npm install
npm test
npm run stack:doctor
```

`stack:doctor` verifies Node, Docker client/server, Docker Compose, the NVIDIA GPU, the WSL Hugging Face CLI, configured storage roots, and all five fork contexts.

If PowerShell resolves `npm.ps1` but cannot find `node.exe`, repair or reinstall the current Node.js LTS release, open a new terminal, and check `Get-Command node,npm`. Node must be available in the same environment that launches npm.

## Windows and WSL boundary

The npm scripts choose Windows or WSL paths from `config/` according to the Node process platform. Model commands launched from Windows call the WSL `hf` CLI automatically. Avoid launching Windows Node from an arbitrary WSL working directory; use PowerShell when operating the Windows Docker Desktop stack.

No global npm package is required by this repository.
