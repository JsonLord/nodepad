import {NextRequest,NextResponse} from "next/server"
import {isHubAuthenticated} from "../../../../../lib/server/auth"
import {hubError} from "../../../../../lib/server/http"
import {binaryAvailable,getAgTxConfig} from "../../../../../lib/agtx/config"
import {getAgTxAdapter} from "../../../../../lib/agtx/runtime"
import {getDatabase} from "../../../../../lib/server/database"
import {ensureAgTxMonitor} from "../../../../../lib/agtx/monitor"
export const runtime="nodejs"
export async function GET(r:NextRequest){if(!isHubAuthenticated(r))return hubError("AUTH_REQUIRED","Authentication required",401);const config=getAgTxConfig(),available=await binaryAvailable(config.binary);if(!available)return NextResponse.json({configured:true,binaryAvailable:false,mcpConnected:false,compatible:false,executionEnabled:config.executionEnabled,projectCount:0,errorCode:"AGTX_BINARY_NOT_FOUND"});try{const adapter=await getAgTxAdapter();ensureAgTxMonitor(getDatabase(),adapter);return NextResponse.json(await adapter.health())}catch{return NextResponse.json({configured:true,binaryAvailable:available,mcpConnected:false,compatible:false,executionEnabled:config.executionEnabled,projectCount:0,errorCode:"AGTX_UNAVAILABLE"})}}
