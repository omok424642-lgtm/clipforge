// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { spawnSync } from "node:child_process";

const launcher = createRequire(import.meta.url)("../../../scripts/lib/windows-launcher.cjs");
let root: string;
const servers: Server[] = [];
function file(name: string, data: string) {
  const full = join(root, name); mkdirSync(join(full, ".."), { recursive: true }); writeFileSync(full, data); return full;
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "clipforge 한글 & (개인용) ! "));
  file("src/app/page.tsx", "existing app"); file("data/product-imports/keep.json", '{"title":"보존할 상품"}');
});
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); })));
  rmSync(root, { recursive: true, force: true });
});

describe("local-only launcher configuration", () => {
  it.each(["22.13.0", "22.23.4", "24.0.0"])("supports Node %s", version => expect(launcher.supportedNode(version)).toBe(true));
  it.each(["20.19.0", "22.12.0", "bad"])("rejects unsupported Node %s", version => expect(launcher.supportedNode(version)).toBe(false));
  it("overrides public bindings and keeps existing data and migration directories", () => {
    const data = join(root, "기존 자료"); const migrations = join(root, "기존 마이그레이션");
    const env = launcher.serverEnvironment(root, "instance", { HOSTNAME: "0.0.0.0", PORT: "80", APP_DATA_DIR: data, APP_MIGRATIONS_DIR: migrations });
    expect(env.HOSTNAME).toBe("127.0.0.1"); expect(env.PORT).toBe("3100");
    expect(env.APP_DATA_DIR).toBe(data); expect(env.APP_MIGRATIONS_DIR).toBe(migrations);
    expect(env.CLIPFORGE_LOCAL_INSTANCE).toBe("instance"); expect(env.CLIPFORGE_LOCAL_ROOT).toBe(launcher.rootId(root));
    expect(launcher.serverEnvironment(root, "id", {}).APP_DATA_DIR).toBe(join(root, "data"));
  });
  it("anchors existing relative data paths before standalone changes its working directory", () => {
    const env = launcher.serverEnvironment(root, "id", { APP_DATA_DIR: "my-existing-data", APP_MIGRATIONS_DIR: "./drizzle" });
    expect(env.APP_DATA_DIR).toBe(join(root, "my-existing-data"));
    expect(env.APP_MIGRATIONS_DIR).toBe(join(root, "drizzle"));
  });
  it("recognizes only the same app folder and exact boot instance", () => {
    const info = { app: "clipforge-local", rootId: launcher.rootId(root), instanceId: "current" };
    expect(launcher.isOurInstance(info, root)).toBe(true);
    expect(launcher.isOurInstance(info, root, "current")).toBe(true);
    expect(launcher.isOurInstance(info, root, "old")).toBe(false);
    expect(launcher.isOurInstance({ ...info, rootId: "another-folder" }, root)).toBe(false);
    expect(launcher.isOurInstance({ ...info, app: "another-app" }, root)).toBe(false);
    expect(launcher.isOurInstance(null, root)).toBe(false);
  });
});

describe("Windows tool discovery without a command shell", () => {
  it("supports Chrome standard, custom and registry paths, and reports missing Chrome", () => {
    const chrome = file("custom chrome/chrome.exe", "fixture");
    expect(launcher.chromePath({ CLIPFORGE_CHROME_PATH: chrome })).toBe(chrome);
    expect(launcher.chromePath({}, existsSync, [chrome])).toBe(chrome);
    expect(launcher.chromePath({ LOCALAPPDATA: root }, () => true)).toBe(join(root, "Google/Chrome/Application/chrome.exe"));
    expect(launcher.chromePath({}, () => false)).toBeNull();
  });
  it("resolves pnpm's Node CLI as a literal path with spaces, metacharacters and Korean text", () => {
    const cli = file("node_modules/pnpm/bin/pnpm.cjs", "process.stdout.write(JSON.stringify(process.argv.slice(2)))");
    const command = launcher.pnpmCommand({ PATH: root }, "win32");
    expect(command.file).toBe(process.execPath); expect(command.args).toEqual([cli]);
    const result = spawnSync(command.file, [...command.args, "한글 & (옵션) !"], { encoding: "utf8", shell: false });
    expect(result.status).toBe(0); expect(JSON.parse(result.stdout)).toEqual(["한글 & (옵션) !"]);
  });
  it("supports Corepack and the standalone executable without executing .cmd through a shell", () => {
    const corepack = file("node_modules/corepack/dist/pnpm.js", "fixture");
    file("pnpm.cmd", "fixture");
    expect(launcher.pnpmCommand({ Path: root }, "win32").args).toEqual([corepack]);
    rmSync(corepack);
    const executable = file("pnpm.exe", "fixture");
    expect(launcher.pnpmCommand({ PATH: root }, "win32")).toEqual({ file: executable, args: [] });
    expect(launcher.pnpmCommand({ PATH: root }, "win32", () => false)).toBeNull();
  });
  it("prefers explicitly installed pnpm over an earlier Node Corepack installation", () => {
    file("node/node_modules/corepack/dist/pnpm.js", "fixture"); file("node/pnpm.cmd", "fixture");
    const installed = file("npm/node_modules/pnpm/bin/pnpm.cjs", "fixture");
    expect(launcher.pnpmCommand({ PATH: `${join(root, "node")};${join(root, "npm")}` }, "win32").args).toEqual([installed]);
  });
});

describe("installation state and data preservation", () => {
  it("requires a one-time install and detects changed sources and Node major versions", () => {
    expect(() => launcher.verifyInstalled(root, "22.23.4")).toThrow("최초 설치");
    file(".next/BUILD_ID", "build-id"); file(".next/standalone/server.js", "fixture");
    file(".clipforge-launcher/state.json", JSON.stringify({ version: 1, sourceHash: launcher.fingerprint(root), nodeMajor: "22", buildId: "build-id" }));
    expect(() => launcher.verifyInstalled(root, "22.23.4")).not.toThrow();
    expect(() => launcher.verifyInstalled(root, "24.0.0")).toThrow("버전");
    file("src/app/page.tsx", "updated app");
    expect(() => launcher.verifyInstalled(root, "22.23.4")).toThrow("소스");
    expect(readFileSync(join(root, "data/product-imports/keep.json"), "utf8")).toContain("보존할 상품");
  });
  it("requires rebuild if build output disappears or was replaced", () => {
    file(".next/BUILD_ID", "current");
    file(".clipforge-launcher/state.json", JSON.stringify({ version: 1, sourceHash: launcher.fingerprint(root), nodeMajor: "22", buildId: "old" }));
    expect(() => launcher.verifyInstalled(root, "22.23.4")).toThrow("실행 파일");
  });
  it("does not consider an interrupted installation ready", () => {
    file(".clipforge-launcher/state.json", '{"version":0,"status":"installing"}');
    expect(() => launcher.verifyInstalled(root, "22.23.4")).toThrow("처음 설치하기");
  });
  it("ignores changing product data and logs when checking source freshness", () => {
    const hash = launcher.fingerprint(root);
    file("data/product-imports/new.json", "new product"); file(".clipforge-launcher/logs/run.log", "new log");
    expect(launcher.fingerprint(root)).toBe(hash);
    file("pnpm-lock.yaml", "changed dependencies"); expect(launcher.fingerprint(root)).not.toBe(hash);
  });
  it("copies only runtime assets, preserving product data, and rejects missing server output", () => {
    expect(() => launcher.prepareStandalone(root)).toThrow("실행 파일");
    file(".next/standalone/server.js", "server"); file(".next/static/asset.js", "static"); file("public/logo.svg", "logo");
    const before = readFileSync(join(root, "data/product-imports/keep.json"));
    launcher.prepareStandalone(root);
    expect(readFileSync(join(root, ".next/standalone/.next/static/asset.js"), "utf8")).toBe("static");
    expect(readFileSync(join(root, ".next/standalone/public/logo.svg"), "utf8")).toBe("logo");
    expect(readFileSync(join(root, "data/product-imports/keep.json"))).toEqual(before);
    expect(existsSync(join(root, ".next/standalone/data"))).toBe(false);
  });
});

describe("simultaneous starts and readiness", () => {
  it("refuses a second active operation and releases only its own lock", () => {
    const lock = join(root, ".clipforge-launcher/operation.lock");
    const release = launcher.acquireLock(lock);
    expect(() => launcher.acquireLock(lock)).toThrow("진행 중");
    release(); expect(existsSync(lock)).toBe(false);
    const releaseOther = launcher.acquireLock(lock);
    file(".clipforge-launcher/operation.lock", JSON.stringify({ pid: process.pid, nonce: "another-owner" }));
    releaseOther(); expect(existsSync(lock)).toBe(true);
  });
  it("does not delete an unreadable or invalid operation marker", () => {
    const lock = file(".clipforge-launcher/operation.lock", "not-json");
    expect(() => launcher.acquireLock(lock)).toThrow("읽지 못했");
    expect(readFileSync(lock, "utf8")).toBe("not-json");
  });
  it("recovers only a stale lock left by a process that has exited", () => {
    const exited = spawnSync(process.execPath, ["-e", ""], { timeout: 3000 });
    expect(exited.status).toBe(0);
    const lock = file(".clipforge-launcher/operation.lock", JSON.stringify({ pid: exited.pid, nonce: "old" }));
    const release = launcher.acquireLock(lock);
    expect(JSON.parse(readFileSync(lock, "utf8")).pid).toBe(process.pid);
    release(); expect(existsSync(lock)).toBe(false);
    expect(readFileSync(join(root, "data/product-imports/keep.json"), "utf8")).toContain("보존할 상품");
  });
  async function server(body: string, status = 200) {
    const instance = createServer((req, res) => { expect(req.url).toBe("/api/local-launcher"); res.writeHead(status); res.end(body); });
    servers.push(instance);
    await new Promise<void>(resolve => instance.listen(0, "127.0.0.1", resolve));
    return (instance.address() as AddressInfo).port;
  }
  it("detects an occupied port without terminating or replacing its listener", async () => {
    const port = await server('{"app":"foreign"}');
    expect(await launcher.portAvailable(port)).toBe(false);
    expect(await launcher.readInstance(1000, `http://127.0.0.1:${port}`)).toEqual({ app: "foreign" });
    expect(await launcher.portAvailable(port)).toBe(false);
  });
  it.each([["not JSON", 200], ['{"app":"clipforge-local"}', 503], ["x".repeat(5000), 200]])("rejects malformed, failed or oversized readiness responses", async (body, status) => {
    const port = await server(body, status);
    expect(await launcher.readInstance(1000, `http://127.0.0.1:${port}`)).toBeNull();
  });
  it("times out rather than hanging on an unrelated unresponsive listener", async () => {
    const instance = createServer(() => {}); servers.push(instance);
    await new Promise<void>(resolve => instance.listen(0, "127.0.0.1", resolve));
    const port = (instance.address() as AddressInfo).port;
    expect(await launcher.readInstance(50, `http://127.0.0.1:${port}`)).toBeNull();
  });
});

it("ships UTF-8 Korean bootstrap files with CRLF, no BOM, and delayed expansion disabled", () => {
  for (const name of ["처음 설치하기.cmd", "쇼핑클립 시작하기.cmd"]) {
    const content = readFileSync(join(process.cwd(), name), "utf8");
    expect(content.startsWith("@echo off\r\nchcp 65001")).toBe(true);
    expect(content.replaceAll("\r\n", "")).not.toContain("\n");
    expect(content).toContain("setlocal DisableDelayedExpansion");
    expect(content).toContain('node "%~dp0scripts\\windows-launcher.cjs"');
    expect(content).toContain("pause");
  }
});
