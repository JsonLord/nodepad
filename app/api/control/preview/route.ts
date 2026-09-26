import { NextRequest,NextResponse } from "next/server"
import { isHubAuthenticated } from "../../../../lib/server/auth"
import { getDatabase } from "../../../../lib/server/database"
import { ControlPlaneRepository } from "../../../../lib/server/control-plane-repository"
import { evaluateRoutingPolicy } from "../../../../lib/control-plane/routing"
import type { RoutingContext } from "../../../../lib/control-plane/types"
import { hubError,readLimitedJson } from "../../../../lib/server/http"
export const runtime="nodejs"
export async function POST(r:NextRequest){if(!isHubAuthenticated(r))return hubError("AUTH_REQUIRED","Authentication required",401);try{return NextResponse.json(evaluateRoutingPolicy(new ControlPlaneRepository(getDatabase()).load(),await readLimitedJson(r) as RoutingContext))}catch{return hubError("INVALID_PAYLOAD","Invalid routing context",400)}}
