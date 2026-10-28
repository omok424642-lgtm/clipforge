// Windows personal webapp launcher. No shell interpolation, administrator actions or data deletion.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const local = require("./lib/windows-launcher.cjs");

const root = path.resolve(__dirname, "..");
const stateDir = path.join(root, ".clipforge-launcher");
const stateFile = path.join(stateDir, "state.json");
const setup = process.argv.includes("--setup");
let logFile;
let stream;
let child;
let release;
let stopping = false;

function say(message) {
  console.log(message); stream?.write(message + "\n");
}

function checked(command, args, name) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true, timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${name} 실행을 확인하지 못했습니다. 설치와 PATH를 확인하고 명령 창을 다시 열어 주세요.`);
  return result.stdout + result.stderr;
}

function prerequisites() {
  if (!local.supportedNode(process.versions.node)) throw new Error(`Node.js ${process.versions.node}은 지원하지 않습니다. Node.js 22.13 이상(최신 22.x 권장)을 설치해 주세요. https://nodejs.org/en/download`);
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
  let filters;
  try { filters = checked(ffmpeg, ["-hide_banner", "-filters"], "FFmpeg"); checked(ffprobe, ["-version"], "FFprobe"); }
  catch { throw new Error("FFmpeg 또는 FFprobe가 없거나 실행되지 않습니다. 'winget install --exact --id Gyan.FFmpeg'로 설치한 뒤 창을 다시 열어 주세요. 자세한 내용은 '윈도우 실행 안내.txt'를 확인하세요."); }
  if (!/\bdrawtext\b/.test(filters)) throw new Error("현재 FFmpeg에 자막용 drawtext 기능이 없습니다. Gyan.FFmpeg 전체 버전으로 설치해 주세요.");
  let chrome = local.chromePath();
  if (!chrome) {
    const found = [];
    for (const hive of ["HKCU", "HKLM"]) {
      const result = spawnSync("reg.exe", ["query", `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe`, "/ve"], { encoding: "utf8", windowsHide: true, timeout: 3000 });
      const match = result.stdout?.match(/REG_SZ\s+(.+?chrome\.exe)\s*$/im);
      if (match) found.push(match[1].replace(/^"|"$/g, ""));
    }
    chrome = local.chromePath(process.env, fs.existsSync, found);
  }
  if (!chrome) throw new Error("크롬을 찾지 못했습니다. https://www.google.com/chrome/ 에서 설치해 주세요. 별도 경로에 설치했다면 안내 문서의 CLIPFORGE_CHROME_PATH 설정을 확인하세요.");
  return { ffmpeg, ffprobe, chrome };
}

function openChrome(executable) {
  const browser = spawn(executable, [local.URL + "/discover"], { detached: true, stdio: "ignore", shell: false, windowsHide: true });
  browser.once("error", () => say(`크롬 자동 열기에 실패했습니다. 크롬 주소창에 ${local.URL}/discover 를 입력해 주세요.`));
  browser.unref();
}

function run(command, args, label, env = process.env) {
  if (stopping) throw new Error("작업을 중지했습니다. 다음 설치 때 다시 준비합니다.");
  say(`\n${label} — 창을 닫지 말고 기다려 주세요.`);
  return new Promise((resolve, reject) => {
    child = spawn(command, args, { cwd: root, env, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", data => { process.stdout.write(data); stream.write(data); });
    child.stderr.on("data", data => { process.stderr.write(data); stream.write(data); });
    child.once("error", () => reject(new Error(`${label}을 시작하지 못했습니다. 필요한 프로그램과 설치 경로를 확인해 주세요.`)));
    child.once("close", code => { child = null; code === 0 && !stopping ? resolve() : reject(new Error(`${label}에 실패하거나 중지됐습니다(종료 코드 ${code}). 인터넷 연결·디스크 공간·로그를 확인해 주세요. 기존 상품 자료는 삭제하지 않았습니다.`)); });
  });
}

async function install() {
  const pnpm = local.pnpmCommand();
  if (!pnpm) throw new Error("pnpm이 없습니다. 명령 프롬프트에서 'npm install --global pnpm@10.33.0'을 실행한 뒤 다시 설치해 주세요.");
  const wanted = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).packageManager.split("@")[1];
  const actual = checked(pnpm.file, [...pnpm.args, "--version"], "pnpm").trim();
  if (actual !== wanted) throw new Error(`pnpm ${wanted}이 필요합니다(현재 ${actual}). 'npm install --global pnpm@${wanted}' 명령으로 준비해 주세요.`);
  const env = { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: "1", NEXT_TELEMETRY_DISABLED: "1" };
  const sourceHash = local.fingerprint(root);
  // A failed/interrupted reinstall must not leave an apparently valid old build marker.
  fs.writeFileSync(stateFile, JSON.stringify({ version: 0, status: "installing" }));
  await run(pnpm.file, [...pnpm.args, "install", "--frozen-lockfile"], "앱 구성요소 설치", env);
  const sqlite = "const DB = require('better-sqlite3'); const db = new DB(':memory:'); db.close();";
  const probe = () => spawnSync(process.execPath, ["-e", sqlite], { cwd: root, windowsHide: true, timeout: 15000 });
  if (probe().status !== 0) {
    await run(pnpm.file, [...pnpm.args, "rebuild", "better-sqlite3"], "현재 Node.js용 데이터베이스 구성요소 준비", env);
    if (probe().status !== 0) throw new Error("SQLite 구성요소가 현재 Node.js와 맞지 않습니다. 최신 Node.js 22.x와 설치 로그를 확인해 주세요. 직접 컴파일 오류라면 Windows 빌드 도구가 필요할 수 있습니다.");
  }
  await run(pnpm.file, [...pnpm.args, "build"], "앱 실행 파일 준비", env);
  local.prepareStandalone(root);
  checked(process.execPath, ["-e", "const {createRequire}=require('node:module');const p=require('node:path');const DB=createRequire(p.resolve('.next/standalone/package.json'))('better-sqlite3');const db=new DB(':memory:');db.close();"], "실행 파일의 Node.js용 SQLite");
  if (sourceHash !== local.fingerprint(root)) throw new Error("설치 중 소스가 변경됐습니다. 다른 수정 작업이 끝난 뒤 다시 설치해 주세요.");
  const state = { version: 1, sourceHash, nodeMajor: process.versions.node.split(".")[0], buildId: fs.readFileSync(path.join(root, ".next/BUILD_ID"), "utf8").trim() };
  const temp = stateFile + ".tmp"; fs.writeFileSync(temp, JSON.stringify(state, null, 2)); fs.renameSync(temp, stateFile);
  say("\n설치가 완료됐습니다. 이제 '쇼핑클립 시작하기.cmd'를 더블클릭하세요. 기존 상품 자료는 그대로 유지했습니다.");
}

async function start(tools) {
  local.verifyInstalled(root);
  if (!(await local.portAvailable())) {
    if (local.isOurInstance(await local.readInstance(), root)) {
      say("이미 이 폴더의 쇼핑클립이 실행 중입니다. 크롬에서 다시 엽니다."); openChrome(tools.chrome); return;
    }
    throw new Error("127.0.0.1:3100 주소를 다른 프로그램이 사용하고 있습니다. 기존 실행 창을 직접 확인해 주세요. 다른 프로그램은 종료하지 않았습니다. 보관함 주소를 유지하기 위해 자동으로 다른 포트를 선택하지 않습니다.");
  }
  release = local.acquireLock(path.join(stateDir, "operation.lock"));
  if (stopping) throw new Error("로그 기록 또는 시작 작업이 중지됐습니다. 폴더 권한과 디스크 공간을 확인해 주세요.");
  const id = crypto.randomUUID();
  const env = { ...local.serverEnvironment(root, id), FFMPEG_PATH: tools.ffmpeg, FFPROBE_PATH: tools.ffprobe };
  say(`앱을 시작합니다. 주소: ${local.URL}\n이 창은 실행 중에 계속 열어 두세요. 종료하려면 Ctrl + C를 누르세요.`);
  child = spawn(process.execPath, [path.join(root, ".next/standalone/server.js")], { cwd: root, env, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
  const server = child;
  let ended = false;
  let exitCode;
  const finished = new Promise(resolve => {
    server.once("error", () => { ended = true; exitCode = 1; resolve(); });
    server.once("close", code => { ended = true; exitCode = code; resolve(); });
  });
  server.stdout.on("data", data => { process.stdout.write(data); stream.write(data); });
  server.stderr.on("data", data => { process.stderr.write(data); stream.write(data); });
  const deadline = Date.now() + 120000;
  let ready = false;
  while (!ended && !stopping && Date.now() < deadline) {
    if (local.isOurInstance(await local.readInstance(), root, id)) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  if (!ready) {
    server.kill(); await finished;
    if (stopping) return;
    throw new Error("앱 준비를 확인하지 못했습니다. 포트 충돌·구성요소 오류일 수 있습니다. 아래 로그 파일을 확인하고 '처음 설치하기.cmd'를 다시 실행해 주세요.");
  }
  say(`준비 완료. 크롬을 엽니다: ${local.URL}/discover`); openChrome(tools.chrome);
  await finished; child = null;
  if (!stopping && exitCode !== 0) throw new Error(`앱이 예기치 않게 종료됐습니다(종료 코드 ${exitCode}). 로그를 확인해 주세요.`);
}

async function main() {
  if (process.platform !== "win32") throw new Error("이 시작 파일은 Windows용입니다. Windows에서 .cmd 파일을 실행해 주세요.");
  // Use Next's normal production .env precedence without printing any values.
  // On first install the dependency is not present yet; Next build loads it after installation.
  if (fs.existsSync(path.join(root, "node_modules/@next/env/package.json"))) require("@next/env").loadEnvConfig(root, false, { info() {}, error() {} });
  fs.mkdirSync(path.join(stateDir, "logs"), { recursive: true });
  logFile = path.join(stateDir, "logs", `${new Date().toISOString().replace(/[:.]/g, "-")}-${setup ? "setup" : "start"}-${process.pid}.log`);
  const fd = fs.openSync(logFile, "a");
  stream = fs.createWriteStream(logFile, { fd, autoClose: true });
  stream.on("error", () => { console.error("로그를 기록하지 못했습니다. 폴더 쓰기 권한과 디스크 공간을 확인해 주세요."); stopping = true; child?.kill(); process.exitCode = 1; });
  say(`ClipForge 쇼핑클립 ${setup ? "처음 설치" : "시작"}\n진행 기록: ${logFile}`);
  const tools = prerequisites();
  const stop = () => { stopping = true; child?.kill(); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  try {
    if (setup) {
      if (!(await local.portAvailable())) throw new Error("3100 주소가 사용 중입니다. 실행 중인 앱을 먼저 직접 종료한 뒤 설치해 주세요. 다른 작업은 중단하지 않았습니다.");
      release = local.acquireLock(path.join(stateDir, "operation.lock"));
      await install();
    } else await start(tools);
  } finally {
    release?.(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
  }
}

if (require.main === module) {
  main().then(() => stream?.end()).catch(error => {
    const message = ["EACCES", "EPERM"].includes(error.code) ? "이 폴더에 쓸 권한이 없습니다. 내 문서 등 본인에게 쓰기 권한이 있는 폴더에서 실행해 주세요." : error.code === "ENOSPC" ? "디스크 공간이 부족합니다. 여유 공간을 확보한 뒤 다시 실행해 주세요." : error.message;
    console.error(`\n[실행 안내] ${message}\n${logFile ? `상세 기록: ${logFile}` : "설명: 윈도우 실행 안내.txt"}`);
    // A failed prerequisite happens before the normal finally block.
    if (stream && !stream.writableEnded && !stream.destroyed) stream.end(`\n[오류] ${message}\n`);
    release?.(); child?.kill(); process.exitCode = 1;
  });
}
