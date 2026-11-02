import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { exportMarkdownToCanonicalJsonl, importCanonicalJsonl } from '../src/adapters/canonical-jsonl.js';

describe('canonical JSONL filesystem adapter',()=>{
  it('round trips Markdown, nested paths, and binary attachments with integrity hashes',async()=>{
    const root=await mkdtemp(path.join(os.tmpdir(),'aime-test-'));
    try {
      const source=path.join(root,'source'), archive=path.join(root,'data.jsonl'), dest=path.join(root,'dest');
      await mkdir(path.join(source,'folder'),{recursive:true});
      await writeFile(path.join(source,'folder','hello.md'),'# Hello\nAIME migration');
      await writeFile(path.join(source,'asset.png'),Buffer.from([0,1,2,255]));
      const exported=await exportMarkdownToCanonicalJsonl(source,archive);
      expect(exported.records).toBe(2);
      const imported=await importCanonicalJsonl(archive,dest);
      expect(imported.written).toBe(2); expect(imported.errors).toHaveLength(0);
      expect(await readFile(path.join(dest,'folder','hello.md'),'utf8')).toBe('# Hello\nAIME migration');
      expect(await readFile(path.join(dest,'asset.png'))).toEqual(Buffer.from([0,1,2,255]));
      const second=await importCanonicalJsonl(archive,dest);
      expect(second.skipped).toBe(2); expect(second.written).toBe(0);
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it('rejects path traversal and corrupted content',async()=>{
    const root=await mkdtemp(path.join(os.tmpdir(),'aime-test-'));
    try {
      const archive=path.join(root,'bad.jsonl');
      const base={schemaVersion:'1.0',kind:'document',body:{format:'markdown',content:'changed',sha256:'0'.repeat(64)},relationships:[],attachments:[],source:{system:'test',nativeId:'x'}};
      await writeFile(archive,[JSON.stringify({...base,id:'traversal',metadata:{relativePath:'../escape.md'}}),JSON.stringify({...base,id:'corrupt',metadata:{relativePath:'safe.md'}})].join('\n')+'\n');
      const result=await importCanonicalJsonl(archive,path.join(root,'dest'));
      expect(result.written).toBe(0); expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toMatch(/Unsafe/); expect(result.errors[1].message).toMatch(/SHA-256/);
    } finally { await rm(root,{recursive:true,force:true}); }
  });
});
