import { describe,it,expect,vi } from "vitest";
import { withRetry } from "../../src/core/retry.js";
describe("withRetry",()=>{
 it("retries transient failures and returns the successful result",async()=>{
  let n=0; const result=await withRetry(async()=>{if(++n<3)throw Error("temporary");return "ok";},{attempts:3,baseDelayMs:0});
  expect(result).toBe("ok");expect(n).toBe(3);
 });
 it("does not retry when policy rejects an error",async()=>{
  let n=0; await expect(withRetry(async()=>{n++;throw Error("fatal");},{attempts:4,baseDelayMs:0,shouldRetry:()=>false})).rejects.toThrow("fatal");expect(n).toBe(1);
 });
});
