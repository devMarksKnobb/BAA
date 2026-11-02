import { createHash } from 'node:crypto';
import type { CanonicalRecord } from '../core/canonical.js';
import { contentHash, decideSync, type SyncDecision } from './engine.js';
import type { PostgresSyncStore } from './postgres-baseline.js';
export type ConflictPolicy='manual'|'source-wins'|'destination-wins'|'last-write-wins';
export type DeletionPolicy='never'|'source-authoritative'|'destination-authoritative'|'delete-if-both-deleted';
export interface VersionedRecord {record:CanonicalRecord;version?:string;updatedAt?:string}
export interface VersionedSyncAdapter {read(id:string):Promise<VersionedRecord|undefined>;write(id:string,record:CanonicalRecord,expectedVersion?:string,idempotencyKey?:string):Promise<void>;delete?(id:string,expectedVersion?:string,idempotencyKey?:string):Promise<void>}
export interface CoordinatorOptions {tenantId:string;syncId:string;recordId:string;conflictPolicy?:ConflictPolicy;deletionPolicy?:DeletionPolicy}
export interface CoordinatorResult extends SyncDecision {sourceHash?:string;destinationHash?:string;baselineCommitted?:boolean}
const key=(...parts:string[])=>createHash('sha256').update(parts.join('\0')).digest('hex');
/** Durable two-way coordinator. Adapters MUST perform native conditional writes where the provider supports them. */
export async function syncWithBaseline(source:VersionedSyncAdapter,destination:VersionedSyncAdapter,store:PostgresSyncStore,options:CoordinatorOptions):Promise<CoordinatorResult>{
 const policy=options.conflictPolicy??'manual',deletion=options.deletionPolicy??'never';const [s,d]=await Promise.all([source.read(options.recordId),destination.read(options.recordId)]);const baseline=await store.get(options.tenantId,options.syncId,options.recordId);
 const persist=async(ss:VersionedRecord|undefined,dd:VersionedRecord|undefined)=>{if(!ss||!dd)return false;await store.commit({tenantId:options.tenantId,syncId:options.syncId,recordId:options.recordId,sourceHash:contentHash(ss.record),destinationHash:contentHash(dd.record),sourceVersion:ss.version,destinationVersion:dd.version,sourceDeleted:false,destinationDeleted:false});return true;};
 if(!s||!d){
  if(!s&&!d){if(baseline)await store.commit({tenantId:options.tenantId,syncId:options.syncId,recordId:options.recordId,sourceHash:baseline.sourceHash,destinationHash:baseline.destinationHash,sourceVersion:baseline.sourceVersion,destinationVersion:baseline.destinationVersion,sourceDeleted:true,destinationDeleted:true});return{action:'noop',reason:'Both sides are absent',baselineCommitted:!!baseline};}
  if(deletion==='never'||deletion==='delete-if-both-deleted')return{action:'conflict',reason:'One side is missing; configured deletion policy forbids unilateral propagation'};
  const sourceWins=deletion==='source-authoritative';const missingSource=!s;const propagateDelete=(sourceWins&&missingSource)||(!sourceWins&&!missingSource);const target=propagateDelete?(missingSource?destination:source):(missingSource?source:destination);const targetVersion=missingSource?d?.version:s?.version;const intent=key(options.tenantId,options.syncId,options.recordId,propagateDelete?'delete':'restore',s?contentHash(s.record):'deleted',d?contentHash(d.record):'deleted');
  await store.prepareWrite({tenantId:options.tenantId,syncId:options.syncId,recordId:options.recordId,idempotencyKey:intent,sourcePayload:s??{deleted:true},destinationPayload:d??{deleted:true},expectedSourceVersion:s?.version,expectedDestinationVersion:d?.version});
  try{if(propagateDelete){if(!target.delete)throw new Error('Adapter does not implement deletion');await target.delete(options.recordId,targetVersion,intent);}else{const existing=s??d!;await target.write(options.recordId,existing.record,targetVersion,intent);}await store.markWrite(options.tenantId,intent,'applied');}catch(e){await store.markWrite(options.tenantId,intent,'failed',e);throw e;}
  const [sn,dn]=await Promise.all([source.read(options.recordId),destination.read(options.recordId)]);if(sn&&dn){await persist(sn,dn);return{action:missingSource?'source-to-destination':'destination-to-source',reason:'Applied explicit deletion policy and verified both sides',sourceHash:contentHash(sn.record),destinationHash:contentHash(dn.record),baselineCommitted:true};}
  if(!sn&&!dn){await store.commit({tenantId:options.tenantId,syncId:options.syncId,recordId:options.recordId,sourceHash:baseline?.sourceHash??'deleted',destinationHash:baseline?.destinationHash??'deleted',sourceVersion:undefined,destinationVersion:undefined,sourceDeleted:true,destinationDeleted:true});return{action:'noop',reason:'Deletion verified on both sides',baselineCommitted:true};}
  return{action:'conflict',reason:'Write applied but post-write verification found only one side; recovery required',baselineCommitted:false};
 }
 const sh=contentHash(s.record),dh=contentHash(d.record);let decision=decideSync({sourceHash:sh,destinationHash:dh,sourceUpdatedAt:s.updatedAt,destinationUpdatedAt:d.updatedAt},baseline?{sourceHash:baseline.sourceHash,destinationHash:baseline.destinationHash}:undefined);
 if(decision.action==='conflict'&&sh!==dh&&policy!=='manual'){
  if(policy==='last-write-wins'&&(!s.updatedAt||!d.updatedAt||!Number.isFinite(Date.parse(s.updatedAt))||!Number.isFinite(Date.parse(d.updatedAt))))return{...decision,reason:'Last-write-wins requires valid timestamps from both providers',sourceHash:sh,destinationHash:dh,baselineCommitted:false};
  const winner=policy==='source-wins'?s:policy==='destination-wins'?d:(Date.parse(s.updatedAt!)>=Date.parse(d.updatedAt!)?s:d);decision={action:winner===s?'source-to-destination':'destination-to-source',reason:`Conflict resolved by ${policy} policy`};
 }
 if(decision.action==='noop'){await persist(s,d);return{...decision,sourceHash:sh,destinationHash:dh,baselineCommitted:true};}
 if(decision.action==='conflict')return{...decision,sourceHash:sh,destinationHash:dh,baselineCommitted:false};
 const toDestination=decision.action==='source-to-destination';const winner=toDestination?s:d;const expectedVersion=toDestination?d.version:s.version;const intent=key(options.tenantId,options.syncId,options.recordId,decision.action,contentHash(winner.record),String(expectedVersion??''));await store.prepareWrite({tenantId:options.tenantId,syncId:options.syncId,recordId:options.recordId,idempotencyKey:intent,sourcePayload:s.record,destinationPayload:d.record,expectedSourceVersion:s.version,expectedDestinationVersion:d.version});
 try{if(toDestination)await destination.write(options.recordId,winner.record,expectedVersion,intent);else await source.write(options.recordId,winner.record,expectedVersion,intent);await store.markWrite(options.tenantId,intent,'applied');}catch(e){await store.markWrite(options.tenantId,intent,'failed',e);throw e;}
 const [sn,dn]=await Promise.all([source.read(options.recordId),destination.read(options.recordId)]);if(!sn||!dn)return{action:'conflict',reason:'Write applied but post-write verification found a missing record',baselineCommitted:false};await persist(sn,dn);return{...decision,sourceHash:contentHash(sn.record),destinationHash:contentHash(dn.record),baselineCommitted:true};
}
