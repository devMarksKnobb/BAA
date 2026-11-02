import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/baa-project.mjs", import.meta.url));
const cli = fileURLToPath(new URL("../scripts/baa.mjs", import.meta.url));
const runCli = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
test("BAA advertises the platform target families", () => {
  const result = run("targets");
  assert.equal(result.status, 0, result.stderr);
  for (const target of ["react","next","vue","flutter","react-native","swiftui","compose","electron","tauri","unity","unreal","roblox"])
    assert.match(result.stdout, new RegExp(`^${target}$`, "m"));
});
test("BAA analyzes a local web project and extracts evidence with hashes", async t => {
  const dir = await mkdtemp(join(tmpdir(), "baa-analysis-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir,"src"));
  await writeFile(join(dir,"package.json"), JSON.stringify({name:"sample",dependencies:{react:"18"}}));
  await writeFile(join(dir,"src","App.jsx"), 'export default function App() { return null; }');
  await writeFile(join(dir,"src","style.css"), ':root { --brand-color: #123456; --space-unit: 8px; }');
  const result=run("analyze",dir);
  assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.project.frameworks[0],"react");
  assert.equal(report.project.componentCandidates[0].name,"App");
  assert.ok(report.project.designTokens.colors.some(x=>x.includes("#123456")));
  assert.match(report.inventory.files[0].sha256,/^[a-f0-9]{64}$/);
});
test("BAA generates a runnable React/Vite starter and verifies its manifest", async t => {
  const dir=await mkdtemp(join(tmpdir(),"baa-generate-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const out=join(dir,"generated");
  const generated=run("generate","--target","react","--out",out,"--name","Example","--brief","A sample app");
  assert.equal(generated.status,0,generated.stderr);
  const pkg=JSON.parse(await readFile(join(out,"package.json"),"utf8"));
  assert.equal(pkg.scripts.build,"vite build");
  assert.ok((await readFile(join(out,"src","App.jsx"),"utf8")).includes("A sample app"));
  const verified=run("verify",out);
  assert.equal(verified.status,0,verified.stderr);
  assert.equal(JSON.parse(verified.stdout).status,"passed");
});
test("BAA refuses to overwrite generated files", async t => {
  const dir=await mkdtemp(join(tmpdir(),"baa-overwrite-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const out=join(dir,"generated");
  assert.equal(run("generate","--target","roblox","--out",out).status,0);
  const second=run("generate","--target","roblox","--out",out);
  assert.notEqual(second.status,0);
});

test("every advertised target generates a verifiable project", async t => {
  const dir=await mkdtemp(join(tmpdir(),"baa-all-targets-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  for (const target of ["react","next","vue","flutter","react-native","swiftui","compose","electron","tauri","unity","unreal","roblox"]) {
    const out=join(dir,target);
    const generated=run("generate","--target",target,"--out",out,"--name","Target Test");
    assert.equal(generated.status,0,`${target}: ${generated.stderr}`);
    const verified=run("verify",out);
    assert.equal(verified.status,0,`${target}: ${verified.stderr}`);
    assert.equal(JSON.parse(verified.stdout).target,target);
  }
});

test("BAA CLI exposes the project workflow under a dedicated namespace", () => {
  const help = runCli("project", "--help");
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /baa project targets/);
  assert.match(help.stdout, /baa project generate/);
  const targets = runCli("project", "targets");
  assert.equal(targets.status, 0, targets.stderr);
  assert.match(targets.stdout, /^react$/m);
  const version = runCli("--version");
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /^1\.0\.0/m);
});

test("BAA refuses symlinked output directories", async t => {
  const dir = await mkdtemp(join(tmpdir(), "baa-symlink-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const out = join(dir, "generated");
  const outside = join(dir, "outside");
  await mkdir(out);
  await mkdir(outside);
  await symlink(outside, join(out, "baa"), "dir");
  const generated = run("generate", "--target", "react", "--out", out);
  assert.notEqual(generated.status, 0);
  await assert.rejects(readFile(join(outside, "project.json")));
});
