import {NextRequest,NextResponse} from "next/server"
import {isHubAuthenticated} from "../../../../lib/server/auth"
import {getDatabase} from "../../../../lib/server/database"
import {ControlPlaneRepository} from "../../../../lib/server/control-plane-repository"
import {WorkspaceRepository} from "../../../../lib/server/workspace-repository"
import {RoutingDecisionRepository} from "../../../../lib/server/routing-decision-repository"
import {defaultLayaPolicyConfig,getLayaConfig} from "../../../../lib/laya/config"
import {RemoteOpenAILayaProvider} from "../../../../lib/laya/remote-openai-provider"
import {LayaRoutingService} from "../../../../lib/laya/decision-service"
import type {RoutingContext} from "../../../../lib/control-plane/types"
import {hubError,readLimitedJson,validateMutationOrigin} from "../../../../lib/server/http"
export const runtime="nodejs"
const valid=(v:unknown):v is RoutingContext=>!!v&&typeof v==="object"&&!Array.isArray(v)
export async function POST(r:NextRequest){if(!isHubAuthenticated(r))return hubError("AUTH_REQUIRED","Authentication required",401);const origin=validateMutationOrigin(r);if(origin)return origin;try{const input=await readLimitedJson(r);if(!valid(input))return hubError("INVALID_PAYLOAD","Invalid routing context",400);const db=getDatabase(),control=new ControlPlaneRepository(db).load(),entities=(new WorkspaceRepository(db).loadState()?.workspaces??[]).flatMap(w=>w.entities),task=input.taskEntityId?entities.find(e=>e.id===input.taskEntityId&&e.type==="task"):undefined,project=input.projectEntityId?entities.find(e=>e.id===input.projectEntityId&&e.type==="project"):undefined,entity=task??project,context:RoutingContext={...input,title:entity?.title,entityType:entity?.type,workType:input.workType??entity?.type};if(input.taskEntityId&&!task)return hubError("INVALID_PAYLOAD","Task does not exist",400);if(input.projectEntityId&&!project)return hubError("INVALID_PAYLOAD","Project does not exist",400);let configured:ReturnType<typeof getLayaConfig>=null;try{configured=getLayaConfig()}catch{/* Invalid provider configuration becomes an audited unavailable decision. */}const config=configured??defaultLayaPolicyConfig(),provider=configured?new RemoteOpenAILayaProvider(configured):null;return NextResponse.json(await new LayaRoutingService(provider,config,new RoutingDecisionRepository(db)).route(control,context))}catch{return hubError("INTERNAL_ERROR","Routing decision failed",500)}}
