# Windows spawn EPERM Diagnostic

Glow Logic uses Next.js, Turbopack, and Playwright. On some Windows machines or sandboxes, those tools compile correctly and then fail when Node tries to spawn a child process:

```text
Error: spawn EPERM
```

This is usually an execution permission or security policy issue, not a TypeScript error.

## Run The Diagnostic

```bash
npm run doctor:eperm
```

The command writes a local report under `reports/field/` and checks:

- Node, npm, and npx paths.
- Node version and npm version.
- Whether Node can spawn a child Node process from the current shell.
- PowerShell execution policies.
- Windows Defender Controlled Folder Access preference, when readable.
- Running Node processes.

Reports under `reports/field/` are ignored by git.

## What To Allow In Windows Security

If the report points to Windows protection or the project is under Desktop, open Windows Security and check:

1. Virus & threat protection.
2. Ransomware protection.
3. Controlled folder access.
4. Allow an app through Controlled folder access.

Allow the Node executable shown in the report, usually one of:

```text
C:\Program Files\nodejs\node.exe
C:\Program Files\nodejs\npm.cmd
```

If you launch from a terminal app that is also blocked, allow that terminal too.

## Verify After Allowing

Run:

```bash
npm run build
npm run test:show
npm run test:visual
```

If the commands only fail inside Codex but pass in a normal Windows Terminal, keep the release report marked as `EPERM blocked in Codex sandbox`.

## Do Not

- Do not disable the safety gate to work around a build issue.
- Do not mark `npm run build` clean if it compiled and then hit `spawn EPERM`.
- Do not globally disable Windows security unless the operator explicitly chooses that outside the project.
