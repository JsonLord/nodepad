import {NextResponse} from "next/server"
import {getLayaConfig} from "../../../../../lib/laya/config"
import {RemoteOpenAILayaProvider} from "../../../../../lib/laya/remote-openai-provider"
export const runtime="nodejs"
export async function GET(){try{const config=getLayaConfig();if(!config)return NextResponse.json({enabled:false,provider:"remote_openai",reachable:false,configuredModel:null,state:"not_configured",minConfidence:.70,minMargin:.15});const health=await new RemoteOpenAILayaProvider(config).health();return NextResponse.json({...health,minConfidence:config.minConfidence,minMargin:config.minMargin})}catch{return NextResponse.json({enabled:false,provider:"remote_openai",reachable:false,configuredModel:null,state:"invalid_configuration",minConfidence:.70,minMargin:.15},{status:503})}}
