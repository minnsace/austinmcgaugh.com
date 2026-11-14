(() => {
  const container = document.getElementById("forge");
  if (!container) return;

  const canvas = container.querySelector("canvas");
  const toggle = container.querySelector(".forge-toggle");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let gl;
  let program;
  let frame = 0;
  let visible = true;
  let paused = false;
  let elapsed = 0;
  let lastTime = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let uniforms;

  const vertexSource = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision highp float;
    uniform vec2 resolution;
    uniform vec2 pointer;
    uniform float time;

    mat2 rotate2d(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
    float scene(vec3 p) {
      p.xz *= rotate2d(time * .12 + pointer.x * .55);
      p.yz *= rotate2d(pointer.y * .38);
      float ripple = sin(p.x * 4.0 + sin(p.y * 3.0 + time * .2)) *
                     sin(p.y * 3.5 + p.z * 2.0) * .075;
      return length(p) - 1.02 + ripple;
    }
    vec3 normalAt(vec3 p) {
      vec2 e = vec2(.003, 0.0);
      return normalize(vec3(scene(p + e.xyy) - scene(p - e.xyy),
                            scene(p + e.yxy) - scene(p - e.yxy),
                            scene(p + e.yyx) - scene(p - e.yyx)));
    }
    void main() {
      vec2 uv = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
      vec3 ro = vec3(0.0, 0.0, 4.2);
      vec3 rd = normalize(vec3(uv, -2.95));
      vec3 color = vec3(.025, .029, .042);
      float glow = exp(-length(uv) * 2.4);
      color += vec3(.11, .035, .12) * glow;
      float t = 0.0;
      float d = 0.0;
      for (int i = 0; i < 80; i++) {
        d = scene(ro + rd * t);
        if (d < .001 || t > 7.0) break;
        t += d * .72;
      }
      if (t < 7.0 && d < .01) {
        vec3 p = ro + rd * t;
        vec3 n = normalAt(p);
        vec3 material = p;
        material.xz *= rotate2d(time * .12 + pointer.x * .55);
        material.yz *= rotate2d(pointer.y * .38);
        float flow = material.y * 4.0 + material.x * 2.2 +
          sin(material.z * 4.0 + material.x * 3.0) * 1.3 +
          sin(material.x * 5.0 - material.y * 2.0) * .7;
        float bands = sin(flow * 2.8 + sin(flow * 1.3) * 1.5);
        vec3 warm = vec3(1.0, .34, .18);
        vec3 violet = vec3(.38, .13, .82);
        vec3 blue = vec3(.09, .66, .82);
        vec3 pigment = mix(violet, warm, smoothstep(-.55, .8, bands));
        pigment = mix(pigment, blue, smoothstep(.55, 1.0, sin(flow * 1.7 + 2.0)) * .7);
        float light = max(dot(n, normalize(vec3(-.6, .9, 1.0))), 0.0);
        float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.4);
        vec3 reflected = reflect(rd, n);
        float streak = pow(max(dot(reflected, normalize(vec3(-.5, .8, 1.0))), 0.0), 18.0);
        float streak2 = pow(max(dot(reflected, normalize(vec3(.8, -.3, 1.0))), 0.0), 35.0);
        color = pigment * (.16 + .58 * light) + vec3(.42, .65, .95) * rim * .55;
        color += vec3(1.0, .82, .74) * streak * .85 + vec3(.55, .75, 1.0) * streak2;
        color += pigment * .1;
      }
      color = pow(max(color, 0.0), vec3(.85));
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || "Shader compilation failed");
    }
    return shader;
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render() {
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.pointer, pointerX, pointerY);
    gl.uniform1f(uniforms.time, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    container.classList.add("forge-ready");
  }

  function draw(now) {
    frame = 0;
    if (!gl || paused || motion.matches || !visible || document.hidden) {
      lastTime = 0;
      return;
    }
    if (lastTime) elapsed += Math.min((now - lastTime) / 1000, .05);
    lastTime = now;
    pointerX += (targetX - pointerX) * .04;
    pointerY += (targetY - pointerY) * .04;
    render();
    frame = requestAnimationFrame(draw);
  }

  function schedule() {
    if (!frame && gl && !paused && !motion.matches && visible && !document.hidden) {
      frame = requestAnimationFrame(draw);
    }
  }

  function initialize() {
    try {
      gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
      if (!gl) throw new Error("WebGL is unavailable");
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Shader linking failed");
      }
      gl.useProgram(program);
      uniforms = {
        resolution: gl.getUniformLocation(program, "resolution"),
        pointer: gl.getUniformLocation(program, "pointer"),
        time: gl.getUniformLocation(program, "time")
      };
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      resize();
      toggle.hidden = motion.matches;
      schedule();
    } catch (error) {
      console.warn("The forge could not start; showing the static artwork.", error);
      gl = null;
      toggle.hidden = true;
      container.classList.remove("forge-ready");
    }
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    toggle.textContent = paused ? "Resume animation" : "Pause animation";
    if (paused) lastTime = 0;
    else schedule();
  });
  container.addEventListener("pointermove", (event) => {
    const rect = container.getBoundingClientRect();
    targetX = (event.clientX - rect.left) / rect.width * 2 - 1;
    targetY = (event.clientY - rect.top) / rect.height * 2 - 1;
  });
  container.addEventListener("pointerleave", () => { targetX = 0; targetY = 0; });
  window.addEventListener("resize", () => {
    if (!gl) return;
    resize();
    if (paused && !motion.matches) render();
  });
  document.addEventListener("visibilitychange", schedule);
  motion.addEventListener("change", () => {
    toggle.hidden = motion.matches || !gl;
    if (motion.matches) {
      container.classList.remove("forge-ready");
      lastTime = 0;
    } else {
      schedule();
    }
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    gl = null;
    container.classList.remove("forge-ready");
    toggle.hidden = true;
    console.warn("The forge lost its WebGL context; showing the static artwork.");
  });
  canvas.addEventListener("webglcontextrestored", initialize);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (!visible) lastTime = 0;
      else schedule();
    });
    observer.observe(container);
  }
  initialize();
})();
