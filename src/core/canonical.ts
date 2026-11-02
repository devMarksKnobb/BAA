/** Versioned canonical envelope shared by adapters. Unknown source fields are retained in metadata. */
export interface CanonicalRecord {
  schemaVersion: "1.0";
  id: string;
  kind: "document"|"collection"|"record"|"file"|"comment"|"user"|"other";
  title?: string;
  body?: { format:"markdown"|"html"|"plain"|"json"|"binary"; content?:string; mediaType?:string; sha256?:string };
  parentId?: string;
  relationships: Array<{type:string;targetId:string;metadata?:Record<string,unknown>}>;
  attachments: Array<{id:string;name:string;mediaType?:string;size?:number;sha256?:string;sourceUri?:string}>;
  permissions?: Array<{principal:string;role:string}>;
  metadata: Record<string,unknown>;
  source: { system:string; nativeId:string; updatedAt?:string };
}
export function validateCanonicalRecord(value:unknown): asserts value is CanonicalRecord {
  if(!value || typeof value!=="object") throw new Error("Canonical record must be an object");
  const r=value as Partial<CanonicalRecord>;
  if(r.schemaVersion!=="1.0") throw new Error("Unsupported canonical schemaVersion");
  if(typeof r.id!=="string"||!r.id) throw new Error("Canonical record id is required");
  if(!["document","collection","record","file","comment","user","other"].includes(r.kind??"")) throw new Error("Invalid canonical record kind");
  if(!Array.isArray(r.relationships)||!Array.isArray(r.attachments)||!r.metadata||typeof r.metadata!=="object") throw new Error("Canonical relationships, attachments and metadata are required");
  if(!r.source||typeof r.source.system!=="string"||typeof r.source.nativeId!=="string") throw new Error("Canonical source identity is required");
}
