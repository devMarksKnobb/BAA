/** Platform-neutral adapter contracts. Capabilities are declared, not assumed. */
export type Capability = 'pages'|'databases'|'files'|'metadata'|'relationships'|'permissions'|'comments'|'history';
export interface SystemDescriptor { id:string; name:string; version?:string; capabilities:Capability[]; }
export interface MigrationIssue { code:string; severity:'info'|'warning'|'blocking'; message:string; item?:string; }
export interface MigrationPlan { id:string; source:SystemDescriptor; destination:SystemDescriptor; createdAt:string; items:{kind:string;count:number;preservable:boolean}[]; issues:MigrationIssue[]; destructive:false; }
export interface AdapterContext { signal?:AbortSignal; checkpoint?:(value:unknown)=>Promise<void>; }
export interface SourceAdapter<T=unknown> { descriptor:SystemDescriptor; inspect(input:T, context?:AdapterContext):Promise<{items:{kind:string;count:number}[];issues:MigrationIssue[]}>; }
export interface DestinationAdapter<T=unknown> { descriptor:SystemDescriptor; validate(target:T, context?:AdapterContext):Promise<{issues:MigrationIssue[]}>; }
export interface MigrationAdapter<I=unknown,O=unknown> { id:string; source:SourceAdapter<I>; destination:DestinationAdapter<O>; plan(input:I,target:O):Promise<MigrationPlan>; execute(input:I,target:O,context?:AdapterContext):Promise<{written:number;verified:boolean;report:unknown}>; }
const registry = new Map<string, MigrationAdapter<any,any>>();
export function registerAdapter(adapter:MigrationAdapter<any,any>):void { if(registry.has(adapter.id)) throw new Error(`Adapter already registered: ${adapter.id}`); registry.set(adapter.id,adapter); }
export function getAdapter(id:string):MigrationAdapter<any,any> { const value=registry.get(id); if(!value) throw new Error(`Unknown adapter: ${id}`); return value; }
export function listAdapters():Array<{id:string;source:SystemDescriptor;destination:SystemDescriptor}> { return [...registry.values()].map(a=>({id:a.id,source:a.source.descriptor,destination:a.destination.descriptor})); }
