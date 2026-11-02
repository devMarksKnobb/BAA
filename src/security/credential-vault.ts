import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/** Tenant-scoped AES-256-GCM credential storage. Supply a 32-byte master key via AIME_MASTER_KEY (hex/base64). */
export class CredentialVault {
  private db: DatabaseSync; private key: Buffer;
  constructor(filename = process.env.AIME_CREDENTIAL_DB ?? '.aime/credentials.sqlite', masterKey = process.env.AIME_MASTER_KEY) {
    if (!masterKey) throw new Error('AIME_MASTER_KEY is required; credentials will not be stored unencrypted');
    this.key = /^[a-f\d]{64}$/i.test(masterKey) ? Buffer.from(masterKey,'hex') : Buffer.from(masterKey,'base64');
    if (this.key.length !== 32) throw new Error('AIME_MASTER_KEY must decode to exactly 32 bytes');
    if(filename !== ':memory:') mkdirSync(path.dirname(path.resolve(filename)),{recursive:true,mode:0o700});
    this.db=new DatabaseSync(filename); this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS credentials(tenant_id TEXT NOT NULL, provider TEXT NOT NULL, credential_id TEXT NOT NULL, iv TEXT NOT NULL, tag TEXT NOT NULL, ciphertext TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(tenant_id,provider,credential_id));
      CREATE TABLE IF NOT EXISTS credential_audit(id INTEGER PRIMARY KEY,tenant_id TEXT NOT NULL,provider TEXT NOT NULL,action TEXT NOT NULL,at TEXT NOT NULL);`);
  }
  put(tenantId:string,provider:string,credentialId:string,secret:unknown):void {
    this.validateScope(tenantId,provider,credentialId); const serialized=JSON.stringify(secret); if(serialized===undefined)throw new Error('Credential must be JSON-serializable'); if(Buffer.byteLength(serialized)>1024*1024)throw new Error('Credential exceeds 1 MiB storage limit'); const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',this.key,iv);
    cipher.setAAD(Buffer.from(`${tenantId}\0${provider}\0${credentialId}`)); const ciphertext=Buffer.concat([cipher.update(serialized,'utf8'),cipher.final()]);
    this.db.prepare(`INSERT INTO credentials VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant_id,provider,credential_id) DO UPDATE SET iv=excluded.iv,tag=excluded.tag,ciphertext=excluded.ciphertext,updated_at=excluded.updated_at`).run(tenantId,provider,credentialId,iv.toString('base64'),cipher.getAuthTag().toString('base64'),ciphertext.toString('base64'),new Date().toISOString());
    this.audit(tenantId,provider,'put');
  }
  get<T=unknown>(tenantId:string,provider:string,credentialId:string):T|undefined {
    this.validateScope(tenantId,provider,credentialId); const r=this.db.prepare('SELECT iv,tag,ciphertext FROM credentials WHERE tenant_id=? AND provider=? AND credential_id=?').get(tenantId,provider,credentialId) as any;
    if(!r){this.audit(tenantId,provider,'miss');return undefined;} const decipher=createDecipheriv('aes-256-gcm',this.key,Buffer.from(r.iv,'base64')); decipher.setAAD(Buffer.from(`${tenantId}\0${provider}\0${credentialId}`)); decipher.setAuthTag(Buffer.from(r.tag,'base64'));
    const plaintext=Buffer.concat([decipher.update(Buffer.from(r.ciphertext,'base64')),decipher.final()]).toString('utf8'); this.audit(tenantId,provider,'get'); return JSON.parse(plaintext) as T;
  }
  delete(tenantId:string,provider:string,credentialId:string):void { this.validateScope(tenantId,provider,credentialId); this.db.prepare('DELETE FROM credentials WHERE tenant_id=? AND provider=? AND credential_id=?').run(tenantId,provider,credentialId); this.audit(tenantId,provider,'delete'); }
  list(tenantId:string):Array<{provider:string;credentialId:string;updatedAt:string}> { if(!tenantId.trim())throw new Error('tenantId is required'); return this.db.prepare('SELECT provider,credential_id AS credentialId,updated_at AS updatedAt FROM credentials WHERE tenant_id=? ORDER BY provider,credential_id').all(tenantId) as any; }
  close():void { this.db.close(); this.key.fill(0); }
  private validateScope(...values:string[]){if(values.some(v=>typeof v!=='string'||!v.trim()||v.length>256))throw new Error('Invalid credential scope');}
  private audit(t:string,p:string,a:string){this.db.prepare('INSERT INTO credential_audit(tenant_id,provider,action,at) VALUES(?,?,?,?)').run(t,p,a,new Date().toISOString());}
}
export function masterKeyFingerprint(key:string):string { return createHash('sha256').update(key).digest('hex').slice(0,12); }
