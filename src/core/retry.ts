export interface RetryOptions { attempts?:number; baseDelayMs?:number; maxDelayMs?:number; signal?:AbortSignal; shouldRetry?:(error:unknown,attempt:number)=>boolean; onRetry?:(error:unknown,attempt:number,delayMs:number)=>void|Promise<void>; }
export async function withRetry<T>(operation:(attempt:number)=>Promise<T>, options:RetryOptions={}):Promise<T> {
  const attempts=Math.max(1,options.attempts??5), base=Math.max(0,options.baseDelayMs??200), max=Math.max(base,options.maxDelayMs??10_000);
  let last:unknown;
  for(let attempt=1;attempt<=attempts;attempt++){
    if(options.signal?.aborted) throw options.signal.reason??new Error("Operation aborted");
    try{return await operation(attempt);}catch(error){last=error;
      if(attempt===attempts || options.shouldRetry?.(error,attempt)===false) throw error;
      const delay=Math.min(max,base*2**(attempt-1));
      await options.onRetry?.(error,attempt,delay);
      await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,delay); options.signal?.addEventListener("abort",()=>{clearTimeout(timer);reject(options.signal?.reason??new Error("Operation aborted"));},{once:true});});
    }
  }
  throw last;
}
