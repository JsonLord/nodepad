import json

log_file = "live_llm_tests_5.log"

with open(log_file, "r") as f:
    lines = f.readlines()

for line in lines:
    if "Heartbeat:" in line:
        print("Heartbeat:", line.strip())
    if "Workspace Graph:" in line:
        print("Workspace Graph:", line.strip())
