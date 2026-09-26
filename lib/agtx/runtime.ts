import {getAgTxConfig} from "./config"
import {AgTxMcpAdapter} from "./adapter"
import type {AgTxExecutionAdapter} from "./types"
let adapter:Promise<AgTxExecutionAdapter>|undefined,lastFailure=0,failures=0
export async function getAgTxAdapter(){const config=getAgTxConfig();if(adapter)return adapter;const backoff=Math.min(30000,1000*2**failures);if(Date.now()-lastFailure<backoff)throw new Error("AGTX_RESTART_BACKOFF");adapter=AgTxMcpAdapter.connect(config).catch(e=>{adapter=undefined;lastFailure=Date.now();failures++;throw e});try{const ready=await adapter;failures=0;return ready}catch(e){throw e}}
export async function closeAgTxAdapter(){if(adapter)await(await adapter).close();adapter=undefined}
export function invalidateAgTxAdapter(){adapter=undefined;lastFailure=Date.now();failures++}
export function resetAgTxRuntimeForTests(){adapter=undefined;lastFailure=0;failures=0}
export function setAgTxAdapterForTests(value:AgTxExecutionAdapter|undefined){adapter=value?Promise.resolve(value):undefined;lastFailure=0;failures=0}
