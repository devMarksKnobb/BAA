import {describe,it,expect} from "vitest";
import {validateCanonicalRecord,type CanonicalRecord} from "../../src/core/canonical.js";
const record:CanonicalRecord={schemaVersion:"1.0",id:"doc-1",kind:"document",relationships:[],attachments:[],metadata:{},source:{system:"fixture",nativeId:"42"}};
describe("canonical record",()=>{it("accepts valid versioned records",()=>expect(()=>validateCanonicalRecord(record)).not.toThrow());it("rejects unsupported versions",()=>expect(()=>validateCanonicalRecord({...record,schemaVersion:"9.0"})).toThrow("Unsupported"));});
