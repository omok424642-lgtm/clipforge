// Shared launcher operations. Never remove application data or terminate an existing server.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const net = require("node:net");

const HOST = "127.0.0.1";
const PORT = 3100;
const URL = `http://${HOST}:${PORT}`;

function supportedNode(version) {
  const [major, minor] = version.replace(/^v/, "").split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 13);
}

function rootId(root) {
  return crypto.createHash("sha256").update(fs.realpathSync(root)).digest("hex");
}

function serverEnvironment(root, instanceId, env = process.env) {
  return {
    ...env, HOSTNAME: HOST, PORT: String(PORT), NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    APP_DATA_DIR: path.resolve(root, env.APP_DATA_DIR || "data"),
    APP_MIGRATIONS_DIR: path.resolve(root, env.APP_MIGRATIONS_DIR || "drizzle"),
    CLIPFORGE_LOCAL_ROOT: rootId(root), CLIPFORGE_LOCAL_INSTANCE: instanceId,
  };
}

function fingerprint(root) {
  const hash = crypto.createHash("sha256");
  function walk(relative) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) { hash.update(`missing:${relative}\0`); return; }
    const info = fs.lstatSync(full);
    if (info.isSymbolicLink()) throw new Error(`소스 안의 바로가기는 지원하지 않습니다: ${relative}`);
    if (info.isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) walk(path.join(relative, name));
    } else if (info.isFile()) {
      hash.update(relative.replaceAll("\\", "/") + "\0"); hash.update(fs.readFileSync(full)); hash.update("\0");
    }
  }
  for (const name of ["src", "public", "drizzle", "package.json", "pnpm-lock.yaml", ".npmrc", "next.config.ts", "tsconfig.json"]) walk(name);
  return hash.digest("hex");
}

function pnpmCommand(env = process.env, platform = process.platform, exists = fs.existsSync) {
  const separator = platform === "win32" ? ";" : ":";
  const fallbacks = [];
  for (const entry of (env.PATH || env.Path || "").split(separator).filter(Boolean)) {
    const dir = entry.replace(/^"|"$/g, "");
    if (platform === "win32") {
      // Use Node on the actual CLI rather than cmd /c: spaces, &, () and Korean paths remain literal.
      const cli = path.join(dir, "node_modules/pnpm/bin/pnpm.cjs");
      if (exists(cli)) return { file: process.execPath, args: [cli] };
      if (exists(path.join(dir, "pnpm.exe"))) fallbacks.push({ file: path.join(dir, "pnpm.exe"), args: [] });
      const corepack = path.join(dir, "node_modules/corepack/dist/pnpm.js");
      if (exists(path.join(dir, "pnpm.cmd")) && exists(corepack)) fallbacks.push({ file: process.execPath, args: [corepack] });
    } else {
      const file = path.join(dir, "pnpm");
      if (exists(file)) return { file: process.execPath, args: [fs.realpathSync(file)] };
    }
  }
  return fallbacks[0] || null;
}

function chromePath(env = process.env, exists = fs.existsSync, registryPaths = []) {
  const candidates = [env.CLIPFORGE_CHROME_PATH,
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
    env["PROGRAMFILES(X86)"] && path.join(env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
    ...registryPaths,
  ];
  return candidates.find(file => file && exists(file)) || null;
}

function acquireLock(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const owner = { pid: process.pid, nonce: crypto.randomUUID() };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, JSON.stringify(owner), { flag: "wx" });
      return () => {
        try { if (JSON.parse(fs.readFileSync(file, "utf8")).nonce === owner.nonce) fs.unlinkSync(file); } catch { /* already released */ }
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let old;
      try { old = JSON.parse(fs.readFileSync(file, "utf8")); } catch { throw new Error("실행 확인 파일을 읽지 못했습니다. 로그를 확인해 주세요. 기존 작업은 중단하지 않았습니다."); }
      if (!Number.isSafeInteger(old.pid) || old.pid < 1) throw new Error("실행 확인 파일이 올바르지 않습니다. 기존 작업은 중단하지 않았습니다.");
      try { process.kill(old.pid, 0); }
      catch (check) {
        if (check.code === "ESRCH") {
          // Recheck ownership before removing only this stale launcher lock.
          if (fs.readFileSync(file, "utf8") === JSON.stringify(old)) fs.unlinkSync(file);
          continue;
        }
      }
      throw new Error("이미 설치 또는 시작 작업이 진행 중입니다. 열린 실행 창을 확인하고 잠시 후 다시 시도해 주세요.");
    }
  }
  throw new Error("다른 시작 작업과 겹쳤습니다. 잠시 후 다시 실행해 주세요.");
}

function portAvailable(port = PORT) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", error => error.code === "EADDRINUSE" ? resolve(false) : reject(error));
    server.listen(port, HOST, () => server.close(() => resolve(true)));
  });
}

function readInstance(timeout = 1500, baseUrl = URL) {
  return new Promise(resolve => {
    const request = http.get(`${baseUrl}/api/local-launcher`, { timeout, agent: false }, response => {
      let data = "";
      response.on("data", chunk => { data += chunk; if (data.length > 4096) request.destroy(); });
      response.on("error", () => resolve(null));
      response.on("end", () => {
        try { resolve(response.statusCode === 200 ? JSON.parse(data) : null); } catch { resolve(null); }
      });
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(null));
  });
}

function isOurInstance(info, root, instanceId) {
  return !!info && info.app === "clipforge-local" && info.rootId === rootId(root) &&
    typeof info.instanceId === "string" && (!instanceId || info.instanceId === instanceId);
}

function prepareStandalone(root) {
  const standalone = path.join(root, ".next/standalone");
  if (!fs.existsSync(path.join(standalone, "server.js"))) throw new Error("실행 파일 빌드가 없습니다. '처음 설치하기.cmd'를 실행해 주세요.");
  for (const [from, to] of [["public", "public"], [".next/static", ".next/static"]]) {
    const source = path.join(root, from);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(standalone, to), { recursive: true });
  }
}

function verifyInstalled(root, nodeVersion = process.versions.node) {
  let state;
  try { state = JSON.parse(fs.readFileSync(path.join(root, ".clipforge-launcher/state.json"), "utf8")); }
  catch { throw new Error("최초 설치가 필요합니다. '처음 설치하기.cmd'를 먼저 더블클릭해 주세요."); }
  if (state.version !== 1 || state.sourceHash !== fingerprint(root) || state.nodeMajor !== nodeVersion.split(".")[0]) throw new Error("앱 소스 또는 Node.js 버전이 달라졌습니다. 실행 중인 창을 종료한 뒤 '처음 설치하기.cmd'를 다시 실행해 주세요. 상품 자료는 유지됩니다.");
  try {
    if (state.buildId !== fs.readFileSync(path.join(root, ".next/BUILD_ID"), "utf8").trim()) throw new Error();
    if (!fs.existsSync(path.join(root, ".next/standalone/server.js"))) throw new Error();
  } catch { throw new Error("준비된 실행 파일이 없거나 변경됐습니다. '처음 설치하기.cmd'를 다시 실행해 주세요."); }
}

module.exports = { HOST, PORT, URL, supportedNode, rootId, serverEnvironment, fingerprint, pnpmCommand, chromePath, acquireLock, portAvailable, readInstance, isOurInstance, prepareStandalone, verifyInstalled };
