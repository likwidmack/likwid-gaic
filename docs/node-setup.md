# Node and npm setup

The task scripts require Node.js 20 or newer. At inventory time Windows could find `npm.ps1`, but `node.exe` was missing from PATH, so npm could not execute.

Repair or reinstall the current Node.js LTS release, open a new terminal, and verify:

```powershell
node --version
npm --version
npm install
npm test
```

No third-party npm packages are required by this repository.
