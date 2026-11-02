import { createHash } from 'node:crypto';
import type { CanonicalRecord } from '../core/canonical.js';
export type SyncSide='source'|'destination';
export interface SyncSnapshot { sourceHash:string; destinationHash:string; sourceUpdatedAt?:string; destinationUpdatedAt?:string; }
export interface SyncDecision { action:'noop'|'source-to-destination'|'destination-to-source'|'conflict'; reason:string; }
export const contentHash=(record:CanonicalRecord)=>createHash('sha256').update(JSON.stringify({kind:record.kind,title:record.title,body:record.body,parentId:record.parentId,relationships:record.relationships,attachments:record.attachments,permissions:record.permissions,metadata:record.metadata})).digest('hex');
/** Conservative three-way sync decision. Missing baseline plus divergent sides is a conflict, never silent overwrite. */
export function decideSync(snapshot:SyncSnapshot,baseline?:{sourceHash:string;destinationHash:string}):SyncDecision{
 const sChanged=baseline?snapshot.sourceHash!==baseline.sourceHash:true;const dChanged=baseline?snapshot.destinationHash!==baseline.destinationHash:true;
 if(snapshot.sourceHash===snapshot.destinationHash)return{action:'noop',reason:'Both sides have identical content hashes'};
 if(!baseline)return{action:'conflict',reason:'No common baseline exists; automatic direction is unsafe'};
 if(sChanged&&dChanged)return{action:'conflict',reason:'Both sides changed since the last successful sync'};
 if(sChanged)return{action:'source-to-destination',reason:'Only the source changed since the common baseline'};
 if(dChanged)return{action:'destination-to-source',reason:'Only the destination changed since the common baseline'};
 return{action:'conflict',reason:'Hashes differ but neither side is classified as changed; baseline needs reconciliation'};
}
export interface SyncAdapter {read(id:string):Promise<CanonicalRecord|undefined>;write(record:CanonicalRecord,expectedCurrentHash?:string):Promise<void>;}
export async function synchronizeRecord(id:string,source:SyncAdapter,destination:SyncAdapter,baseline?:{sourceHash:string;destinationHash:string}):Promise<SyncDecision>{const [s,d]=await Promise.all([source.read(id),destination.read(id)]);if(!s&&!d)return{action:'noop',reason:'Record absent on both sides'};if(!s||!d)return{action:'conflict',reason:'Record exists on only one side; deletion/creation policy must be explicit'};const sh=contentHash(s),dh=contentHash(d);const decision=decideSync({sourceHash:sh,destinationHash:dh},baseline);if(decision.action==='source-to-destination')await destination.write(s,dh);else if(decision.action==='destination-to-source')await source.write(d,sh);return decision;}
