import { FileNodepadStore } from "./persistence/file-store"
import { NodepadService } from "./services/nodepad"
export const nodepadStore=new FileNodepadStore()
export const nodepadService=new NodepadService(nodepadStore)
