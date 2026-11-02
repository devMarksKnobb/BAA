import { NotionClient } from '../connectors/notion.js';
import { GoogleDriveConnector } from '../connectors/google-drive.js';
import type { ProviderConnections } from './connections.js';
/** Construct clients whose access tokens are fetched/refreshed in the tenant scope at request time. */
export function notionClientForConnection(connections:ProviderConnections,tenantId:string,connectionId:string,fetcher:typeof fetch=fetch){return new NotionClient('connection-managed-token','2022-06-28',async(input,init)=>{const token=await connections.accessToken(tenantId,connectionId,fetcher);return fetcher(input,{...init,headers:{...(init?.headers as Record<string,string>|undefined),Authorization:`Bearer ${token}`}});});}
export function googleDriveForConnection(connections:ProviderConnections,tenantId:string,connectionId:string,fetcher:typeof fetch=fetch){return new GoogleDriveConnector(()=>connections.accessToken(tenantId,connectionId,fetcher),fetcher);}
