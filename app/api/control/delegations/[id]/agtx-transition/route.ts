import {NextRequest,NextResponse} from "next/server"
import {isHubAuthenticated} from "../../../../../../lib/server/auth"
import {getDatabase} from "../../../../../../lib/server/database"
import {hubError,readLimitedJson,validateMutationOrigin} from "../../../../../../lib/server/http"
import {getAgTxAdapter} from "../../../../../../lib/agtx/runtime"
import {AgTxDelegationDispatcher} from "../../../../../../lib/agtx/dispatcher"
import {agtxHttpError} from "../../../../../../lib/server/agtx-http"
export const runtime="nodejs"
export async function POST(r:NextRequest,{params}:{params:Promise<{id:string}>}){if(!isHubAuthenticated(r))return hubError("AUTH_REQUIRED","Authentication required",401);const origin=validateMutationOrigin(r);if(origin)return origin;try{const body=await readLimitedJson(r) as {action?:unknown};if(typeof body.action!=="string"||body.action.length>80)return hubError("INVALID_PAYLOAD","Invalid AGTX action",400);return NextResponse.json(await new AgTxDelegationDispatcher(getDatabase(),await getAgTxAdapter()).transition((await params).id,body.action))}catch(e){return agtxHttpError(e)}}
