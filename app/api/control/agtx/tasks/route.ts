import {NextRequest,NextResponse} from "next/server"
import {isHubAuthenticated} from "../../../../../lib/server/auth"
import {hubError} from "../../../../../lib/server/http"
import {getAgTxAdapter} from "../../../../../lib/agtx/runtime"
import {getDatabase} from "../../../../../lib/server/database"
import {ControlPlaneRepository} from "../../../../../lib/server/control-plane-repository"
import {agtxHttpError} from "../../../../../lib/server/agtx-http"
export const runtime="nodejs"
export async function GET(r:NextRequest){if(!isHubAuthenticated(r))return hubError("AUTH_REQUIRED","Authentication required",401);try{const projectId=new URL(r.url).searchParams.get("projectId")??undefined,tasks=await(await getAgTxAdapter()).listTasks(projectId),state=new ControlPlaneRepository(getDatabase()).load();return NextResponse.json({tasks:tasks.map(t=>({...t,outputTail:t.outputTail?.slice(-8000),linkedDelegationId:state.delegations.find(d=>d.externalProvider==="agtx"&&d.externalRunId===t.id)?.id,linkedNodepadTaskId:state.delegations.find(d=>d.externalProvider==="agtx"&&d.externalRunId===t.id)?.taskEntityId}))})}catch(e){return agtxHttpError(e)}}
