const { spawn, execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(__dirname, "..");

// Support both CLI flag and Cross-Platform environment fallback wrapper
const openRequested = process.argv.includes("--open") || process.env.IDUN_OPEN_BROWSER === "true";
const setupOnly = process.argv.includes("--setup-only");

function checkNodeVersion() {
  const major = parseInt(process.versions.node.split(".")[0], 10);
  if (major < 24) {
    console.warn(
      `\x1b[33mIDUN NOTICE: Running on Node.js ${process.version}. Node.js 24+ is required system-wide.\x1b[0m`
    );
  }
}

function openBrowser() {
  const url = "http://127.0.0.1:5173/";
  const command =
    process.platform === "win32"
      ? "rundll32.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawn(command, args, {
    stdio: "ignore",
    detached: true,
    windowsHide: true,
  });
  child.on("error", () => console.log(`Open ${url} in your browser.`));
  child.unref();
}

function ensureNodeModules() {
  const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
  if (!fs.existsSync(viteBin)) {
    console.log("IDUN: Missing node_modules. Installing web dependencies (npm install)...");
    execSync("npm install", { cwd: root, stdio: "inherit", shell: true });
    console.log("IDUN: Node dependencies installed successfully.");
  }
}

function getUvPath() {
  try {
    execSync("uv --version", { stdio: "ignore", shell: true });
    return "uv";
  } catch {}
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    path.join(home, ".local", "bin", process.platform === "win32" ? "uv.exe" : "uv"),
    path.join(home, ".cargo", "bin", process.platform === "win32" ? "uv.exe" : "uv"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function installUv() {
  console.log("IDUN: uv package manager not found. Installing uv...");
  try {
    if (process.platform === "win32") {
      execSync('powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"', {
        stdio: "inherit",
        shell: true,
      });
    } else {
      execSync("curl -LsSf https://astral.sh/uv/install.sh | sh", {
        stdio: "inherit",
        shell: true,
      });
    }
    const uvPath = getUvPath();
    if (uvPath) {
      console.log(`IDUN: uv successfully installed at ${uvPath}.`);
      return uvPath;
    }
  } catch (err) {
    console.warn("IDUN: Automatic uv installation warning:", err.message);
  }
  return null;
}

const executable = process.platform === "win32" ? "python.exe" : "python3";
const projectVenv = path.join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const localRuntime = path.join(
  root,
  ".idun",
  "model-runtime",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const onPath = (process.env.PATH || "")
  .split(path.delimiter)
  .map((p) => path.join(p.replace(/^"|"$/g, ""), executable))
  .find((p) => fs.existsSync(p));

function ensurePythonEnvironment() {
  if (fs.existsSync(projectVenv)) {
    return projectVenv;
  }
  console.log("IDUN: Python virtual environment (.venv) not found.");
  let uv = getUvPath();
  if (!uv) {
    uv = installUv();
  }
  if (!uv) {
    throw Error(
      "uv is required to bootstrap the Python environment automatically. Please install uv from https://astral.sh/uv or set IDUN_PYTHON.",
    );
  }
  console.log("IDUN: Synchronizing dependencies from pyproject.toml via uv sync...");
  execSync(`"${uv}" sync`, { cwd: root, stdio: "inherit", shell: true });
  if (!fs.existsSync(projectVenv)) {
    throw Error("uv sync finished, but .venv executable was not found.");
  }
  console.log("IDUN: Python virtual environment (.venv) ready.");
  return projectVenv;
}

function getSavedPython() {
  const file = path.join(root, ".idun", "settings.json");
  if (!fs.existsSync(file)) return "";
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8")).api_python;
    if (saved && fs.existsSync(saved)) return saved;
  } catch {}
  return "";
}

function selectedPython() {
  const explicit = process.env.IDUN_PYTHON;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const saved = getSavedPython();
  if (saved) return saved;

  if (fs.existsSync(projectVenv)) return projectVenv;

  // Auto-bootstrap .venv if missing
  try {
    return ensurePythonEnvironment();
  } catch (err) {
    console.warn("IDUN: Automated .venv creation note:", err.message);
  }

  if (fs.existsSync(localRuntime)) return localRuntime;
  if (onPath) return onPath;

  throw Error(
    "Python was not found. Please ensure uv is installed or set IDUN_PYTHON to its full executable path.",
  );
}

let api,
  web,
  closing = false,
  starting = false,
  activePython;

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    try {
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" });
      return;
    } catch {}
  }
  try {
    child.kill();
  } catch {}
}

function close(code = 0) {
  if (closing) return;
  closing = true;
  process.exitCode = code;
  if (api && api.exitCode === null) killTree(api);
  if (web && web.exitCode === null) killTree(web);
  setTimeout(() => {
    process.exit(code);
  }, 250).unref();
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stop(child) {
  if (
    !child ||
    !child.pid ||
    child.exitCode !== null ||
    child.signalCode !== null
  )
    return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    killTree(child);
  });
}

async function startApi(python, rollback) {
  if (closing) throw Error("Launcher is stopping");
  starting = true;
  try {
    console.log(`IDUN API Python: ${python}`);
    const child = spawn(python, ["backend/server.py"], {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        IDUN_MANAGED_API: "1",
        IDUN_DEFAULT_API_PYTHON: fs.existsSync(projectVenv) ? projectVenv : (localRuntime || onPath || ""),
        IDUN_RESTART_ERROR: rollback
          ? "The selected API failed to start; the previous environment was restored."
          : "",
      },
    });
    api = child;
    let spawnError;
    child.on("error", (e) => {
      spawnError = e;
    });
    child.on("exit", (code) => {
      if (closing || starting || child !== api) return;
      if (code === 75) {
        const previous = activePython;
        void (async () => {
          try {
            await startApi(selectedPython(), false);
          } catch (error) {
            console.error("API restart failed:", error.message);
            try {
              await stop(api);
              await startApi(previous, true);
            } catch (fallbackError) {
              console.error("API recovery failed:", fallbackError.message);
              close(1);
            }
          }
        })();
      } else if (code === 0) {
        console.log("IDUN servers stopped cleanly.");
        close(0);
      } else {
        console.error(`IDUN API stopped (${code}).`);
        close(code || 1);
      }
    });
    for (let i = 0; i < 100 && !closing; i++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null)
        throw Error(`Python exited with code ${child.exitCode}`);
      try {
        const response = await fetch("http://127.0.0.1:8787/api/v1/health", {
          signal: AbortSignal.timeout(500),
        });
        const health = await response.json();
        if (
          response.ok &&
          health.status === "ok" &&
          (health.process_id === child.pid || process.platform === "win32")
        ) {
          activePython = python;
          starting = false;
          return;
        }
      } catch {}
      await pause(100);
    }
    throw Error("API did not become ready on port 8787");
  } catch (error) {
    await stop(api);
    starting = false;
    throw error;
  }
}

async function main() {
  checkNodeVersion();
  ensureNodeModules();

  if (setupOnly) {
    const pythonPath = selectedPython();
    console.log(`IDUN: Environment setup complete. Node ${process.version} and Python (${pythonPath}) are verified.`);
    return;
  }

  if (openRequested) {
    try {
      const health = await (
        await fetch("http://127.0.0.1:8787/api/v1/health", {
          signal: AbortSignal.timeout(1000),
        })
      ).json();
      const page = await fetch("http://127.0.0.1:5173/", {
        signal: AbortSignal.timeout(1000),
      });
      if (
        health.status === "ok" &&
        health.api === "v1" &&
        page.ok &&
        (await page.text()).includes("IDUN")
      ) {
        openBrowser();
        return;
      }
    } catch {}
  }
  const pythonPath = selectedPython();
  await startApi(pythonPath, false);
  if (closing) return;
  web = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "web",
      "--host",
      "127.0.0.1",
      "--strictPort",
    ],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  web.on("error", (error) => {
    console.error(error.message);
    close(1);
  });
  web.on("exit", (code) => {
    if (!closing) close(code || 0);
  });

  if (openRequested) {
    // Wait up to 3 seconds for Vite to establish network baseline
    for (let i = 0; i < 30 && !closing; i++) {
      try {
        const res = await fetch("http://127.0.0.1:5173/", {
          signal: AbortSignal.timeout(500),
        });
        if (res.ok) {
          openBrowser();
          console.log("IDUN is ready. Keep this window open; press Ctrl+C to stop.");
          return;
        }
      } catch {}
      await pause(100);
    }

    // FALLBACK: If fetch fails natively but time runs out, force-open the browser anyway
    console.log("Forcing browser window launch...");
    openBrowser();
    console.log("IDUN is ready. Keep this window open; press Ctrl+C to stop.");
  }
}

process.on("SIGINT", () => close());
process.on("SIGTERM", () => close());

main().catch((error) => {
  console.error("IDUN startup failed:", error.message);
  close(1);
});
