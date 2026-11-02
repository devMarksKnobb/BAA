import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export interface OAuthConfig { authorizationEndpoint:string; tokenEndpoint:string; clientId:string; clientSecret?:string; redirectUri:string; scopes:string[]; usePkce?:boolean; }
export interface OAuthAttempt { url:string; state:string; codeVerifier:string; createdAt:number; }
const b64url=(b:Buffer)=>b.toString('base64url');
/** Authorization Code + PKCE S256. Persist attempt server-side and bind it to tenant/session. */
export function beginOAuth(config:OAuthConfig, extra:Record<string,string>={}):OAuthAttempt {
  const auth=new URL(config.authorizationEndpoint); const state=b64url(randomBytes(32)); const codeVerifier=b64url(randomBytes(48));
  auth.searchParams.set('response_type','code');auth.searchParams.set('client_id',config.clientId);auth.searchParams.set('redirect_uri',config.redirectUri);auth.searchParams.set('scope',config.scopes.join(' '));auth.searchParams.set('state',state);if(config.usePkce!==false){auth.searchParams.set('code_challenge',b64url(createHash('sha256').update(codeVerifier).digest()));auth.searchParams.set('code_challenge_method','S256');}
  for(const [k,v] of Object.entries(extra)){if(['state','redirect_uri','client_id','response_type','code_challenge','code_challenge_method'].includes(k))continue;auth.searchParams.set(k,v);}
  return {url:auth.toString(),state,codeVerifier,createdAt:Date.now()};
}
export function validateOAuthCallback(attempt:OAuthAttempt,receivedState:string,now=Date.now(),maxAgeMs=10*60_000):void {
  if(!attempt||!receivedState||now-attempt.createdAt<0||now-attempt.createdAt>maxAgeMs)throw new Error('OAuth attempt expired or invalid');
  const a=Buffer.from(attempt.state);const b=Buffer.from(receivedState);if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error('OAuth state mismatch');
}
export async function exchangeOAuthCode(config:OAuthConfig,code:string,attempt:OAuthAttempt,fetcher:typeof fetch=fetch):Promise<Record<string,unknown>> {
  if(!code||code.length>4096)throw new Error('Invalid authorization code'); const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:config.redirectUri,client_id:config.clientId,...(config.usePkce===false?{}:{code_verifier:attempt.codeVerifier})});
  const headers:Record<string,string>={'content-type':'application/x-www-form-urlencoded','accept':'application/json'};if(config.clientSecret)headers.authorization='Basic '+Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const response=await fetcher(config.tokenEndpoint,{method:'POST',headers,body,signal:AbortSignal.timeout(15_000)}); if(!response.ok)throw new Error(`OAuth token endpoint returned HTTP ${response.status}`);
  const result=await response.json() as Record<string,unknown>;if(typeof result.access_token!=='string')throw new Error('OAuth response did not contain an access token');return result;
}
