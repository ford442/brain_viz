import re
with open('src/routine-handlers.js', 'r') as f:
    content = f.read()

# Let's see if the respiration handler is still there
if "handlers.set('respiration'" in content:
    print("still there")
else:
    print("removed")
