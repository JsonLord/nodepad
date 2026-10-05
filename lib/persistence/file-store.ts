import { mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DomainEvent, KnowledgeEdge, KnowledgeNode, Workspace } from "../domain/types"
import type { NodepadStore } from "./store"

const now = () => new Date().toISOString()
export function emptyWorkspace(id: string, name = id): Workspace { const at=now(); return { schemaVersion:1,id,name,revision:0,nodes:[],edges:[],evidence:[],hypotheses:[],syntheses:[],researchTasks:[],researchResults:[],events:[],brain:{promotedIds:[],changelog:[]},createdAt:at,updatedAt:at } }

export class FileNodepadStore implements NodepadStore {
  constructor(public root = process.env.NODEPAD_DATA_DIR || path.join(process.cwd(), "data")) {}
  private file(id:string) { if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid workspace id"); return path.join(this.root, `${id}.json`) }
  async getWorkspace(id:string) { try { return JSON.parse(await readFile(this.file(id),"utf8")) as Workspace } catch(e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyWorkspace(id); throw e } }
  async listWorkspaces() { await mkdir(this.root,{recursive:true}); const files=(await readdir(this.root)).filter(x=>x.endsWith(".json")&&!x.endsWith(".lease.json")); return Promise.all(files.map(x=>this.getWorkspace(x.slice(0,-5)))) }
  async saveWorkspace(w:Workspace) { await mkdir(this.root,{recursive:true}); const current=await this.getWorkspace(w.id); const next={...w,revision:Math.max(w.revision,current.revision)+1,updatedAt:now()}; const tmp=this.file(w.id)+`.${process.pid}.tmp`; await writeFile(tmp,JSON.stringify(next,null,2),{mode:0o600}); await rename(tmp,this.file(w.id)); Object.assign(w,next) }
  async listNodes(id:string,filter?:{kind?:string}) { const n=(await this.getWorkspace(id)).nodes; return filter?.kind?n.filter(x=>x.kind===filter.kind):n }
  async upsertNode(n:KnowledgeNode) { const w=await this.getWorkspace(n.workspaceId); const i=w.nodes.findIndex(x=>x.id===n.id); i<0?w.nodes.push(n):w.nodes.splice(i,1,n); await this.saveWorkspace(w) }
  async upsertEdge(e:KnowledgeEdge) { const w=await this.getWorkspace(e.workspaceId); const i=w.edges.findIndex(x=>x.id===e.id); i<0?w.edges.push(e):w.edges.splice(i,1,e); await this.saveWorkspace(w) }
  async appendEvent(e:DomainEvent) { const w=await this.getWorkspace(e.workspaceId); if(!w.events.some(x=>x.id===e.id))w.events.push(e); await this.saveWorkspace(w) }
  async acquireLease(id:string,owner:string,ttlMs:number):Promise<boolean> { await mkdir(this.root,{recursive:true}); const f=path.join(this.root,`${id}.lease`); try { const h=await open(f,"wx",0o600); await h.writeFile(JSON.stringify({owner,expires:Date.now()+ttlMs})); await h.close(); return true } catch(e) { if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e; try { const lease=JSON.parse(await readFile(f,"utf8")); if(lease.expires>Date.now())return false; await rm(f); return this.acquireLease(id,owner,ttlMs) } catch{return false} } }
  async releaseLease(id:string,owner:string) { const f=path.join(this.root,`${id}.lease`); try { const lease=JSON.parse(await readFile(f,"utf8")); if(lease.owner===owner)await rm(f) } catch {} }
}
