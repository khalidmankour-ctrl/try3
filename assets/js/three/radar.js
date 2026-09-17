/* ============================================================================
 * Radar 3D : toile hexagonale en perspective, deux polygones comparés,
 * valeurs animées à chaque changement de joueur.
 * ==========================================================================*/
import * as THREE from 'three';

const RADIUS = 2.55;
const clampNum = (v, a, b) => Math.min(b, Math.max(a, v));

function polyPoints (n, r) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  return pts;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{key:string,label:string}>} axes
 */
export function createRadarScene (canvas, axes) {
  const N = axes.length;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(0, 6.9, 6.05);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 2.4));
  const p = new THREE.PointLight(0xffffff, 60, 30, 2);
  p.position.set(3, 7, 4);
  scene.add(p);

  const root = new THREE.Group();
  scene.add(root);

  /* Libellés d'axes en HTML : toujours nets, jamais rognés. */
  const host = document.createElement('div');
  host.className = 'radar__host';
  canvas.parentNode.insertBefore(host, canvas);
  host.appendChild(canvas);

  const labelEls = axes.map(a => {
    const el = document.createElement('span');
    el.className = 'radar__ax';
    el.textContent = a.label;
    host.appendChild(el);
    return el;
  });
  const labelAnchors = polyPoints(N, RADIUS * 1.13);

  /* ------------------------------------------------------------ la toile */
  [0.25, 0.5, 0.75, 1].forEach((f, i) => {
    const pts = polyPoints(N, RADIUS * f);
    pts.push(pts[0].clone());
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x2a3237, transparent: true, opacity: i === 3 ? 0.9 : 0.5 })
    );
    root.add(line);
  });

  polyPoints(N, RADIUS).forEach(pt => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), pt]),
      new THREE.LineBasicMaterial({ color: 0x252c31, transparent: true, opacity: 0.8 })
    );
    root.add(line);
  });

  /* Sol discret sous la toile */
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(RADIUS * 1.06, 64),
    new THREE.MeshBasicMaterial({ color: 0x0e1214, transparent: true, opacity: 0.75 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  root.add(floor);

  /* ------------------------------------------------------- les polygones */
  function makeShape (colorHex, y) {
    const positions = new Float32Array((N + 1) * 3);
    const idx = [];
    for (let i = 0; i < N; i++) idx.push(0, i + 1, ((i + 1) % N) + 1);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(idx);

    const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: colorHex, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false
    }));
    fill.position.y = y;

    const outlinePos = new Float32Array((N + 1) * 3);
    const outGeo = new THREE.BufferGeometry();
    outGeo.setAttribute('position', new THREE.BufferAttribute(outlinePos, 3));
    const outline = new THREE.Line(outGeo, new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 }));
    outline.position.y = y + 0.01;

    const dots = [];
    const dotGeo = new THREE.SphereGeometry(0.075, 14, 14);
    const dotMat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < N; i++) {
      const d = new THREE.Mesh(dotGeo, dotMat);
      d.position.y = y + 0.02;
      root.add(d);
      dots.push(d);
    }

    root.add(fill, outline);
    return { geo, outGeo, fill, outline, dots, values: new Array(N).fill(0), target: new Array(N).fill(0), y };
  }

  const A = makeShape(0xff3b46, 0.05);
  const B = makeShape(0x38b6ff, 0.22);
  B.fill.visible = false;
  B.outline.visible = false;
  B.dots.forEach(d => (d.visible = false));

  function writeShape (s) {
    const pos = s.geo.attributes.position.array;
    const out = s.outGeo.attributes.position.array;
    pos[0] = 0; pos[1] = 0; pos[2] = 0;
    for (let i = 0; i < N; i++) {
      const a = (Math.PI * 2 * i) / N - Math.PI / 2;
      const r = (s.values[i] / 100) * RADIUS;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos[(i + 1) * 3] = x; pos[(i + 1) * 3 + 1] = 0; pos[(i + 1) * 3 + 2] = z;
      out[i * 3] = x; out[i * 3 + 1] = 0; out[i * 3 + 2] = z;
      s.dots[i].position.set(x, s.y + 0.02, z);
    }
    out[N * 3] = out[0]; out[N * 3 + 1] = 0; out[N * 3 + 2] = out[2];
    s.geo.attributes.position.needsUpdate = true;
    s.outGeo.attributes.position.needsUpdate = true;
    s.geo.computeBoundingSphere();
  }
  writeShape(A); writeShape(B);

  /* ---------------------------------------------------------------- boucle */
  const clock = new THREE.Clock();
  let raf = 0, running = true;
  let drag = 0, dragTarget = 0, dragging = false, lastX = 0;

  function onDown (e) { dragging = true; lastX = e.clientX; canvas.setPointerCapture?.(e.pointerId); }
  function onUp (e) { dragging = false; canvas.releasePointerCapture?.(e.pointerId); }
  function onMove (e) {
    if (!dragging) return;
    dragTarget += (e.clientX - lastX) * 0.007;
    lastX = e.clientX;
  }
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointermove', onMove);

  function resize () {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function tick () {
    raf = requestAnimationFrame(tick);
    if (!running) return;
    const t = clock.getElapsedTime();

    drag += (dragTarget - drag) * 0.08;
    root.rotation.y = drag + Math.sin(t * 0.18) * 0.10;
    root.rotation.x = Math.sin(t * 0.26) * 0.045;

    let dirty = false;
    [A, B].forEach(s => {
      for (let i = 0; i < N; i++) {
        const d = s.target[i] - s.values[i];
        if (Math.abs(d) > 0.05) { s.values[i] += d * 0.1; dirty = true; }
        else if (s.values[i] !== s.target[i]) { s.values[i] = s.target[i]; dirty = true; }
      }
      if (dirty) writeShape(s);
    });

    /* Replace les libellés HTML au-dessus de leur axe */
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    labelAnchors.forEach((pt, i) => {
      const v = pt.clone().applyMatrix4(root.matrixWorld).project(camera);
      const x = (v.x * 0.5 + 0.5) * cw;
      const y = (-v.y * 0.5 + 0.5) * ch;
      const hw = labelEls[i].offsetWidth / 2 + 4;
      labelEls[i].style.left = `${clampNum(x, hw, cw - hw)}px`;
      labelEls[i].style.top  = `${clampNum(y, 12, ch - 12)}px`;
    });

    A.fill.material.opacity = 0.26 + Math.sin(t * 1.4) * 0.05;
    if (B.fill.visible) B.fill.material.opacity = 0.22 + Math.sin(t * 1.4 + 1.6) * 0.05;

    renderer.render(scene, camera);
  }
  tick();

  return {
    /** @param {Object|null} a @param {Object|null} b */
    set (a, b) {
      axes.forEach((ax, i) => {
        A.target[i] = a ? (a[ax.key] ?? 0) : 0;
        B.target[i] = b ? (b[ax.key] ?? 0) : 0;
      });
      const showB = !!b;
      B.fill.visible = showB;
      B.outline.visible = showB;
      B.dots.forEach(d => (d.visible = showB));
    },
    pause () { running = false; },
    resume () { running = true; },
    dispose () {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      labelEls.forEach(el => el.remove());
      renderer.dispose();
    }
  };
}
