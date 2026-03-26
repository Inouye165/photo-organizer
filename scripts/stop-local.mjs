import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(rootDir, "..");
const composeFile = path.join(repoDir, "infra", "docker-compose.yml");
const runLogPath = path.join(repoDir, "docs", "start-local-results.md");
const runStatePath = path.join(repoDir, ".local-start-state.json");
const frontendPort = 5173;
const backendPort = 8000;
const postgresContainerName = "photo-organizer-postgres";
const dockerCliCandidates = [
  process.env.PHOTO_ORGANIZER_DOCKER_CLI,
  "docker",
  path.join("C:\\", "Program Files", "Docker", "Docker", "resources", "bin", "docker.exe"),
].filter(Boolean);
const dockerComposeStandaloneCandidates = [
  process.env.PHOTO_ORGANIZER_DOCKER_COMPOSE_CLI,
  "docker-compose",
  path.join("C:\\", "Program Files", "Docker", "Docker", "resources", "bin", "docker-compose.exe"),
].filter(Boolean);

let dockerCliCommandPromise;
let composeInvocationPromise;

function logTimestamp() {
  return new Date().toISOString();
}

function appendRunLogLine(filePath, line = "") {
  appendFileSync(filePath, `${line}\n`, "utf8");
}

function loadActiveRunState() {
  if (!existsSync(runStatePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(runStatePath, "utf8"));
  } catch {
    return null;
  }
}

function finalizeActiveRunLog(runState) {
  if (!runState || runState.finalized) {
    rmSync(runStatePath, { force: true });
    return;
  }

  const targetRunLogPath = typeof runState.runLogPath === "string" && runState.runLogPath.trim().length > 0
    ? runState.runLogPath
    : runLogPath;
  const endedAt = logTimestamp();
  const hostname = typeof runState.hostname === "string" && runState.hostname.trim().length > 0
    ? runState.hostname
    : os.hostname();
  const details = [
    `Startup ready state: ${runState.startupReachedReadyState ? "reached" : "not reached"}`,
    `Frontend target: ${runState.frontendUrl ?? `http://127.0.0.1:${frontendPort}/`}`,
    `Backend target: ${runState.backendUrl ?? `http://127.0.0.1:${backendPort}/health`}`,
    `Stop source: npm run stop:local on host ${hostname}`,
  ];

  appendRunLogLine(targetRunLogPath, `- ${endedAt} | INFO | Stop requested by npm run stop:local.`);
  appendRunLogLine(targetRunLogPath, `- Ended: ${endedAt}`);
  appendRunLogLine(targetRunLogPath, "- Outcome: SUCCESS");
  for (const detail of details) {
    appendRunLogLine(targetRunLogPath, `- Detail: ${detail}`);
  }
  appendRunLogLine(targetRunLogPath);

  rmSync(runStatePath, { force: true });
}

function escapeForWmi(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoDir,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: options.shell ?? false,
      stdio: options.stdio ?? "inherit",
      windowsHide: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
      }
    });

    child.on("error", reject);
  });
}

function runCommandCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoDir,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: options.shell ?? false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
      }
    });

    child.on("error", reject);
  });
}

async function commandWorks(command, args, options = {}) {
  try {
    await runCommand(command, args, {
      cwd: options.cwd ?? repoDir,
      env: options.env,
      stdio: "ignore",
      shell: options.shell ?? false,
    });
    return true;
  } catch {
    return false;
  }
}

async function resolveAvailableCommand(candidates, args = ["--version"], options = {}) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (await commandWorks(candidate, args, options)) {
      return candidate;
    }
  }

  return null;
}

async function getDockerCliCommand() {
  if (!dockerCliCommandPromise) {
    dockerCliCommandPromise = (async () => {
      const command = await resolveAvailableCommand(dockerCliCandidates, ["--version"]);
      if (!command) {
        throw new Error("Docker CLI is not installed or could not be located.");
      }
      return command;
    })();
  }

  return dockerCliCommandPromise;
}

async function getDockerComposeInvocation() {
  if (!composeInvocationPromise) {
    composeInvocationPromise = (async () => {
      const dockerCliCommand = await getDockerCliCommand();
      if (await commandWorks(dockerCliCommand, ["compose", "version"])) {
        return { command: dockerCliCommand, argsPrefix: ["compose"] };
      }

      const dockerComposeCommand = await resolveAvailableCommand(dockerComposeStandaloneCandidates, ["--version"]);
      if (dockerComposeCommand) {
        return { command: dockerComposeCommand, argsPrefix: [] };
      }

      throw new Error("Neither 'docker compose' nor 'docker-compose' is available.");
    })();
  }

  return composeInvocationPromise;
}

async function runDockerCompose(args, options = {}) {
  const invocation = await getDockerComposeInvocation();
  return runCommand(invocation.command, [...invocation.argsPrefix, ...args], options);
}

async function listListeningPids(port) {
  if (process.platform === "win32") {
    try {
      const output = await runCommandCapture("netstat", ["-ano", "-p", "tcp"]);
      const pids = new Set();
      for (const line of output.split(/\r?\n/u)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("TCP")) {
          continue;
        }

        const parts = trimmed.split(/\s+/u);
        const localAddress = parts[1] ?? "";
        const state = parts[3] ?? "";
        const pid = parts[4] ?? "";
        if (state !== "LISTENING") {
          continue;
        }
        if (localAddress.endsWith(`:${port}`) && pid) {
          pids.add(Number.parseInt(pid, 10));
        }
      }
      return [...pids].filter((pid) => Number.isInteger(pid));
    } catch {
      return [];
    }
  }

  try {
    const output = await runCommandCapture("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"]);
    return output.split(/\r?\n/u).map((line) => Number.parseInt(line, 10)).filter((pid) => Number.isInteger(pid));
  } catch {
    return [];
  }
}

async function portClosed(port, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const pids = await listListeningPids(port);
    if (pids.length === 0) {
      return true;
    }
    await sleep(500);
  }

  return false;
}

async function currentPortListeners(port) {
  return listListeningPids(port);
}

async function stopPid(pid) {
  if (process.platform === "win32") {
    await runCommand("taskkill", ["/pid", String(pid), "/f", "/t"], { stdio: "ignore" });
    return;
  }

  await runCommand("kill", ["-TERM", String(pid)], { stdio: "ignore" });
}

async function listRepoBootstrapPids() {
  if (process.platform !== "win32") {
    return [];
  }

  const escapedRepoDir = escapeForWmi(repoDir);
  const output = await runCommandCapture(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `$repo = '${escapedRepoDir}'; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*'+$repo+'*' -and ($_.CommandLine -match 'start-local\\.mjs|npm-cli\\.js run start:local|start_local_server\\.py') } | Select-Object -ExpandProperty ProcessId`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  return output
    .split(/\r?\n/u)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((pid) => Number.isInteger(pid));
}

async function stopRepoBootstrapProcesses() {
  const pids = await listRepoBootstrapPids();
  if (pids.length === 0) {
    return;
  }

  console.log(`[stop:local] Stopping local start wrapper process(es): ${pids.join(", ")}`);
  await Promise.all(pids.map(async (pid) => {
    try {
      await stopPid(pid);
    } catch (error) {
      console.warn(`[stop:local] Failed to stop local bootstrap pid ${pid}: ${error.message}`);
    }
  }));

  await sleep(1000);
}

async function listPythonForkWorkerPids() {
  if (process.platform !== "win32") {
    return [];
  }

  const output = await runCommandCapture(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -and $_.CommandLine -match '--multiprocessing-fork' } | Select-Object -ExpandProperty ProcessId",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  return output
    .split(/\r?\n/u)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((pid) => Number.isInteger(pid));
}

async function stopPythonForkWorkers() {
  const pids = await listPythonForkWorkerPids();
  if (pids.length === 0) {
    return;
  }

  console.log(`[stop:local] Stopping local Python worker process(es): ${pids.join(", ")}`);
  await Promise.all(pids.map(async (pid) => {
    try {
      await stopPid(pid);
    } catch (error) {
      console.warn(`[stop:local] Failed to stop local Python worker pid ${pid}: ${error.message}`);
    }
  }));

  await sleep(1000);
}

async function stopListenersOnPort(port) {
  const initialPids = await currentPortListeners(port);
  if (initialPids.length === 0) {
    console.log(`[stop:local] No listener found on port ${port}.`);
    return;
  }

  const seenPids = new Set();
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    const pids = await currentPortListeners(port);
    if (pids.length === 0) {
      console.log(`[stop:local] Port ${port} is clear.`);
      return;
    }

    const nextPids = pids.filter((pid) => !seenPids.has(pid));
    const pidsToStop = nextPids.length > 0 ? nextPids : pids;
    console.log(`[stop:local] Stopping listener(s) on port ${port}: ${pidsToStop.join(", ")}`);

    await Promise.all(pidsToStop.map(async (pid) => {
      seenPids.add(pid);
      try {
        await stopPid(pid);
      } catch (error) {
        console.warn(`[stop:local] Failed to stop pid ${pid} on port ${port}: ${error.message}`);
      }
    }));

    await sleep(750);
  }

  if (!(await portClosed(port, 1000))) {
    throw new Error(`Port ${port} is still in use after stop attempt.`);
  }
}

async function stopBundledPostgres() {
  try {
    const dockerCliCommand = await getDockerCliCommand();
    const isRunning = await commandWorks(dockerCliCommand, ["container", "inspect", postgresContainerName], {
      stdio: "ignore",
    });

    if (!isRunning) {
      console.log("[stop:local] Bundled PostgreSQL container is not present.");
      return;
    }

    console.log("[stop:local] Stopping bundled PostgreSQL container...");
    await runDockerCompose(["-f", composeFile, "down", "--remove-orphans"], {
      cwd: repoDir,
      stdio: "inherit",
    });
  } catch (error) {
    console.warn(`[stop:local] Could not stop Docker services cleanly: ${error.message}`);
  }
}

async function main() {
  const activeRunState = loadActiveRunState();
  await stopRepoBootstrapProcesses();
  await stopPythonForkWorkers();
  await stopListenersOnPort(frontendPort);
  await stopListenersOnPort(backendPort);
  await stopBundledPostgres();
  finalizeActiveRunLog(activeRunState);
  console.log("[stop:local] Local services stopped.");
}

main().catch((error) => {
  console.error(`[stop:local] ${error.message}`);
  process.exit(1);
});