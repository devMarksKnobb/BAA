#!/usr/bin/env node
/**
 * Build Anything (BAA): local project analysis, scaffold generation and verification.
 *
 * BAA provides one local-first project workflow for analysis, generation and verification.
 * Inputs and generated files are treated as untrusted; generated output is
 * written only beneath an explicit output directory.
 */
import { readdir, readFile, writeFile, mkdir, stat, lstat, realpath } from "node:fs/promises";
import { resolve, relative, extname, basename, dirname, join, sep } from "node:path";
import { createHash } from "node:crypto";

const VERSION = "1.0.0";
const SKIP = new Set(["node_modules", ".git", ".next", ".nuxt", "dist", "build", "coverage", ".turbo", ".venv", "vendor", "Pods", "DerivedData"]);
const TEXT_EXT = new Set([".html",".htm",".css",".scss",".sass",".less",".js",".jsx",".ts",".tsx",".vue",".svelte",".json",".md",".yaml",".yml",".xml",".swift",".kt",".dart",".lua",".cs",".cpp",".h",".rs"]);
const MAX_FILE = 2 * 1024 * 1024;
const MAX_FILES = 4000;
const targets = ["react","next","vue","flutter","react-native","swiftui","compose","electron","tauri","unity","unreal","roblox"];
const title = s => s.replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50) || "baa-project";
const sha = b => createHash("sha256").update(b).digest("hex");
const json = x => JSON.stringify(x,null,2)+"\n";
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const help = `Build Anything (BAA) ${VERSION} — BAA project analysis, generation and verification

Usage:
  baa setup
  baa mcp [--http]
  baa project targets
  baa project analyze <source-directory> [--out <analysis.json>]
  baa project generate [--source <directory>] --target <target> --out <directory> [--name <name>] [--brief <text>]
  baa project verify <project-directory>
  baa --version
  baa project --help

Targets: ${targets.join(", ")}

Examples:
  baa project analyze ./existing-app --out ./baa-analysis.json
  baa project generate --source ./existing-app --target react --out ./generated-app --name "My App"
  baa project generate --target flutter --out ./mobile-app --brief "A task tracker with projects and reminders"
  baa project verify ./generated-app

Analysis is local and deterministic. It inventories files, source structure, CSS tokens,
routes and component candidates; it does not claim to infer runtime behaviour from static
files. Runtime-only behavior and production readiness require separate platform validation.
`;
function parse(argv) {
  const [command,...rest]=argv, opts={_:[]};
  for(let i=0;i<rest.length;i++){
    const a=rest[i];
    if(a.startsWith("--")) { const k=a.slice(2); if(["help"].includes(k)) opts[k]=true; else { const v=rest[++i]; if(!v || v.startsWith("--")) throw Error(`Missing value for --${k}`); opts[k]=v; } }
    else opts._.push(a);
  }
  return {command,opts};
}
async function walk(dir, rootDir=dir, out=[]) {
  const entries=await readdir(dir,{withFileTypes:true});
  entries.sort((a,b)=>a.name.localeCompare(b.name));
  for(const e of entries) {
    if(SKIP.has(e.name) || e.name.startsWith("." ) && e.name !== ".env.example") continue;
    const abs=join(dir,e.name);
    if(e.isSymbolicLink()) continue;
    if(e.isDirectory()) await walk(abs,rootDir,out);
    else if(e.isFile()) {
      const s=await stat(abs);
      if(s.size<=MAX_FILE) out.push({absolute:abs,path:relative(rootDir,abs).split(sep).join("/"),size:s.size});
      if(out.length>=MAX_FILES) return out;
    }
  }
  return out;
}
function parseCss(css) {
  const tokens={colors:[],fonts:[],spacing:[],radii:[]};
  const add=(key,v)=>{if(v && !tokens[key].includes(v)) tokens[key].push(v);};
  for(const m of css.matchAll(/--([\w-]+)\s*:\s*([^;}{]+)/g)) {
    const k=m[1].toLowerCase(),v=m[2].trim();
    if(/color|background|border|fill|stroke/.test(k)) add("colors",`--${m[1]}: ${v}`);
    if(/font|type/.test(k)) add("fonts",`--${m[1]}: ${v}`);
    if(/space|gap|padding|margin/.test(k)) add("spacing",`--${m[1]}: ${v}`);
    if(/radius/.test(k)) add("radii",`--${m[1]}: ${v}`);
  }
  for(const m of css.matchAll(/(?:^|[;{])\s*(?:color|background(?:-color)?|border-color)\s*:\s*([^;}{]+)/g)) {
    const v=m[1].trim(); if(/^#[\da-f]{3,8}\b|^rgba?\(|^hsla?\(/i.test(v)) add("colors",v);
  }
  return tokens;
}
function imageFacts(path, buf) {
  const ext=extname(path).toLowerCase();
  if(ext===".png" && buf.length>=24 && buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    return {format:"png",width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
  if(ext===".gif" && buf.length>=10 && buf.toString("ascii",0,3)==="GIF")
    return {format:"gif",width:buf.readUInt16LE(6),height:buf.readUInt16LE(8)};
  if(ext===".webp" && buf.length>=30 && buf.toString("ascii",0,4)==="RIFF" && buf.toString("ascii",8,12)==="WEBP") {
    const kind=buf.toString("ascii",12,16);
    if(kind==="VP8X") return {format:"webp",width:1+buf.readUIntLE(24,3),height:1+buf.readUIntLE(27,3)};
  }
  return {format:ext.slice(1)||"unknown"};
}
async function analyze(source) {
  const rootDir=await realpath(resolve(source));
  const rootStat=await stat(rootDir);
  if(!rootStat.isDirectory()) throw Error("Source must be a directory.");
  const entries=await walk(rootDir);
  const result={schema:"baa.analysis.v1",generatedAt:new Date().toISOString(),source:{directory:rootDir,fileCount:entries.length},evidence:{classification:"static-local-observation",limitations:["Static analysis cannot establish runtime-only behaviour, hidden API contracts, authentication rules, animation timing or server-side business logic.","Screenshots and media are inventoried; semantic visual interpretation requires a vision-capable model or human review.","Routes and component candidates are heuristics and must be checked against runtime evidence."]},inventory:{files:[],extensions:{},totalBytes:0},project:{package:null,frameworks:[],routes:[],componentCandidates:[],designTokens:{colors:[],fonts:[],spacing:[],radii:[]},images:[],media:[]},observations:[]};
  const cssParts=[];
  for(const entry of entries) {
    result.inventory.totalBytes+=entry.size;
    const ext=extname(entry.path).toLowerCase(); result.inventory.extensions[ext||"(none)"]=(result.inventory.extensions[ext||"(none)"]||0)+1;
    result.inventory.files.push({path:entry.path,size:entry.size,sha256:null});
    const b=await readFile(entry.absolute); result.inventory.files.at(-1).sha256=sha(b);
    if([".png",".jpg",".jpeg",".gif",".webp",".svg"].includes(ext)) result.project.images.push({path:entry.path,...(ext===".svg"?{format:"svg"}:imageFacts(entry.path,b))});
    if([".mp4",".mov",".webm",".m4v"].includes(ext)) result.project.media.push({path:entry.path,kind:"video",analysis:"inventory-only; use BAA runtime capture or a video/frame analysis adapter"});
    if(!TEXT_EXT.has(ext)) continue;
    const text=b.toString("utf8");
    if(ext===".json" && basename(entry.path)==="package.json") {
      try { const pkg=JSON.parse(text); result.project.package={name:pkg.name||null,scripts:Object.keys(pkg.scripts||{}),dependencies:Object.keys({...pkg.dependencies,...pkg.devDependencies})}; } catch {}
    }
    if([".css",".scss",".sass",".less"].includes(ext)) cssParts.push(text);
    if([".html",".htm",".vue",".svelte"].includes(ext)) {
      for(const m of text.matchAll(/(?:href|to)\s*=\s*["'](\/[^"'#?]*)["']/g)) if(!result.project.routes.includes(m[1])) result.project.routes.push(m[1]);
    }
    if([".js",".jsx",".ts",".tsx",".vue",".svelte"].includes(ext)) {
      for(const m of text.matchAll(/\b(?:export\s+default\s+function|function|const|class)\s+([A-Z][A-Za-z0-9_$]{1,50})\b/g)) {
        const name=m[1]; if(!result.project.componentCandidates.some(x=>x.name===name)) result.project.componentCandidates.push({name,source:entry.path,evidence:"named declaration; verify that this is a UI component"});
      }
      for(const m of text.matchAll(/(?:path|route|to)\s*:\s*["'](\/[^"' ]*)["']/g)) if(!result.project.routes.includes(m[1])) result.project.routes.push(m[1]);
    }
  }
  result.project.designTokens=parseCss(cssParts.join("\n"));
  const deps=result.project.package?.dependencies||[];
  const checks=[["react",["react","react-dom"]],["next",["next"]],["vue",["vue"]],["svelte",["svelte"]],["react-native",["react-native"]],["electron",["electron"]],["tauri",["@tauri-apps/api"]]];
  for(const [name,needles] of checks) if(needles.some(n=>deps.includes(n))) result.project.frameworks.push(name);
  if(result.project.frameworks.length===0) result.observations.push({kind:"unknown",detail:"No framework confidently identified from package dependencies."});
  result.project.routes.sort(); result.project.componentCandidates.sort((a,b)=>a.name.localeCompare(b.name));
  return result;
}
const baseCss=`:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17202b;background:#f7f8fa;font-synthesis:none;text-rendering:optimizeLegibility}*{box-sizing:border-box}body{margin:0}button,input,textarea,select{font:inherit}.container{width:min(1120px,calc(100% - 40px));margin-inline:auto}.topbar{display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-bottom:1px solid #e5e8ed}.hero{padding:clamp(64px,10vw,120px) 0;text-align:center}.hero h1{font-size:clamp(36px,7vw,72px);letter-spacing:-.055em;line-height:1.02;margin:12px auto;max-width:850px}.hero p{color:#667080;max-width:620px;margin:16px auto;line-height:1.7}.button{display:inline-block;padding:12px 18px;border:0;border-radius:8px;background:#17202b;color:white;text-decoration:none}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;padding-bottom:64px}.card{padding:22px;border:1px solid #e4e8ee;border-radius:12px;background:white}.card p{color:#687282;line-height:1.6}@media(max-width:600px){.container{width:min(100% - 28px,1120px)}.topbar span:last-child{display:none}}`;
function htmlApp(name,brief) { return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(brief.slice(0,150))}"><title>${esc(name)}</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`; }
function appMarkup(name,brief,jsx=true) {
 return `import React from "react";\n\nconst features = [\n  { title: "Clear structure", description: "Organize the experience into focused, reusable parts." },\n  { title: "Responsive by design", description: "Adapt the layout to the viewport and content." },\n  { title: "Accessible interactions", description: "Use semantic controls and keyboard-friendly patterns." },\n];\n\nexport default function App() {\n  return <main className="container">\n    <nav className="topbar"><strong>${name.replace(/[^A-Za-z0-9 &-]/g,"")}</strong><span>Overview　 Features　 About</span></nav>\n    <section className="hero"><p>BUILT WITH BUILD ANYTHING</p><h1>${brief.replace(/[^A-Za-z0-9 .,!?'-]/g,"").slice(0,95) || "Turn your idea into a working product."}</h1><p>Start with this generated foundation. Replace assumptions with confirmed product requirements and source evidence.</p><a className="button" href="#features">Explore the project</a></section>\n    <section id="features" className="grid">{features.map(item => <article className="card" key={item.title}><h2>{item.title}</h2><p>{item.description}</p></article>)}</section>\n  </main>;\n}\n`;
}
function scaffold(target,name,brief) {
 const titleName=title(name), pkg=slug(name);
 const files={};
 const add=(p,c)=>files[p]=c;
 add("README.md",`# ${titleName}\n\nGenerated by Build Anything (BAA) ${VERSION}.\n\n## Product brief\n\n${brief||"No product brief supplied. Define the product requirements before implementation."}\n\n## Status and evidence\n\nThis is a starter scaffold, not a complete production application. Confirm inferred workflows, API contracts, authentication, persistence, permissions and business rules before production use. See \`baa/project.json\` for the source analysis and provenance notes.\n\n## Next steps\n\n1. Replace sample content with confirmed requirements.\n2. Implement real API contracts and secure persistence.\n3. Add source-specific screens, states and assets.\n4. Run the platform build and tests.\n5. Perform a human visual review and platform-specific acceptance checks.\n`);
 add("baa/project.json",json({schema:"baa.project.v1",name:titleName,target,brief,evidencePolicy:{observed:"Directly present in supplied artifacts or BAA evidence.",derived:"Deterministically calculated from observed evidence.",inferred:"Hypothesis only; requires confirmation.",confirmed:"Approved by the user or verified against trusted runtime evidence."},unconfirmedAssumptions:[],verification:{status:"not-run",required:["Build","Tests","Accessibility","Visual comparison","Workflow coverage"]}}));
 if(target==="react"||target==="next"||target==="vue"||target==="electron"||target==="tauri") {
   if(target==="vue") {
     add("package.json",json({name:pkg,version:"0.1.0",private:true,type:"module",scripts:{dev:"vite --host 127.0.0.1",build:"vite build",preview:"vite preview",test:"vitest run"},dependencies:{vue:"^3.5.0"},devDependencies:{vite:"^6.0.0","@vitejs/plugin-vue":"^5.2.0",vitest:"^2.1.0"}}));
     add("index.html",`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titleName)}</title></head><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>`);
     add("vite.config.js",'import { defineConfig } from "vite";\nimport vue from "@vitejs/plugin-vue";\nexport default defineConfig({ plugins: [vue()] });\n');
     add("src/main.js",'import { createApp } from "vue";\nimport App from "./App.vue";\nimport "./style.css";\ncreateApp(App).mount("#app");\n');
     add("src/App.vue",`<script setup>\nconst features = ["Clear structure", "Responsive by design", "Accessible interactions"];\n</script>\n<template><main class="container"><nav class="topbar"><strong>${esc(titleName)}</strong><span>Overview　 Features　 About</span></nav><section class="hero"><p>BUILT WITH BUILD ANYTHING</p><h1>${esc(brief.slice(0,95)||"Turn your idea into a working product.")}</h1><p>Generated foundation — replace assumptions with confirmed requirements.</p><a class="button" href="#features">Explore the project</a></section><section id="features" class="grid"><article v-for="feature in features" :key="feature" class="card"><h2>{{ feature }}</h2><p>Build this capability from confirmed product evidence.</p></article></section></main></template>\n`);
     add("src/style.css",baseCss);
   } else {
     add("package.json",json({name:pkg,version:"0.1.0",private:true,type:"module",...(target==="electron"?{main:"electron/main.cjs"}:{}),scripts:{dev:"vite --host 127.0.0.1",build:"vite build",preview:"vite preview",test:"vitest run",...(target==="electron"?{start:"npm run build && electron ."}:{})},dependencies:{react:"^18.3.1","react-dom":"^18.3.1"},devDependencies:{vite:"^6.0.0",vitest:"^2.1.0",...(target==="electron"?{electron:"^33.0.0"}:{}),...(target==="tauri"?{"@tauri-apps/cli":"^2.0.0"}:{})}}));
     add("index.html",htmlApp(titleName,brief));
     add("src/main.jsx",'import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App.jsx";\nimport "./style.css";\ncreateRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);\n');
     add("src/App.jsx",appMarkup(titleName,brief));
     add("src/style.css",baseCss);
     if(target==="next") {
       delete files["index.html"]; delete files["src/main.jsx"]; delete files["src/App.jsx"]; delete files["src/style.css"];
       files["package.json"]=json({name:pkg,version:"0.1.0",private:true,scripts:{dev:"next dev",build:"next build",start:"next start"},dependencies:{next:"^15.0.0",react:"^19.0.0","react-dom":"^19.0.0"}});
       add("app/layout.jsx",`import "./globals.css";\nexport const metadata = { title: "${titleName}", description: "${brief.replace(/"/g,"'").slice(0,150)}" };\nexport default function RootLayout({ children }) { return <html lang="en"><body>{children}</body></html>; }\n`);
       add("app/page.jsx",appMarkup(titleName,brief).replace('import React from "react";\n\n',''));
       add("app/globals.css",baseCss);
     }
     if(target==="electron"||target==="tauri") {
       add("desktop/README.md",target==="electron"?"Electron main-process entrypoint belongs here. Keep privileged APIs in the main process and expose a narrow, validated preload bridge.":"Tauri Rust commands belong in src-tauri/src; define explicit capabilities and least-privilege permissions.");
       if(target==="electron") add("electron/main.cjs",'const { app, BrowserWindow } = require("electron");\nconst path = require("node:path");\nfunction createWindow() { const win = new BrowserWindow({ width: 1280, height: 820, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } }); win.loadURL(process.env.VITE_DEV_SERVER_URL || `file://${path.join(__dirname, "../dist/index.html")}`); }\napp.whenReady().then(createWindow);\n');
       if(target==="tauri") add("src-tauri/README.md","Initialize the Rust host using the Tauri CLI after installing the platform toolchain. Review capabilities and CSP before enabling filesystem, shell or network access.\n");
     }
   }
 } else if(target==="react-native") {
   add("package.json",json({name:pkg,version:"0.1.0",private:true,scripts:{start:"expo start",android:"expo run:android",ios:"expo run:ios",test:"jest"},dependencies:{expo:"~52.0.0",react:"18.3.1","react-native":"0.76.0"}}));
   add("app.json",json({expo:{name:titleName,slug:pkg,version:"0.1.0",orientation:"default",userInterfaceStyle:"automatic",splash:{resizeMode:"contain",backgroundColor:"#f7f8fa"}}}));
   add("App.tsx",`import React from "react";\nimport { SafeAreaView, ScrollView, Text, View, Pressable, StyleSheet } from "react-native";\nexport default function App() { return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page}><Text style={s.brand}>${titleName}</Text><Text style={s.eyebrow}>BUILT WITH BUILD ANYTHING</Text><Text style={s.title}>${brief.replace(/[^A-Za-z0-9 .,!?'-]/g,"").slice(0,90)||"Turn your idea into a working product."}</Text><Text style={s.body}>Generated foundation. Confirm requirements before connecting services.</Text><Pressable accessibilityRole="button" style={s.button}><Text style={s.buttonText}>Get started</Text></Pressable><View style={s.card}><Text style={s.cardTitle}>Responsive, accessible foundation</Text><Text style={s.body}>Replace this screen with confirmed workflows and design evidence.</Text></View></ScrollView></SafeAreaView> }\nconst s=StyleSheet.create({safe:{flex:1,backgroundColor:"#f7f8fa"},page:{padding:24,gap:18},brand:{fontSize:18,fontWeight:"700"},eyebrow:{fontSize:11,letterSpacing:2},title:{fontSize:36,fontWeight:"800",color:"#17202b"},body:{color:"#667080",lineHeight:23},button:{backgroundColor:"#17202b",padding:14,borderRadius:8,alignSelf:"flex-start"},buttonText:{color:"white",fontWeight:"700"},card:{padding:20,borderWidth:1,borderColor:"#e4e8ee",borderRadius:12,backgroundColor:"white"},cardTitle:{fontSize:17,fontWeight:"700"}});\n`);
 } else if(target==="flutter") {
   add("pubspec.yaml",`name: ${pkg.replace(/-/g,"_")}\ndescription: Generated by Build Anything\npublish_to: none\nversion: 0.1.0+1\nenvironment:\n  sdk: '>=3.4.0 <4.0.0'\ndependencies:\n  flutter:\n    sdk: flutter\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n  flutter_lints: ^5.0.0\nflutter:\n  uses-material-design: true\n`);
   add("lib/main.dart",`import 'package:flutter/material.dart';\nvoid main() => runApp(const BaaApp());\nclass BaaApp extends StatelessWidget { const BaaApp({super.key}); @override Widget build(BuildContext context) => MaterialApp(title: '${titleName}', theme: ThemeData(colorSchemeSeed: const Color(0xFF526B3B), useMaterial3: true), home: const HomeScreen()); }\nclass HomeScreen extends StatelessWidget { const HomeScreen({super.key}); @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('${titleName}')), body: ListView(padding: const EdgeInsets.all(24), children: [const Text('BUILT WITH BUILD ANYTHING'), const SizedBox(height: 16), Text('${brief.replace(/'/g,"\\'").slice(0,100)||"Turn your idea into a working product."}', style: Theme.of(context).textTheme.headlineMedium), const SizedBox(height: 12), const Text('Generated foundation. Confirm requirements before connecting services.'), const SizedBox(height: 24), Card(child: ListTile(title: const Text('Responsive foundation'), subtitle: const Text('Replace with confirmed product workflows.')))])); } }\n`);
 } else if(target==="swiftui") {
   add("Package.swift",`// swift-tools-version: 5.9\nimport PackageDescription\nlet package = Package(name: "${titleName.replace(/\s/g,"")}", platforms: [.iOS(.v17), .macOS(.v14)], products: [.executable(name: "${titleName.replace(/\s/g,"")}", targets: ["${titleName.replace(/\s/g,"")}")], targets: [.executableTarget(name: "${titleName.replace(/\s/g,"")}")])\n`);
   add("Sources/BAAApp.swift",`import SwiftUI
@main
struct BAAApp: App { var body: some Scene { WindowGroup { AppView() } } }
`);
   add("Sources/AppView.swift",`import SwiftUI\n\nstruct AppView: View {\n    var body: some View {\n        NavigationStack {\n            ScrollView {\n                VStack(alignment: .leading, spacing: 20) {\n                    Text("BUILT WITH BUILD ANYTHING").font(.caption).tracking(2)\n                    Text("${brief.replace(/"/g,"'").slice(0,90)||"Turn your idea into a working product."}").font(.largeTitle.bold())\n                    Text("Generated foundation. Confirm requirements before connecting services.").foregroundStyle(.secondary)\n                    Label("Responsive foundation", systemImage: "square.grid.2x2").padding().frame(maxWidth: .infinity, alignment: .leading).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))\n                }.padding()\n            }.navigationTitle("${titleName}")\n        }\n    }\n}\n`);
 } else if(target==="compose") {
   add("settings.gradle.kts",'pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name = "BaaProject"\ninclude(":app")\n');
   add("app/build.gradle.kts",'plugins { id("com.android.application") version "8.7.0"; id("org.jetbrains.kotlin.android") version "2.0.21"; id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" }\nandroid { namespace = "com.example.baaproject"; compileSdk = 35; defaultConfig { applicationId = "com.example.baaproject"; minSdk = 24; targetSdk = 35; versionCode = 1; versionName = "0.1.0" } }\ndependencies { implementation(platform("androidx.compose:compose-bom:2024.10.00")); implementation("androidx.activity:activity-compose:1.9.3"); implementation("androidx.compose.material3:material3"); implementation("androidx.compose.ui:ui") }\n');
   add("app/src/main/AndroidManifest.xml",'<?xml version="1.0" encoding="utf-8"?><manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:theme="@android:style/Theme.Material.Light.NoActionBar" android:label="BAA Project"><activity android:name=".MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>\n');
   add("app/src/main/java/com/example/baaproject/MainActivity.kt",`package com.example.baaproject\nimport android.os.Bundle\nimport androidx.activity.ComponentActivity\nimport androidx.activity.compose.setContent\nimport androidx.compose.foundation.layout.*\nimport androidx.compose.material3.*\nimport androidx.compose.ui.Modifier\nimport androidx.compose.ui.unit.dp\nimport androidx.compose.ui.unit.sp\nclass MainActivity : ComponentActivity() { override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); setContent { MaterialTheme { Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) { Text("${titleName}", style = MaterialTheme.typography.titleLarge); Text("${brief.replace(/"/g,"'").slice(0,90)||"Turn your idea into a working product."}", fontSize = 28.sp); Text("Generated foundation. Confirm requirements before connecting services."); ElevatedCard { Text("Responsive foundation", Modifier.padding(20.dp)) } } } } } }\n`);
 } else if(target==="roblox") {
   add("README.md",`# ${titleName} — Roblox Studio\n\nOpen the Luau scripts in Roblox Studio. Place server scripts in ServerScriptService and client scripts in StarterPlayerScripts. Do not trust client-side values for currency, inventory, permissions or purchases. Validate all RemoteEvent inputs on the server.\n\nBrief: ${brief}\n`);
   add("default.project.json",json({name:titleName,tree:{"$className":"DataModel",ServerScriptService:{"$path":"src/server"},StarterPlayer:{StarterPlayerScripts:{"$path":"src/client"}}}}));
   add("src/server/Main.server.lua",`--!strict\n-- Server-authoritative starting point for ${titleName}.\nlocal Players = game:GetService("Players")\nPlayers.PlayerAdded:Connect(function(player: Player)\n    print("Initialized BAA experience for", player.UserId)\nend)\n`);
   add("src/client/Main.client.lua",`--!strict\n-- Client entrypoint. UI and input belong here; validate all consequential actions on the server.\nlocal Players = game:GetService("Players")\nlocal player = Players.LocalPlayer\nprint("BAA client ready for", player.Name)\n`);
 } else if(target==="unity") {
   add("Assets/Scripts/BaaEntryPoint.cs",`using UnityEngine;\n\npublic sealed class BaaEntryPoint : MonoBehaviour\n{\n    private void Start()\n    {\n        Debug.Log("${titleName} — generated BAA starter initialized.");\n        // Implement scene transitions, input, save data and gameplay from confirmed requirements.\n    }\n}\n`);
   add("README.md",`# ${titleName} — Unity\n\nCreate a Unity project, then copy Assets/ into it. The scaffold includes a MonoBehaviour entry point; scene, input, rendering pipeline and platform settings remain project-specific.\n\nBrief: ${brief}\n`);
 } else if(target==="unreal") {
   add("Source/BaaStarter/BaaStarter.Build.cs",'using UnrealBuildTool;\npublic class BaaStarter : ModuleRules { public BaaStarter(ReadOnlyTargetRules Target) : base(Target) { PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs; PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore" }); } }\n');
   add("Source/BaaStarter/BaaStarter.h",'#pragma once\n#include "Modules/ModuleManager.h"\nclass FBaaStarterModule : public FDefaultGameModuleImpl {};\n');
   add("Source/BaaStarter/BaaStarter.cpp",'#include "BaaStarter.h"\n#include "Modules/ModuleManager.h"\nIMPLEMENT_PRIMARY_GAME_MODULE(FBaaStarterModule, BaaStarter, "BaaStarter");\n');
   add("README.md",`# ${titleName} — Unreal Engine\n\nAdd this module to an Unreal C++ project and register it in the project descriptor. Game mode, maps, assets, input and packaging are project-specific and need an Unreal Editor/toolchain validation pass.\n\nBrief: ${brief}\n`);
 }
 return files;
}
async function safeWriteTree(out, files) {
 const output=resolve(out);
 await mkdir(output,{recursive:true});
 const rootReal=await realpath(output);
 const prepared=[];
 for(const [name,content] of Object.entries(files)) {
   const dest=resolve(rootReal,name);
   const rel=relative(rootReal,dest);
   if(rel.startsWith("..") || rel === ".." || rel.startsWith(sep) || resolve(dest)!==dest) throw Error(`Unsafe generated path: ${name}`);
   const parts=dirname(rel)==="."?[]:dirname(rel).split(sep);
   let parent=rootReal;
   for(const part of parts) {
     parent=join(parent,part);
     try {
       const existing=await lstat(parent);
       if(existing.isSymbolicLink() || !existing.isDirectory()) throw Error(`Refusing unsafe output path: ${name}`);
     } catch(error) {
       if(error?.code!=="ENOENT") throw error;
       await mkdir(parent);
     }
   }
   try {
     await lstat(dest);
     throw Error(`Refusing to overwrite existing file: ${dest}`);
   } catch(error) {
     if(error?.code!=="ENOENT") throw error;
   }
   prepared.push([dest,content]);
 }
 for(const [dest,content] of prepared) await writeFile(dest,content,{flag:"wx"});
}
async function generate(opts) {
 if(!opts.target || !targets.includes(opts.target)) throw Error(`Choose --target from: ${targets.join(", ")}`);
 if(!opts.out) throw Error("--out is required.");
 const name=opts.name||basename(resolve(opts.out));
 const brief=opts.brief||"";
 let analysis=null;
 if(opts.source) analysis=await analyze(opts.source);
 const files=scaffold(opts.target,name,brief);
 const manifest=JSON.parse(files["baa/project.json"]);
 manifest.sourceAnalysis=analysis?{fileCount:analysis.inventory.files.length,frameworks:analysis.project.frameworks,routes:analysis.project.routes,designTokens:analysis.project.designTokens,limitations:analysis.evidence.limitations}:null;
 files["baa/project.json"]=json(manifest);
 files["baa/design-tokens.json"]=json(analysis?.project.designTokens ?? {colors:[],fonts:[],spacing:[],radii:[]});
 if(analysis) files["baa/source-analysis.json"]=json(analysis);
 await safeWriteTree(opts.out,files);
 process.stdout.write(`Generated ${opts.target} starter at ${resolve(opts.out)} (${Object.keys(files).length} files).\\n`);
 process.stdout.write("This is a starter scaffold. Platform toolchains and product-specific behaviour still require implementation and validation.\\n");
}
async function verify(dir) {
 const rootDir=await realpath(resolve(dir)), entries=await walk(rootDir);
 const paths=new Set(entries.map(x=>x.path));
 const issues=[];
 const manifestPath=join(rootDir,"baa/project.json");
 let manifest;
 try { manifest=JSON.parse(await readFile(manifestPath,"utf8")); } catch { issues.push("Missing or invalid baa/project.json manifest."); }
 if(!paths.size) issues.push("Project contains no files.");
 const hasReadme=paths.has("README.md"); if(!hasReadme) issues.push("Missing README.md.");
 const requiredByTarget = {
   react:["package.json","index.html","src/main.jsx","src/App.jsx","src/style.css"],
   next:["package.json","app/layout.jsx","app/page.jsx","app/globals.css"],
   vue:["package.json","index.html","src/main.js","src/App.vue","src/style.css"],
   flutter:["pubspec.yaml","lib/main.dart"],
   "react-native":["package.json","App.tsx"],
   swiftui:["Package.swift","Sources/AppView.swift"],
   compose:["settings.gradle.kts","app/build.gradle.kts","app/src/main/AndroidManifest.xml","app/src/main/java/com/example/baaproject/MainActivity.kt"],
   electron:["package.json","index.html","src/main.jsx","electron/main.cjs"],
   tauri:["package.json","index.html","src/main.jsx","src-tauri/README.md"],
   unity:["Assets/Scripts/BaaEntryPoint.cs"],
   unreal:["Source/BaaStarter/BaaStarter.Build.cs","Source/BaaStarter/BaaStarter.cpp"],
   roblox:["src/server/Main.server.lua","src/client/Main.client.lua"]
 };
 for(const required of requiredByTarget[manifest?.target] ?? []) if(!paths.has(required)) issues.push(`Missing ${manifest.target} target file: ${required}`);
 if(["react","vue","next","electron","tauri"].includes(manifest?.target)) {
   if(!paths.has("package.json")) issues.push("Missing package.json.");
   else {
     try { const p=JSON.parse(await readFile(join(rootDir,"package.json"),"utf8")); if(!p.scripts?.build) issues.push("package.json has no build script."); } catch { issues.push("Invalid package.json."); }
   }
 }
 const result={schema:"baa.verification.v1",project:rootDir,target:manifest?.target||"unknown",status:issues.length?"failed":"passed",checks:{fileInventory:entries.length,readme:hasReadme,manifest:Boolean(manifest),targetEntryFiles:requiredByTarget[manifest?.target]??[],issues},limitations:["This command performs structural checks only; it does not install dependencies, compile platform projects, run tests, inspect runtime behaviour, assess accessibility or compare visual output.","Use the relevant platform toolchain and a human visual review for evidence-based verification."]};
 process.stdout.write(json(result));
 if(issues.length) process.exitCode=1;
}
async function main() {
 const {command,opts}=parse(process.argv.slice(2));
 if(!command||command==="--help"||opts.help||command==="help") { process.stdout.write(help); return; }
 if(command==="targets") { process.stdout.write(targets.join("\n")+"\n"); return; }
 if(command==="analyze") {
   const source=opts._[0]||opts.source; if(!source) throw Error("Provide a source directory.");
   const result=await analyze(source), output=json(result);
   if(opts.out) await writeFile(resolve(opts.out),output,{flag:"wx"}); else process.stdout.write(output);
   return;
 }
 if(command==="generate") return generate(opts);
 if(command==="verify") { if(!opts._[0]) throw Error("Provide a generated project directory."); return verify(opts._[0]); }
 throw Error(`Unknown command: ${command}\nRun baa project --help.`);
}
main().catch(error=>{ process.stderr.write(`BAA: ${error.message}\n`); process.exitCode=1; });
