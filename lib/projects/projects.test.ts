import { describe,it } from "node:test"
import assert from "node:assert/strict"
import type { Workspace } from "../domain/workspace"
import { addDependency, archiveProject, assignTaskToProject, convertEntityToTask, createProject, createSubtask, createTask, removeDependency, setTaskDueDate, setTaskPriority, setTaskStatus } from "./operations"
import { getProjectProgress, getProjects, getProjectTasks, getTaskBlockers, getTaskChildren, getTaskDependencies, getTaskParent, getUnassignedTasks } from "./queries"
import { BrowserGraphStore } from "../storage/browser-graph-store"
import { openDatabase } from "../server/database"
import { WorkspaceRepository } from "../server/workspace-repository"

const empty=():Workspace=>({id:"w",name:"W",entities:[],edges:[],collapsedIds:[],ghostNotes:[]})
const last=(w:Workspace)=>w.entities.at(-1)!

describe("project/task canonical domain",()=>{
  it("creates projects, project tasks, and unassigned tasks through canonical entities and edges",()=>{
    let w=createProject(empty(),{title:"Alpha",priority:"high"});const p=last(w);w=createTask(w,{title:"Assigned"},p.id);const assigned=last(w);w=createTask(w,{title:"Inbox"});
    assert.deepEqual(getProjects(w).map(x=>x.id),[p.id]);assert.deepEqual(getProjectTasks(w,p.id).map(x=>x.id),[assigned.id]);assert.equal(getUnassignedTasks(w)[0].title,"Inbox");assert.ok(w.edges.some(e=>e.sourceId===assigned.id&&e.targetId===p.id&&e.type==="belongs_to"))
  })
  it("moves tasks between projects without changing identity or unrelated relationships",()=>{
    let w=createProject(empty(),{title:"A"});const a=last(w);w=createProject(w,{title:"B"});const b=last(w);w=createTask(w,{title:"T"},a.id);const task=last(w);w=createTask(w,{title:"Dependency"});const dep=last(w);w=addDependency(w,task.id,dep.id);w=assignTaskToProject(w,task.id,b.id)
    assert.equal(last(w).id,dep.id);assert.equal(w.entities.find(e=>e.id===task.id)?.id,task.id);assert.deepEqual(getProjectTasks(w,a.id),[]);assert.equal(getProjectTasks(w,b.id)[0].id,task.id);assert.equal(getTaskDependencies(w,task.id)[0].id,dep.id)
  })
  it("updates status, priority, due date and derives completion from direct tasks only",()=>{
    let w=createProject(empty(),{title:"P"});const p=last(w);w=createTask(w,{title:"Parent"},p.id);const parent=last(w);w=createSubtask(w,parent.id,{title:"Child"});const child=last(w);w=setTaskStatus(w,parent.id,"done");w=setTaskPriority(w,child.id,"urgent");w=setTaskDueDate(w,child.id,123)
    assert.deepEqual(getProjectProgress(w,p.id),{total:1,done:1,percent:100});assert.equal(w.entities.find(e=>e.id===child.id)?.priority,"urgent");assert.equal(w.entities.find(e=>e.id===child.id)?.dueAt,123);assert.equal(getTaskParent(w,child.id)?.id,parent.id);assert.equal(getTaskChildren(w,parent.id)[0].id,child.id);assert.equal(getProjectTasks(w,p.id).some(t=>t.id===child.id),true)
  })
  it("adds/removes one-direction dependencies and derives blockers",()=>{let w=createTask(empty(),{title:"A"});const a=last(w);w=createTask(w,{title:"B"});const b=last(w);w=addDependency(w,a.id,b.id);w=addDependency(w,a.id,b.id);assert.equal(getTaskDependencies(w,a.id)[0].id,b.id);assert.equal(getTaskBlockers(w,b.id)[0].id,a.id);assert.equal(w.edges.filter(e=>e.type==="depends_on").length,1);w=removeDependency(w,a.id,b.id);assert.equal(getTaskDependencies(w,a.id).length,0)})
  it("archives projects and converts notes to tasks without changing identity or edges",()=>{let w=createProject(empty(),{title:"P"});const p=last(w);w=archiveProject(w,p.id);assert.equal(getProjects(w).length,0);const note={id:"note",type:"note" as const,title:"N",body:"body",workspaceId:"w",createdAt:1,updatedAt:1};w={...w,entities:[...w.entities,note],edges:[...w.edges,{id:"e",sourceId:"note",targetId:p.id,type:"related_to",origin:"user",createdAt:1,updatedAt:1}]};w=convertEntityToTask(w,"note");assert.equal(w.entities.find(e=>e.id==="note")?.type,"task");assert.equal(w.edges.find(e=>e.id==="e")?.sourceId,"note")})
  it("survives browser and Hub repository persistence",async()=>{let w=createProject(empty(),{title:"Persisted"});const p=last(w);w=createTask(w,{title:"Task"},p.id);class MemoryStorage implements Storage{m=new Map<string,string>();get length(){return this.m.size}clear(){this.m.clear()}getItem(k:string){return this.m.get(k)??null}key(i:number){return [...this.m.keys()][i]??null}removeItem(k:string){this.m.delete(k)}setItem(k:string,v:string){this.m.set(k,v)}}const store=new BrowserGraphStore(new MemoryStorage());await store.save({version:2,activeWorkspaceId:"w",workspaces:[w],savedAt:1});assert.equal(getProjectTasks((await store.load())!.workspaces[0],p.id)[0].title,"Task");const db=openDatabase(":memory:"),repo=new WorkspaceRepository(db);const loaded=repo.saveState({version:2,activeWorkspaceId:"w",workspaces:[w],savedAt:1});assert.equal(getProjectTasks(loaded.workspaces[0],p.id)[0].id,getProjectTasks(w,p.id)[0].id);db.close()})
})
