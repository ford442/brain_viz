import re

with open('src/shaders.js', 'r') as f:
    text = f.read()

print("Uniform structs:")
matches = re.finditer(r'struct Uniforms \{.*?\n\}', text, re.DOTALL)
for m in matches:
    print(m.group(0))
    print("---")
