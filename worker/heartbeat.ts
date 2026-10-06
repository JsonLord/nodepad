import { FileNodepadStore } from "../lib/persistence/file-store"
import { runHeartbeat } from "../lib/heartbeat"
import { configuredBackupRemote } from "../lib/github-sync/backup"
const store=new FileNodepadStore(),workspace=process.argv[2]||process.env.NODEPAD_WORKSPACE_ID||"default",once=process.argv.includes("--once"),interval=Math.max(10,Number(process.env.NODEPAD_HEARTBEAT_INTERVAL_SECONDS||900))*1000
async function tick(){try{const summary=await runHeartbeat(store,workspace,{backup:process.env.NODEPAD_GITHUB_SYNC==="true"?configuredBackupRemote():undefined});console.log(JSON.stringify(summary))}catch(e){console.error(e);process.exitCode=1}}
async function main(){await tick();if(!once)setInterval(tick,interval)}
void main()
