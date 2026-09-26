import {NextRequest,NextResponse} from "next/server"
import {isHubAuthenticated} from "../../../../../../lib/server/auth"
import {getDatabase} from "../../../../../../lib/server/database"
import {hubError,validateMutationOrigin} from "../../../../../../lib/server/http"
import {getAgTxAdapter} from "../../../../../../lib/agtx/runtime"
import {AgTxDelegationDispatcher} from "../../../../../../lib/agtx/dispatcher"
import {agtxHttpError} from "../../../../../../lib/server/agtx-http"
export const runtime="nodejs"
export async function POST(r:NextRequest,{params}:{params:Promise<{id:string}>}){if(!isHubAuthenticated(r))return hubError("AUTH_REQUIRED","Authentication required",401);const origin=validateMutationOrigin(r);if(origin)return origin;try{return NextResponse.json(await new AgTxDelegationDispatcher(getDatabase(),await getAgTxAdapter()).authorizeAndDispatch((await params).id,"user"))}catch(e){return agtxHttpError(e)}}
