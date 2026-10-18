import sys

log = sys.stdin.read()

# Let's find the test failure by line number
lines = log.split("\n")
for i, line in enumerate(lines):
    if "not ok 48" in line:
        for j in range(max(0, i-5), min(len(lines), i+15)):
            print(lines[j])
