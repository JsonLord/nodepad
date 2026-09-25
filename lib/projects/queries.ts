import type { Entity } from "../domain/entity"
import type { Workspace } from "../domain/workspace"
import type { ProjectStatus, TaskStatus, WorkPriority } from "./constants"
import { DEFAULT_PROJECT_STATUS, DEFAULT_TASK_STATUS } from "./constants"

export const getProjects = (w:Workspace, includeArchived=false) => w.entities.filter(e=>e.type==="project" && (includeArchived || e.status!=="archived"))
  .sort((a,b)=>(a.title.localeCompare(b.title)))
export const getTasks = (w:Workspace) => w.entities.filter(e=>e.type==="task")
export const getEntity = (w:Workspace,id:string) => w.entities.find(e=>e.id===id)
export const getProjectStatus = (e:Entity):ProjectStatus => (e.status as ProjectStatus) ?? DEFAULT_PROJECT_STATUS
export const getTaskStatus = (e:Entity):TaskStatus => (e.status as TaskStatus) ?? DEFAULT_TASK_STATUS
export const getPriority = (e:Entity):WorkPriority => (e.priority as WorkPriority) ?? "none"
export const getTaskProjectId = (w:Workspace,taskId:string) => w.edges.find(e=>e.sourceId===taskId&&e.type==="belongs_to"&&w.entities.some(p=>p.id===e.targetId&&p.type==="project"))?.targetId
export const getProjectTasks = (w:Workspace,projectId:string) => { const ids=new Set(w.edges.filter(e=>e.type==="belongs_to"&&e.targetId===projectId).map(e=>e.sourceId)); return getTasks(w).filter(t=>ids.has(t.id)).sort(taskSort) }
export const getUnassignedTasks = (w:Workspace) => getTasks(w).filter(t=>!getTaskProjectId(w,t.id)).sort(taskSort)
export const getTaskChildren = (w:Workspace,parentId:string) => { const ids=new Set(w.edges.filter(e=>e.type==="child_of"&&e.targetId===parentId).map(e=>e.sourceId)); return getTasks(w).filter(t=>ids.has(t.id)).sort(taskSort) }
export const getTaskParent = (w:Workspace,childId:string) => { const id=w.edges.find(e=>e.type==="child_of"&&e.sourceId===childId)?.targetId; return id ? getEntity(w,id) : undefined }
export const getTaskDependencies = (w:Workspace,taskId:string) => w.edges.filter(e=>e.type==="depends_on"&&e.sourceId===taskId).map(e=>getEntity(w,e.targetId)).filter((e):e is Entity=>Boolean(e))
export const getTaskBlockers = (w:Workspace,taskId:string) => w.edges.filter(e=>e.type==="depends_on"&&e.targetId===taskId).map(e=>getEntity(w,e.sourceId)).filter((e):e is Entity=>Boolean(e))
export const isTaskBlocked = (w:Workspace,taskId:string) => getTaskDependencies(w,taskId).some(t=>getTaskStatus(t)!=="done")
export const getConnectedEntities = (w:Workspace,id:string) => { const ids=new Set(w.edges.flatMap(e=>e.sourceId===id?[e.targetId]:e.targetId===id?[e.sourceId]:[])); return w.entities.filter(e=>ids.has(e.id)) }
export function getProjectProgress(w:Workspace,projectId:string) { const children=new Set(w.edges.filter(e=>e.type==="child_of").map(e=>e.sourceId)); const direct=getProjectTasks(w,projectId).filter(t=>!children.has(t.id)); const done=direct.filter(t=>getTaskStatus(t)==="done").length; return { total:direct.length, done, percent:direct.length?Math.round(done/direct.length*100):0 } }
export function taskSort(a:Entity,b:Entity) { return (a.dueAt??Infinity)-(b.dueAt??Infinity) || a.createdAt-b.createdAt || a.title.localeCompare(b.title) }
export function searchWork(entities:Entity[],query:string) { const q=query.trim().toLowerCase(); return q?entities.filter(e=>`${e.title} ${e.body??""}`.toLowerCase().includes(q)):entities }
