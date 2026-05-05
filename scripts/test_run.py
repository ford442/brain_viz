import urllib.request
import time
import subprocess
import os

proc = subprocess.Popen(["npm", "run", "dev"])
time.sleep(3)
try:
    urllib.request.urlopen("http://localhost:5173")
    print("Server running ok")
except Exception as e:
    print(f"Error: {e}")
finally:
    proc.terminate()
