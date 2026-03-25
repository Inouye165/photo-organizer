import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(rootDir, "..");
const clientDir = path.join(repoDir, "client");
const serverDir = path.join(repoDir, "server");
const composeFile = path.join(repoDir, "infra", "docker-compose.yml");
const venvPython = path.join(repoDir, ".venv", "Scripts", "python.exe");
const bundledPostgresPort = process.env.PHOTO_ORGANIZER_POSTGRES_PORT || "5434";
const backendHost = "127.0.0.1";
const backendPort = 8000;
const frontendHost = "127.0.0.1";
const frontendPort = 5173;
const dependencyMonitorIntervalMs = 15000;
const dependencyFailureLimit = 3;

const backendUrl = `http://${backendHost}:${backendPort}/health`;
const frontendUrl = `http://${frontendHost}:${frontendPort}/`;
const defaultPostgresUrl = `postgresql+psycopg://photoorganizer:photoorganizer@127.0.0.1:${bundledPostgresPort}/photoorganizer`;
const fallbackSqliteUrl = `sqlite:///${path.join(serverDir, "photo-organizer.db").replaceAll("\\", "/")}`;
const postgresContainerName = "photo-organizer-postgres";
const postgresDataDir = path.join(repoDir, "infra", "postgres-data");
const expectedPostgresEnv = {
  POSTGRES_DB: "photoorganizer",
  POSTGRES_USER: "photoorganizer",
  POSTGRES_PASSWORD: "photoorganizer",
};
const dockerDesktopCandidates = [
  path.join("C:\\", "Program Files", "Docker", "Docker", "Docker Desktop.exe"),
  path.join("C:\\", "Program Files", "Docker", "Docker", "Docker Desktop"),
  path.join(process.env.LOCALAPPDATA || "", "Programs", "Docker", "Docker", "Docker Desktop.exe"),
].filter(Boolean);
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

const children = [];
let dependencyMonitorTimer = null;
let dependencyMonitorInFlight = false;
let dependencyFailureCount = 0;
let composeInvocationPromise;
let dockerCliCommandPromise;

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

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const delimiterIndex = line.indexOf("=");
    if (delimiterIndex < 0) {
      continue;
    }
    const key = line.slice(0, delimiterIndex).trim();
    let value = line.slice(delimiterIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function repoRelativeAbsolute(candidate) {
  if (!candidate) {
    return candidate;
  }
  if (path.isAbsolute(candidate)) {
    return candidate;
  }
  return path.resolve(repoDir, candidate);
}

function normalizeScanRoots(rawValue) {
  if (!rawValue) {
    console.warn("[start:local] PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.");
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return JSON.stringify(parsed.map((entry) => repoRelativeAbsolute(String(entry))));
    }
  } catch {
    const parts = rawValue.split(",").map((entry) => entry.trim()).filter(Boolean);
    return JSON.stringify(parts.map((entry) => repoRelativeAbsolute(entry)));
  }

  return rawValue;
}

function normalizeGeneratedMediaRoot(rawValue) {
  const fallback = path.join(serverDir, "generated-media");
  return repoRelativeAbsolute(rawValue || fallback);
}

function normalizeDatabaseUrl(rawValue) {
  const value = rawValue || defaultPostgresUrl;
  if (!value.startsWith("sqlite:///")) {
    return value;
  }

  const sqlitePath = value.slice("sqlite:///".length);
  const absolutePath = repoRelativeAbsolute(sqlitePath);
  return `sqlite:///${absolutePath.replaceAll("\\", "/")}`;
}

function hasExplicitValue(rawValue) {
  return typeof rawValue === "string" && rawValue.trim().length > 0;
}

function isManagedPostgresUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    const protocolMatches = parsed.protocol === "postgresql+psycopg:" || parsed.protocol === "postgresql:";
    const hostMatches = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    return protocolMatches && hostMatches && parsed.port === bundledPostgresPort && parsed.pathname === "/photoorganizer";
  } catch {
    return false;
  }
}

function withPrefix(prefix) {
  let buffer = "";
  return (chunk) => {
    buffer += chunk.toString();
    const parts = buffer.split(/\r?\n/u);
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      if (line.length > 0) {
        process.stdout.write(`${prefix} ${line}\n`);
      }
    }
  };
}

function buildNpmInvocation(argumentsList) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `npm ${argumentsList.join(" ")}`],
    };
  }

  return {
    command: "npm",
    args: argumentsList,
  };
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

      throw new Error(
        "Neither 'docker compose' nor 'docker-compose' is available. Install Docker Desktop or Docker Compose before running start:local.",
      );
    })();
  }

  return composeInvocationPromise;
}

async function getDockerCliCommand() {
  if (!dockerCliCommandPromise) {
    dockerCliCommandPromise = (async () => {
      const command = await resolveAvailableCommand(dockerCliCandidates, ["--version"]);
      if (!command) {
        throw new Error(
          "Docker CLI is not installed or could not be located. Install Docker Desktop or set PHOTO_ORGANIZER_DATABASE_URL to a different database before running start:local.",
        );
      }

      return command;
    })();
  }

  return dockerCliCommandPromise;
}

async function runDockerCompose(args, options = {}) {
  const invocation = await getDockerComposeInvocation();
  return runCommand(invocation.command, [...invocation.argsPrefix, ...args], options);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoDir,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: options.shell ?? false,
      stdio: options.stdio ?? "inherit",
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

async function ensurePythonEnvironment() {
  if (!existsSync(venvPython)) {
    console.log("[start:local] Creating Python virtual environment...");
    await runCommand("python", ["-m", "venv", ".venv"], { cwd: repoDir });
  }

  let hasBackendDeps = true;
  try {
    await runCommand(
      venvPython,
      ["-c", "import fastapi, alembic, PIL, sqlalchemy, uvicorn, pydantic_settings"],
      { cwd: repoDir, stdio: "ignore" },
    );
  } catch {
    hasBackendDeps = false;
  }

  if (!hasBackendDeps) {
    console.log("[start:local] Installing backend dependencies...");
    await runCommand(venvPython, ["-m", "pip", "install", "-e", "./server[dev]"], { cwd: repoDir });
  }
}

async function ensureFrontendDependencies() {
  if (!existsSync(path.join(clientDir, "node_modules"))) {
    console.log("[start:local] Installing frontend dependencies...");
    const npmInstall = buildNpmInvocation(["install"]);
    await runCommand(npmInstall.command, npmInstall.args, { cwd: clientDir });
  }
}

async function waitForUrl(url, label, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`[start:local] ${label} is ready at ${url}`);
        return;
      }
    } catch {
      // Keep polling until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`${label} did not become ready within ${timeoutMs / 1000} seconds`);
}

async function waitForHttpCondition(url, label, isReady, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (await isReady(response)) {
        console.log(`[start:local] ${label} is ready at ${url}`);
        return;
      }
    } catch {
      // Keep polling until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`${label} did not become ready within ${timeoutMs / 1000} seconds`);
}

async function waitForTcpPort(host, port, label, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const connected = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve(true);
      });

      socket.on("error", () => resolve(false));
      socket.setTimeout(1000, () => {
        socket.destroy();
        resolve(false);
      });
    });

    if (connected) {
      console.log(`[start:local] ${label} is ready at ${host}:${port}`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`${label} did not become ready within ${timeoutMs / 1000} seconds`);
}

async function dockerEngineReady() {
  try {
    const dockerCliCommand = await getDockerCliCommand();
    await runCommand(dockerCliCommand, ["info"], {
      cwd: repoDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

async function getContainerHealth(containerName) {
  try {
    const dockerCliCommand = await getDockerCliCommand();
    const output = await runCommandCapture(
      dockerCliCommand,
      ["inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", containerName],
      { cwd: repoDir },
    );
    return output.trim();
  } catch {
    return "missing";
  }
}

async function waitForContainerHealth(containerName, label, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const health = await getContainerHealth(containerName);
    if (health === "healthy" || health === "running") {
      console.log(`[start:local] ${label} is healthy.`);
      return;
    }
    if (health === "exited" || health === "dead") {
      throw new Error(`${label} exited before becoming healthy.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`${label} did not become healthy within ${timeoutMs / 1000} seconds`);
}

function findDockerDesktopExecutable() {
  return dockerDesktopCandidates.find((candidate) => existsSync(candidate));
}

async function waitForDockerEngine(timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await dockerEngineReady()) {
      console.log("[start:local] Docker engine is ready.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Docker engine did not become ready within ${timeoutMs / 1000} seconds`);
}

function toPsycopgConnectionUrl(databaseUrl) {
  return databaseUrl.replace("postgresql+psycopg://", "postgresql://");
}

async function bundledPostgresAcceptsConnections(databaseUrl) {
  try {
    await runCommand(
      venvPython,
      ["-c", "import os, psycopg; psycopg.connect(os.environ['PHOTO_ORGANIZER_DATABASE_URL']).close()"],
      {
        cwd: repoDir,
        env: {
          PHOTO_ORGANIZER_DATABASE_URL: toPsycopgConnectionUrl(databaseUrl),
        },
        stdio: "ignore",
      },
    );
    return true;
  } catch {
    return false;
  }
}

async function waitForBundledPostgresAuth(databaseUrl, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await bundledPostgresAcceptsConnections(databaseUrl)) {
      console.log(`[start:local] PostgreSQL accepted credentials at ${databaseUrl}`);
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return false;
}

async function ensureDockerEngine() {
  await getDockerCliCommand();

  if (await dockerEngineReady()) {
    return;
  }

  if (process.platform === "win32") {
    const dockerDesktopExecutable = findDockerDesktopExecutable();
    if (!dockerDesktopExecutable) {
      throw new Error(
        "Docker Desktop is not running and its executable could not be found. Start Docker Desktop manually or set PHOTO_ORGANIZER_DATABASE_URL to a different database.",
      );
    }

    console.log("[start:local] Starting Docker Desktop...");
    const child = spawn(dockerDesktopExecutable, [], {
      cwd: repoDir,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    await waitForDockerEngine();
    return;
  }

  throw new Error(
    "Docker is not running. Start your Docker engine manually or set PHOTO_ORGANIZER_DATABASE_URL to a different database.",
  );
}

async function containerExists(containerName) {
  try {
    const dockerCliCommand = await getDockerCliCommand();
    await runCommand(dockerCliCommand, ["container", "inspect", containerName], {
      cwd: repoDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

async function startExistingContainer(containerName) {
  console.log(`[start:local] Starting existing container ${containerName}...`);
  const dockerCliCommand = await getDockerCliCommand();
  await runCommand(dockerCliCommand, ["start", containerName], {
    cwd: repoDir,
    stdio: "inherit",
  });
}

async function removeContainer(containerName) {
  console.log(`[start:local] Recreating incompatible container ${containerName}...`);
  const dockerCliCommand = await getDockerCliCommand();
  await runCommand(dockerCliCommand, ["rm", "-f", containerName], {
    cwd: repoDir,
    stdio: "inherit",
  });
}

async function resetBundledPostgresDataDirectory() {
  console.warn("[start:local] Resetting bundled PostgreSQL data directory to recover from incompatible local credentials.");
  try {
    await runDockerCompose(["-f", composeFile, "down", "--remove-orphans"], {
      cwd: repoDir,
      stdio: "ignore",
    });
  } catch {
    // Best-effort shutdown before removing the bind-mounted data directory.
  }

  rmSync(postgresDataDir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 500,
  });
}

async function getContainerEnvironment(containerName) {
  const dockerCliCommand = await getDockerCliCommand();
  const output = await runCommandCapture(
    dockerCliCommand,
    ["inspect", "--format", "{{range .Config.Env}}{{println .}}{{end}}", containerName],
    { cwd: repoDir },
  );

  const env = {};
  for (const line of output.split(/\r?\n/u)) {
    if (!line) {
      continue;
    }
    const delimiterIndex = line.indexOf("=");
    if (delimiterIndex < 0) {
      continue;
    }
    const key = line.slice(0, delimiterIndex);
    const value = line.slice(delimiterIndex + 1);
    env[key] = value;
  }
  return env;
}

async function getContainerPublishedPort(containerName, containerPort) {
  const dockerCliCommand = await getDockerCliCommand();
  const output = await runCommandCapture(
    dockerCliCommand,
    ["inspect", "--format", "{{json .NetworkSettings.Ports}}", containerName],
    { cwd: repoDir },
  );
  const ports = JSON.parse(output || "{}");
  const bindings = ports[`${containerPort}/tcp`];
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return "";
  }
  return String(bindings[0]?.HostPort || "").trim();
}

async function containerMatchesBundledPostgresConfig(containerName) {
  const env = await getContainerEnvironment(containerName);
  const publishedPort = await getContainerPublishedPort(containerName, "5432");
  const envMatches = Object.entries(expectedPostgresEnv).every(([key, value]) => env[key] === value);
  return envMatches && publishedPort === bundledPostgresPort;
}

async function findDockerContainerPublishingPort(port, excludedContainerName) {
  const dockerCliCommand = await getDockerCliCommand();
  const output = await runCommandCapture(dockerCliCommand, ["ps", "--format", "{{.Names}}\t{{.Ports}}"], {
    cwd: repoDir,
  });

  for (const line of output.split(/\r?\n/u)) {
    if (!line) {
      continue;
    }

    const [containerName, publishedPorts = ""] = line.split("\t");
    if (containerName === excludedContainerName) {
      continue;
    }
    if (publishedPorts.includes(`:${port}->`)) {
      return containerName;
    }
  }

  return null;
}

async function bringUpBundledPostgresContainer() {
  if (await containerExists(postgresContainerName)) {
    if (!(await containerMatchesBundledPostgresConfig(postgresContainerName))) {
      await removeContainer(postgresContainerName);
    } else {
      await startExistingContainer(postgresContainerName);
      await waitForTcpPort("127.0.0.1", Number.parseInt(bundledPostgresPort, 10), "PostgreSQL");
      return;
    }
  }

  const conflictingContainer = await findDockerContainerPublishingPort(Number.parseInt(bundledPostgresPort, 10), postgresContainerName);
  if (conflictingContainer) {
    throw new Error(
      `Local port ${bundledPostgresPort} is already published by Docker container ${conflictingContainer}. Stop that container or explicitly set PHOTO_ORGANIZER_DATABASE_URL to a different database before running start:local.`,
    );
  }

  await runDockerCompose(["-f", composeFile, "up", "-d", "postgres"], {
    cwd: repoDir,
    env: {
      PHOTO_ORGANIZER_POSTGRES_PORT: bundledPostgresPort,
    },
    stdio: "inherit",
  });
  await waitForContainerHealth(postgresContainerName, "PostgreSQL container");
  await waitForTcpPort("127.0.0.1", Number.parseInt(bundledPostgresPort, 10), "PostgreSQL");
}

async function ensureManagedPostgres(databaseUrl) {
  await ensureDockerEngine();
  console.log("[start:local] Starting PostgreSQL container...");

  try {
    await bringUpBundledPostgresContainer();
  } catch (error) {
    throw new Error(error.message);
  }

  if (await waitForBundledPostgresAuth(databaseUrl)) {
    return;
  }

  console.warn("[start:local] Bundled PostgreSQL is running but rejected the expected credentials.");
  await removeContainer(postgresContainerName);
  await resetBundledPostgresDataDirectory();

  try {
    await bringUpBundledPostgresContainer();
  } catch (error) {
    throw new Error(error.message);
  }

  if (!(await waitForBundledPostgresAuth(databaseUrl))) {
    throw new Error(
      "Bundled PostgreSQL started, but the app still could not authenticate. Explicitly set PHOTO_ORGANIZER_DATABASE_URL or inspect the local Docker/PostgreSQL state.",
    );
  }
}

function startManagedProcess(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    shell: options.shell ?? false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", withPrefix(options.prefix));
  child.stderr.on("data", withPrefix(options.prefix));
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`${options.prefix} exited unexpectedly with code ${code ?? "unknown"}`);
      shutdown(code ?? 1);
    }
  });
  child.on("error", (error) => {
    console.error(`${options.prefix} failed to start: ${error.message}`);
    shutdown(1);
  });

  children.push(child);
  return child;
}

async function checkHttpCondition(url, isReady) {
  try {
    const response = await fetch(url);
    return await isReady(response);
  } catch {
    return false;
  }
}

async function isTcpPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve(true);
    });

    socket.on("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function ensureExpectedHttpService({
  host,
  port,
  url,
  label,
  isReady,
  start,
}) {
  if (await checkHttpCondition(url, isReady)) {
    console.log(`[start:local] Reusing existing ${label.toLowerCase()} at ${url}`);
    return false;
  }

  if (await isTcpPortOpen(host, port)) {
    throw new Error(`${label} port ${port} is already in use by another process that is not serving the expected app.`);
  }

  start();
  await waitForHttpCondition(url, label, isReady);
  return true;
}

let shuttingDown = false;

function killChild(child) {
  if (child.killed) {
    return;
  }

  if (process.platform === "win32" && child.pid) {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore" });
    } catch {
      child.kill();
    }
  } else {
    child.kill();
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  if (dependencyMonitorTimer) {
    clearInterval(dependencyMonitorTimer);
    dependencyMonitorTimer = null;
  }
  console.log("[start:local] Shutting down...");
  for (const child of children) {
    killChild(child);
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function startDependencyMonitor({ usesManagedPostgres, databaseUrl }) {
  if (!usesManagedPostgres || dependencyMonitorTimer) {
    return;
  }

  dependencyMonitorTimer = setInterval(async () => {
    if (shuttingDown || dependencyMonitorInFlight) {
      return;
    }

    dependencyMonitorInFlight = true;
    try {
      const health = await getContainerHealth(postgresContainerName);
      const authOk = await bundledPostgresAcceptsConnections(databaseUrl);
      if ((health === "healthy" || health === "running") && authOk) {
        dependencyFailureCount = 0;
        return;
      }

      dependencyFailureCount += 1;
      console.warn(
        `[start:local] PostgreSQL dependency check failed (${dependencyFailureCount}/${dependencyFailureLimit}). Health=${health}, auth=${authOk ? "ok" : "failed"}.`,
      );

      if (dependencyFailureCount >= dependencyFailureLimit) {
        console.error("[start:local] PostgreSQL remained unhealthy. Stopping local app processes.");
        shutdown(1);
      }
    } catch (error) {
      dependencyFailureCount += 1;
      console.warn(
        `[start:local] PostgreSQL dependency monitor error (${dependencyFailureCount}/${dependencyFailureLimit}): ${error.message}`,
      );

      if (dependencyFailureCount >= dependencyFailureLimit) {
        console.error("[start:local] PostgreSQL dependency monitoring failed repeatedly. Stopping local app processes.");
        shutdown(1);
      }
    } finally {
      dependencyMonitorInFlight = false;
    }
  }, dependencyMonitorIntervalMs);
}

async function main() {
  if (!existsSync(serverDir)) {
    throw new Error(`Server directory not found: ${serverDir}`);
  }
  if (!existsSync(clientDir)) {
    throw new Error(`Client directory not found: ${clientDir}`);
  }

  const fileEnv = parseEnvFile(path.join(repoDir, ".env"));
  await ensurePythonEnvironment();
  await ensureFrontendDependencies();

  const configuredDatabaseUrl = process.env.PHOTO_ORGANIZER_DATABASE_URL ?? fileEnv.PHOTO_ORGANIZER_DATABASE_URL;
  const databaseUrlWasExplicit = hasExplicitValue(configuredDatabaseUrl);
  let databaseUrl = normalizeDatabaseUrl(configuredDatabaseUrl);

  if (isManagedPostgresUrl(databaseUrl)) {
    try {
      await ensureManagedPostgres(databaseUrl);
    } catch (error) {
      if (databaseUrlWasExplicit) {
        throw error;
      }

      console.warn(`[start:local] ${error.message}`);
      console.warn(`[start:local] Falling back to local SQLite database at ${fallbackSqliteUrl}.`);
      databaseUrl = fallbackSqliteUrl;
    }
  } else if (databaseUrl.startsWith("sqlite:///")) {
    console.warn("[start:local] Using explicitly configured SQLite database; PostgreSQL container startup skipped.");
  }

  const backendEnv = {
    PHOTO_ORGANIZER_DATABASE_URL: databaseUrl,
    PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT: normalizeGeneratedMediaRoot(
      process.env.PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT ?? fileEnv.PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT,
    ),
    PHOTO_ORGANIZER_SCAN_ROOTS: normalizeScanRoots(
      process.env.PHOTO_ORGANIZER_SCAN_ROOTS ?? fileEnv.PHOTO_ORGANIZER_SCAN_ROOTS,
    ),
    PHOTO_ORGANIZER_CORS_ORIGINS:
      process.env.PHOTO_ORGANIZER_CORS_ORIGINS ??
      fileEnv.PHOTO_ORGANIZER_CORS_ORIGINS ??
      '["http://127.0.0.1:5173","http://localhost:5173"]',
  };

  const frontendEnv = {
    VITE_API_BASE_URL:
      process.env.VITE_API_BASE_URL ?? fileEnv.VITE_API_BASE_URL ?? "http://127.0.0.1:8000",
  };

  console.log("[start:local] Starting backend...");
  await ensureExpectedHttpService({
    host: backendHost,
    port: backendPort,
    url: backendUrl,
    label: "Backend",
    isReady: async (response) => {
      if (!response.ok) {
        return false;
      }

      try {
        const payload = await response.json();
        return payload?.status === "ok";
      } catch {
        return false;
      }
    },
    start: () => {
      startManagedProcess(venvPython, ["scripts/start_local_server.py"], {
        cwd: serverDir,
        env: backendEnv,
        prefix: "[backend]",
      });
    },
  });

  console.log("[start:local] Starting frontend...");
  const npmDev = buildNpmInvocation([
    "run",
    "dev",
    "--",
    "--host",
    frontendHost,
    "--port",
    String(frontendPort),
    "--strictPort",
  ]);
  await ensureExpectedHttpService({
    host: frontendHost,
    port: frontendPort,
    url: frontendUrl,
    label: "Frontend",
    isReady: async (response) => {
      if (!response.ok) {
        return false;
      }

      const html = await response.text();
      return html.includes('<div id="root"></div>') || html.includes('<div id="root">');
    },
    start: () => {
      startManagedProcess(npmDev.command, npmDev.args, {
        cwd: clientDir,
        env: frontendEnv,
        prefix: "[frontend]",
      });
    },
  });

  startDependencyMonitor({
    usesManagedPostgres: isManagedPostgresUrl(backendEnv.PHOTO_ORGANIZER_DATABASE_URL),
    databaseUrl: backendEnv.PHOTO_ORGANIZER_DATABASE_URL,
  });

  console.log("[start:local] App ready.");
  console.log(`[start:local] Frontend: ${frontendUrl}`);
  console.log(`[start:local] Backend health: ${backendUrl}`);
  console.log("[start:local] Press Ctrl+C to stop both processes.");
}

main().catch((error) => {
  console.error(`[start:local] ${error.message}`);
  shutdown(1);
});
