let input="";for await(const chunk of process.stdin)input+=chunk
const request=JSON.parse(input)
if(process.env.SHOULD_FAIL==="true"){process.stderr.write("fixture failure\n");process.exit(2)}
process.stdout.write(JSON.stringify({type:"status",status:"running"})+"\n")
process.stdout.write(JSON.stringify({type:"artifact",artifact:{type:"report",label:"Fixture report",externalRef:`fixture://${request.delegationId}`}})+"\n")
process.stdout.write(JSON.stringify({type:"result",status:"succeeded",summary:"done"})+"\n")
