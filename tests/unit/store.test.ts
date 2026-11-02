import {describe,it,expect} from "vitest";
import {mkdtemp,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {MigrationStore} from "../../src/state/store.js";
describe("durable migration store",()=>{
 it("persists jobs, checkpoints and audit events",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"aime-state-"));const file=path.join(dir,"state.sqlite");
  const store=new MigrationStore(file);
  try {store.create({id:"job-1",source:"fixture",destination:"vault"});store.checkpoint("job-1","normalized",{nodes:3},"abc");
   expect(store.get("job-1")?.checkpoint).toBe("normalized");
   expect(store.getCheckpoint("job-1","normalized")?.value).toEqual({nodes:3});
   expect(store.events("job-1").map(e=>e.event)).toContain("checkpoint.saved");
   store.finish("job-1","completed");
  } finally {store.close();}
  const reopened=new MigrationStore(file);try{expect(reopened.get("job-1")?.status).toBe("completed");}finally{reopened.close();await rm(dir,{recursive:true,force:true});}
 });
});
