import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, lstat, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { randomUUID, createHash } from 'node:crypto';
import { validateCanonicalRecord, type CanonicalRecord } from '../core/canonical.js';
import { sha256 } from '../utils/hash.js';

export interface ExportSummary { records: number; files: number; bytes: number; manifestSha256: string; }
export interface ImportSummary { records: number; written: number; skipped: number; errors: Array<{line:number;message:string}>; }

/** Export a Markdown directory into a portable, line-oriented canonical archive. */
export async function exportMarkdownToCanonicalJsonl(sourceDir: string, outputFile: string): Promise<ExportSummary> {
  const root = path.resolve(sourceDir);
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error(`Source is not a directory: ${root}`);
  const destination = path.resolve(outputFile);
  if (destination === root || destination.startsWith(root + path.sep)) throw new Error('Archive output must be outside the source directory');
  await mkdir(path.dirname(destination), { recursive: true });
  const paths: string[] = [];
  let files = 0, bytes = 0;
  async function walk(dir: string): Promise<void> {
    for (const ent of (await readdir(dir, {withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      if (ent.name === '.git' || ent.name === '.obsidian' || ent.name === 'node_modules') continue;
      const full = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) { await walk(full); continue; }
      if (ent.isFile()) paths.push(full);
    }
  }
  await walk(root);
  paths.sort((a,b)=>path.relative(root,a).localeCompare(path.relative(root,b)));
  const temp = path.join(path.dirname(destination), `.${path.basename(destination)}.aime-${randomUUID()}.tmp`);
  const out = createWriteStream(temp, {flags:'wx'});
  const digest = createHash('sha256');
  let records = 0;
  try {
    for (const full of paths) {
      const entName = path.basename(full);
      const rel = path.relative(root, full).split(path.sep).join('/');
      const data = await readFile(full); files++; bytes += data.byteLength;
      const isMarkdown = /\.md$/i.test(entName);
      const record: CanonicalRecord = {
        schemaVersion:'1.0', id:sha256(Buffer.from(rel)).slice(0,32), kind:isMarkdown?'document':'file', title:isMarkdown?path.basename(entName,path.extname(entName)):entName,
        body:isMarkdown?{format:'markdown',content:data.toString('utf8'),sha256:sha256(data)}:{format:'binary',mediaType:guessMime(entName),sha256:sha256(data),content:data.toString('base64')},
        relationships:[], attachments:[], metadata:{relativePath:rel,size:data.byteLength},
        source:{system:'filesystem-markdown',nativeId:rel,updatedAt:(await stat(full)).mtime.toISOString()}
      };
      validateCanonicalRecord(record);
      const line=Buffer.from(JSON.stringify(record)+'\n'); digest.update(line); records++;
      if (!out.write(line)) await new Promise<void>(resolve=>out.once('drain',resolve));
    }
    await new Promise<void>((resolve,reject)=>{out.once('error',reject);out.end(resolve);});
    await rename(temp,destination);
    return {records,files,bytes,manifestSha256:digest.digest('hex')};
  } catch (error) {
    out.destroy(); await rm(temp,{force:true}); throw error;
  }
}

/** Import canonical JSONL into a directory. Paths are confined to the destination and conflicting files are skipped by default. */
export async function importCanonicalJsonl(inputFile: string, destinationDir: string, options: { overwrite?:boolean } = {}): Promise<ImportSummary> {
  const root = path.resolve(destinationDir); await mkdir(root,{recursive:true});
  const summary:ImportSummary={records:0,written:0,skipped:0,errors:[]};
  const rl=createInterface({input:createReadStream(inputFile),crlfDelay:Infinity}); let line=0;
  for await (const text of rl) {
    line++; if (!text.trim()) continue; summary.records++;
    try {
      const parsed:unknown=JSON.parse(text); validateCanonicalRecord(parsed); const rec=parsed as CanonicalRecord;
      const rel=rec.metadata.relativePath;
      if(typeof rel!=='string'||!rel||path.isAbsolute(rel)||/^[A-Za-z]:/.test(rel)||rel.includes('\\')||rel.split('/').some(p=>p==='..'||p==='.'||p==='')) throw new Error('Unsafe or missing metadata.relativePath');
      const target=path.resolve(root,...rel.split('/'));
      if(target!==root&&!target.startsWith(root+path.sep)) throw new Error('Path escapes destination');
      const data = rec.body?.format==='binary' ? Buffer.from(rec.body.content??'','base64') : Buffer.from(rec.body?.content??'', 'utf8');
      if(rec.body?.sha256 && sha256(data)!==rec.body.sha256) throw new Error('SHA-256 content integrity check failed');
      try { await stat(target); if(!options.overwrite){summary.skipped++;continue;} } catch { /* target absent */ }
      const segments=rel.split('/'); let cursor=root;
      for (const segment of segments.slice(0,-1)) { cursor=path.join(cursor,segment); try { const info=await lstat(cursor); if(info.isSymbolicLink()||!info.isDirectory()) throw new Error('Destination contains a symlink or non-directory path component'); } catch(e) { if((e as NodeJS.ErrnoException).code==='ENOENT') continue; throw e; } }
      await mkdir(path.dirname(target),{recursive:true});
      // Re-check after directory creation to reject pre-existing symlinked parents.
      cursor=root; for (const segment of segments.slice(0,-1)) { cursor=path.join(cursor,segment); const info=await lstat(cursor); if(info.isSymbolicLink()||!info.isDirectory()) throw new Error('Destination contains a symlink or non-directory path component'); }
      // Write to a sibling temporary file and rename atomically to avoid partial file contents.
      const temp=path.join(path.dirname(target),`.${path.basename(target)}.aime-${randomUUID()}.tmp`);
      try { await writeFile(temp,data,{flag:'wx'}); await rename(temp,target); }
      catch(e){await rm(temp,{force:true});throw e;}
      summary.written++;
    } catch(e) { summary.errors.push({line,message:e instanceof Error?e.message:String(e)}); }
  }
  return summary;
}
function guessMime(name:string):string { const ext=path.extname(name).toLowerCase(); return ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.pdf':'application/pdf','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain','.csv':'text/csv','.mp3':'audio/mpeg','.mp4':'video/mp4'} as Record<string,string>)[ext]??'application/octet-stream'; }
