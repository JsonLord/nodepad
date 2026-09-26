import type {AgentAdapterType} from "../control-plane/types"
import type {ExecutableAdapterType,ExecutionAdapter} from "./types"

export class ExecutionAdapterError extends Error {constructor(public code:string,message=code){super(message)}}
export class ExecutionAdapterRegistry {
  private adapters=new Map<ExecutableAdapterType,ExecutionAdapter>()
  constructor(private enabled=new Set<ExecutableAdapterType>(["agtx","http","local_cli"])){}
  register(adapter:ExecutionAdapter){this.adapters.set(adapter.adapterType,adapter);return this}
  get(type:AgentAdapterType):ExecutionAdapter {
    if(!this.enabled.has(type as ExecutableAdapterType))throw new ExecutionAdapterError("EXECUTION_ADAPTER_NOT_ENABLED")
    const adapter=this.adapters.get(type as ExecutableAdapterType)
    if(!adapter)throw new ExecutionAdapterError("EXECUTION_ADAPTER_NOT_ENABLED")
    return adapter
  }
}
