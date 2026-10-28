"use client";
import { useEffect, useRef } from "react";

// Slow domain-warped noise, like light through water. Rendered at half resolution: it's soft anyway.
const FRAG = `precision mediump float;
uniform vec2 uRes; uniform float uTime;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.-2.*f);
  return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a*n(p); p = p*2.03 + 7.1; a *= .5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.) * 1.4;
  float t = uTime * .035;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.*q + vec2(1.7, 9.2) + 1.4*t), fbm(p + 3.*q + vec2(8.3, 2.8) - t));
  float f = fbm(p + 2.6*r);
  vec3 a = vec3(.84,.90,.99);   // sky
  vec3 b = vec3(.69,.70,.96);   // lavender
  vec3 c = vec3(.97,.80,.90);   // blush
  vec3 d = vec3(.58,.72,.98);   // periwinkle
  vec3 col = mix(a, b, smoothstep(.25, .85, f));
  col = mix(col, c, smoothstep(.45, .9, length(q)) * .75);
  col = mix(col, d, smoothstep(.45, .8, r.x) * .7);
  col = mix(col, vec3(1.), smoothstep(.7, .95, f) * .45);
  gl_FragColor = vec4(col, 1.);
}`;
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

export default function Flow() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    if (!gl) return; // CSS gradient behind stays visible
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "uRes"), uTime = gl.getUniformLocation(prog, "uTime");

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = 0;
    const t0 = performance.now() - 40_000; // start mid-flow, not from a flat frame
    const resize = () => {
      canvas.width = Math.ceil(innerWidth * 0.5); canvas.height = Math.ceil(innerHeight * 0.5);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30 fps is plenty for something this slow
      last = now;
      gl.uniform1f(uTime, still ? 40 : (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.style.opacity = "1";
    };
    resize(); addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,#e1e8f4,#d6d4f3_50%,#f1dde9)]">
      <canvas ref={ref} className="h-full w-full opacity-0 transition-opacity duration-700" />
    </div>
  );
}
