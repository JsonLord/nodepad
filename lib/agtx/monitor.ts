import type {DatabaseSync} from "node:sqlite"
import type {AgTxExecutionAdapter} from "./types"
import {AgTxDelegationDispatcher} from "./dispatcher"
import {AgTxExecutionRepository} from "../server/agtx-execution-repository"
import {ControlPlaneRepository} from "../server/control-plane-repository"
import {invalidateAgTxAdapter} from "./runtime"
export class AgTxMonitor {private running=false;constructor(private db:DatabaseSync,private adapter:AgTxExecutionAdapter,private waitMs=10000){}start(){if(this.running)return;this.running=true;void this.loop()}stop(){this.running=false}async reconcileActive(){const dispatch=new AgTxDelegationDispatcher(this.db,this.adapter),active=new ControlPlaneRepository(this.db).load().delegations.filter(d=>d.externalProvider==="agtx"&&d.externalRunId&&!['succeeded','failed','cancelled'].includes(d.status));for(const d of active){await dispatch.reconcile(d.id);new AgTxExecutionRepository(this.db).recordEvent(d.id,"reconciled_after_restart",d.lastExternalStatus,"Reconciled from AGTX after Hub start",`restart:${d.externalRunId}`)}}private async loop(){await this.reconcileActive().catch(()=>{});while(this.running){try{const change=await this.adapter.waitForChange(this.waitMs),ids=new Set(change.changedTaskIds),dispatch=new AgTxDelegationDispatcher(this.db,this.adapter),active=new ControlPlaneRepository(this.db).load().delegations.filter(d=>d.externalProvider==="agtx"&&d.externalRunId&&(!ids.size||ids.has(d.externalRunId)));for(const d of active)await dispatch.reconcile(d.id)}catch{this.running=false;invalidateAgTxAdapter();monitor=undefined}}}}
let monitor:AgTxMonitor|undefined
export function ensureAgTxMonitor(db:DatabaseSync,adapter:AgTxExecutionAdapter){monitor??=new AgTxMonitor(db,adapter);monitor.start();return monitor}
export function resetAgTxMonitorForTests(){monitor?.stop();monitor=undefined}
