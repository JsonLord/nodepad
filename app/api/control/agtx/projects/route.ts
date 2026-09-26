import {NextRequest,NextResponse} from "next/server"
import {isHubAuthenticated} from "../../../../../lib/server/auth"
import {getAgTxAdapter} from "../../../../../lib/agtx/runtime"
import {hubError,readLimitedJson,validateMutationOrigin} from "../../../../../lib/server/http"
import {getDatabase} from "../../../../../lib/server/database"
import {ControlPlaneRepository} from "../../../../../lib/server/control-plane-repository"
import type {AgTxProjectMapping} from "../../../../../lib/control-plane/types"
import {agtxHttpError} from "../../../../../lib/server/agtx-http"
export const runtime="nodejs"
export async function GET(r:NextRequest){if(!isHubAuthenticated(r))return hubError("AUTH_REQUIRED","Authentication required",401);try{const state=new ControlPlaneRepository(getDatabase()).load(),projects=await(await getAgTxAdapter()).listProjects();return NextResponse.json({projects:projects.map(p=>({id:p.id,name:p.name,repositoryPath:p.repositoryPath,configured:p.configured,mappedNodepadProjectIds:(state.agtxMappings??[]).filter(m=>m.agtxProjectId===p.id).map(m=>m.nodepadProjectEntityId)})),mappings:state.agtxMappings??[]})}catch(e){return agtxHttpError(e)}}
export async function POST(r:NextRequest){if(!isHubAuthenticated(r))return hubError("AUTH_REQUIRED","Authentication required",401);const origin=validateMutationOrigin(r);if(origin)return origin;try{const input=await readLimitedJson(r) as Partial<AgTxProjectMapping>,repo=new ControlPlaneRepository(getDatabase()),state=repo.load(),now=Date.now(),mapping:AgTxProjectMapping={id:input.id??crypto.randomUUID(),nodepadProjectEntityId:String(input.nodepadProjectEntityId??""),agentProfileId:String(input.agentProfileId??""),agtxProjectId:String(input.agtxProjectId??""),repositoryPath:String(input.repositoryPath??""),enabled:input.enabled!==false,createdAt:input.createdAt??now,updatedAt:now};return NextResponse.json(repo.save({...state,agtxMappings:[...(state.agtxMappings??[]).filter(m=>m.id!==mapping.id&&!(m.nodepadProjectEntityId===mapping.nodepadProjectEntityId&&m.agentProfileId===mapping.agentProfileId)),mapping]},state.revision))}catch(e){return agtxHttpError(e)}}
