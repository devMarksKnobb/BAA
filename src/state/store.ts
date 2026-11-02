import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Durable, local migration journal. SQLite transactions make checkpoint updates atomic. */
export interface MigrationJob {
  id: string; status: "running" | "completed" | "failed" | "paused";
  source: string; destination: string; startedAt: string; updatedAt: string;
  checkpoint: string; processed: number; error?: string;
}
export interface Checkpoint { jobId: string; key: string; value: unknown; contentHash?: string; updatedAt: string; }
export class MigrationStore {
  private db: DatabaseSync;
  constructor(filename = process.env.AIME_STATE_DB ?? ".aime/state.sqlite") {
    if (filename !== ":memory:") { /* mkdir handled synchronously for DatabaseSync */ }
    const fs = requireFs();
    if (filename !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY, status TEXT NOT NULL, source TEXT NOT NULL, destination TEXT NOT NULL,
        started_at TEXT NOT NULL, updated_at TEXT NOT NULL, checkpoint TEXT NOT NULL DEFAULT 'initialized',
        processed INTEGER NOT NULL DEFAULT 0, error TEXT
      );
      CREATE TABLE IF NOT EXISTS checkpoints (
        job_id TEXT NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
        key TEXT NOT NULL, value_json TEXT NOT NULL, content_hash TEXT, updated_at TEXT NOT NULL,
        PRIMARY KEY(job_id,key)
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, event TEXT NOT NULL,
        detail_json TEXT NOT NULL, created_at TEXT NOT NULL
      );
    `);
  }
  create(job: Pick<MigrationJob,"id"|"source"|"destination">): MigrationJob {
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO migrations(id,status,source,destination,started_at,updated_at,checkpoint,processed) VALUES(?,?,?,?,?,?,?,0)")
      .run(job.id,"running",job.source,job.destination,now,now,"initialized");
    this.audit(job.id,"migration.created",job);
    return this.get(job.id)!;
  }
  get(id: string): MigrationJob | undefined {
    const r = this.db.prepare("SELECT id,status,source,destination,started_at AS startedAt,updated_at AS updatedAt,checkpoint,processed,error FROM migrations WHERE id=?").get(id) as MigrationJob | undefined;
    return r;
  }
  list(limit=100): MigrationJob[] {
    return this.db.prepare("SELECT id,status,source,destination,started_at AS startedAt,updated_at AS updatedAt,checkpoint,processed,error FROM migrations ORDER BY updated_at DESC LIMIT ?").all(Math.max(1,Math.min(limit,1000))) as unknown as MigrationJob[];
  }
  checkpoint(jobId:string,key:string,value:unknown,contentHash?:string):void {
    const now=new Date().toISOString();
    const tx=this.db.prepare("INSERT INTO checkpoints(job_id,key,value_json,content_hash,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(job_id,key) DO UPDATE SET value_json=excluded.value_json,content_hash=excluded.content_hash,updated_at=excluded.updated_at");
    const job=this.db.prepare("UPDATE migrations SET checkpoint=?,processed=processed+1,updated_at=? WHERE id=?");
    this.db.exec("BEGIN IMMEDIATE");
    try { tx.run(jobId,key,JSON.stringify(value),contentHash??null,now); job.run(key,now,jobId); this.audit(jobId,"checkpoint.saved",{key,contentHash}); this.db.exec("COMMIT"); }
    catch(e) { this.db.exec("ROLLBACK"); throw e; }
  }
  getCheckpoint(jobId:string,key:string):Checkpoint|undefined {
    const r=this.db.prepare("SELECT job_id AS jobId,key,value_json,content_hash AS contentHash,updated_at AS updatedAt FROM checkpoints WHERE job_id=? AND key=?").get(jobId,key) as any;
    return r ? {jobId:r.jobId,key:r.key,value:JSON.parse(r.value_json),contentHash:r.contentHash??undefined,updatedAt:r.updatedAt}:undefined;
  }
  finish(id:string,status:"completed"|"failed"|"paused",error?:string):void {
    this.db.prepare("UPDATE migrations SET status=?,error=?,updated_at=? WHERE id=?").run(status,error??null,new Date().toISOString(),id);
    this.audit(id,`migration.${status}`,{error});
  }
  audit(jobId:string,event:string,detail:unknown):void {
    this.db.prepare("INSERT INTO audit_events(job_id,event,detail_json,created_at) VALUES(?,?,?,?)").run(jobId,event,JSON.stringify(detail??null),new Date().toISOString());
  }
  events(jobId:string):Array<{event:string;detail:unknown;createdAt:string}> {
    return (this.db.prepare("SELECT event,detail_json,created_at AS createdAt FROM audit_events WHERE job_id=? ORDER BY id").all(jobId) as any[])
      .map(r=>({event:r.event,detail:JSON.parse(r.detail_json),createdAt:r.createdAt}));
  }
  close():void { this.db.close(); }
}
function requireFs(): typeof import("node:fs") {
  // Static import is intentionally avoided for consumers that only use in-memory state.
  return fsModule;
}
import * as fsModule from "node:fs";
