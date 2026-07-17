// GLSL sources for the WebGL fallback renderer (src/brain-renderer-webgl.js)

export const meshVertexSource = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aColor;
uniform mat4 uMvp;
uniform float uPointSize;
out vec3 vColor;
void main() {
    gl_Position = uMvp * vec4(aPosition, 1.0);
    gl_PointSize = uPointSize;
    vColor = aColor;
}
`;

export const meshFragmentSource = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main() {
    outColor = vec4(vColor, 1.0);
}
`;

export const pointVertexSource = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec4 aColorSize;
uniform mat4 uMvp;
out vec4 vColorSize;
void main() {
    gl_Position = uMvp * vec4(aPosition, 1.0);
    gl_PointSize = max(1.5, aColorSize.w);
    vColorSize = aColorSize;
}
`;

export const pointFragmentSource = `#version 300 es
precision highp float;
in vec4 vColorSize;
out vec4 outColor;
void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = dot(uv, uv);
    if (d > 1.0) {
        discard;
    }
    float glow = smoothstep(1.0, 0.0, d);
    outColor = vec4(vColorSize.rgb * glow, vColorSize.a * glow);
}
`;
