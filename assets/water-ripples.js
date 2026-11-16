// Ondas de agua sobre la imagen del hero, al estilo de jquery.ripples (la demo de Webflow):
// simulación de altura en la GPU + refracción y brillo especular. Sin jQuery.
// Costo: solo corre mientras hay ondas. Tras IDLE_MS sin cursor se detiene y vuelve la <img>.
const motion = matchMedia('(prefers-reduced-motion: no-preference)');
const RESOLUTION = 512;   // texels de la simulación sobre el lado mayor del hero (demo: 512)
const DROP_RADIUS = 20;   // px (demo: 20)
const PERTURBANCE = 0.01; // fuerza de la refracción (demo: 0.01)
const STEP = 1000 / 60;   // paso fijo: misma velocidad y costo a 60, 120 o 144 Hz
const IDLE_MS = 5000;     // tiempo para que el agua se calme antes de apagar el bucle
const MAX_DPR = 1.5;

const hero = document.querySelector('.hero');
const img = hero?.querySelector('.hero-water img');

const VERT = `#version 300 es
in vec2 pos; out vec2 uv;
void main() { uv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }`;

const DROP = `#version 300 es
precision highp float;
uniform sampler2D state; uniform vec2 center; uniform float radius, strength;
in vec2 uv; out vec4 color;
void main() {
  vec4 info = texture(state, uv);
  float drop = max(0.0, 1.0 - length(center - uv) / radius);
  info.r += (0.5 - cos(drop * 3.14159265) * 0.5) * strength;
  color = info;
}`;

const UPDATE = `#version 300 es
precision highp float;
uniform sampler2D state; uniform vec2 delta;
in vec2 uv; out vec4 color;
void main() {
  vec4 info = texture(state, uv);
  float average = (texture(state, uv - vec2(delta.x, 0.0)).r + texture(state, uv + vec2(delta.x, 0.0)).r
                 + texture(state, uv - vec2(0.0, delta.y)).r + texture(state, uv + vec2(0.0, delta.y)).r) * 0.25;
  info.g += (average - info.r) * 2.0;
  info.g *= 0.995;
  info.r += info.g;
  color = info;
}`;

const RENDER = `#version 300 es
precision highp float;
uniform sampler2D state, image; uniform vec2 delta, simScale, bgScale, bgOffset; uniform float perturbance;
in vec2 uv; out vec4 color;
void main() {
  vec2 sim = 0.5 + (uv - 0.5) * simScale;
  float h = texture(state, sim).r;
  float hx = texture(state, sim + vec2(delta.x, 0.0)).r;
  float hy = texture(state, sim + vec2(0.0, delta.y)).r;
  vec2 offset = -normalize(cross(vec3(0.0, hy - h, delta.y), vec3(delta.x, hx - h, 0.0))).xz;
  float specular = pow(max(0.0, dot(offset, normalize(vec2(-0.6, 1.0)))), 4.0);
  vec2 bg = vec2(uv.x, 1.0 - uv.y) * bgScale + bgOffset + vec2(offset.x, -offset.y) * perturbance;
  color = vec4(texture(image, bg).rgb + specular, 1.0);
}`;

function program(gl, fragment) {
  const p = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(p, shader);
  }
  gl.bindAttribLocation(p, 0, 'pos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const locations = {};
  return { p, u: (name) => (locations[name] ??= gl.getUniformLocation(p, name)) };
}

function texture(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function setup() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .4s;pointer-events:none';
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return;

  // Estado de la simulación: R = altura, G = velocidad. Float32 si se puede filtrar, si no Float16.
  const float32 = gl.getExtension('EXT_color_buffer_float') && gl.getExtension('OES_texture_float_linear');
  if (!float32 && !gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return;
  const states = [0, 1].map(() => {
    const t = texture(gl);
    gl.texImage2D(gl.TEXTURE_2D, 0, float32 ? gl.RG32F : gl.RG16F, RESOLUTION, RESOLUTION, 0, gl.RG, float32 ? gl.FLOAT : gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, fb };
  });
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return;

  const image = texture(gl);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  } catch (error) {
    console.warn('Ondas desactivadas: abre la página con un servidor local, no con file://', error);
    return;
  }

  const drop = program(gl, DROP);
  const update = program(gl, UPDATE);
  const render = program(gl, RENDER);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  let width, height, longest, bgScale, bgOffset;
  let frame = 0, running = false, visible = true, lost = false, last = 0, carry = 0, lastInput = 0, current = 0;
  const drops = [];

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    longest = Math.max(width, height);
    const dpr = Math.min(devicePixelRatio, MAX_DPR);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // Replica object-fit: cover + object-position de la <img> para que el cambio sea invisible.
    const [x, y] = getComputedStyle(img).objectPosition.split(' ').map((value) => parseFloat(value) / 100);
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    bgScale = [width / w, height / h];
    bgOffset = [(w - width) * x / w, (h - height) * y / h];
    if (running) draw();
  }

  function pass(prog, setUniforms) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, states[1 - current].fb);
    gl.viewport(0, 0, RESOLUTION, RESOLUTION);
    gl.useProgram(prog.p);
    gl.bindTexture(gl.TEXTURE_2D, states[current].t);
    gl.uniform1i(prog.u('state'), 0);
    setUniforms(prog);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    current = 1 - current;
  }

  function draw() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(render.p);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, image);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, states[current].t);
    gl.uniform1i(render.u('state'), 0);
    gl.uniform1i(render.u('image'), 1);
    gl.uniform2f(render.u('delta'), 1 / RESOLUTION, 1 / RESOLUTION);
    gl.uniform2f(render.u('simScale'), width / longest, height / longest);
    gl.uniform2fv(render.u('bgScale'), bgScale);
    gl.uniform2fv(render.u('bgOffset'), bgOffset);
    gl.uniform1f(render.u('perturbance'), PERTURBANCE);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Copia el zoom de entrada de la <img> (Framer Motion) mientras dure.
    const transform = getComputedStyle(img).transform;
    if (canvas.style.transform !== transform) canvas.style.transform = transform;
  }

  function tick(now) {
    frame = 0;
    if (!visible) return; // el IntersectionObserver lo reanuda
    carry = Math.min(carry + now - last, STEP * 3);
    last = now;
    let changed = drops.length > 0;

    if (changed) {
      const rect = canvas.getBoundingClientRect();
      for (const [clientX, clientY, strength, radius] of drops.splice(0)) {
        const u = (clientX - rect.left) / rect.width;
        const v = 1 - (clientY - rect.top) / rect.height;
        pass(drop, (p) => {
          gl.uniform2f(p.u('center'), 0.5 + (u - 0.5) * width / longest, 0.5 + (v - 0.5) * height / longest);
          gl.uniform1f(p.u('radius'), radius / longest);
          gl.uniform1f(p.u('strength'), strength);
        });
      }
    }
    for (; carry >= STEP; carry -= STEP, changed = true) {
      pass(update, (p) => gl.uniform2f(p.u('delta'), 1 / RESOLUTION, 1 / RESOLUTION));
    }
    if (changed) draw();

    if (now - lastInput > IDLE_MS) {
      running = false;
      canvas.style.transitionDuration = '.4s';
      canvas.style.opacity = 0; // la <img> queda debajo; el agua ya está casi quieta
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function addDrop(clientX, clientY, strength, radius) {
    if (!motion.matches || lost) return;
    if (drops.length < 4) drops.push([clientX, clientY, strength, radius]);
    lastInput = performance.now();
    if (!running) {
      running = true;
      for (const { fb } of states) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      last = lastInput;
      carry = 0;
      canvas.style.transitionDuration = '0s';
      canvas.style.opacity = 1;
    }
    if (!frame && visible) frame = requestAnimationFrame(tick);
  }

  img.after(canvas);
  resize();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && running && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }).observe(hero);

  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') addDrop(event.clientX, event.clientY, 0.01, DROP_RADIUS);
  }, { passive: true });
  hero.addEventListener('pointerdown', (event) => addDrop(event.clientX, event.clientY, 0.14, DROP_RADIUS * 1.5), { passive: true });
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    canvas.remove();
  });
}

if (img) img.decode().then(setup, () => {});
