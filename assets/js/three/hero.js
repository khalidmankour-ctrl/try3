/* ============================================================================
 * Scène 3D du héros : ballon facetté en rotation, poussière lumineuse,
 * crêtes de l'Atlas en silhouette et étoiles marocaines flottantes.
 * ==========================================================================*/
import * as THREE from 'three';

export function createHeroScene (canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x120305, 0.055);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(0, 0.3, 11);

  /* ---------------------------------------------------------------- lumière */
  scene.add(new THREE.AmbientLight(0x3d141b, 3.4));

  const key = new THREE.PointLight(0xff4a52, 320, 44, 2);
  key.position.set(5, 4, 6);
  scene.add(key);

  const rim = new THREE.PointLight(0xffd9c0, 150, 40, 2);
  rim.position.set(-7, 2, 4);
  scene.add(rim);

  const top = new THREE.DirectionalLight(0xffe9e4, 2.4);
  top.position.set(-2, 8, 5);
  scene.add(top);

  /* ------------------------------------------------------------- le ballon */
  const ballGroup = new THREE.Group();
  ballGroup.position.set(3.2, 0.1, 0);
  scene.add(ballGroup);

  const R = 2.55;
  const ballGeo = new THREE.IcosahedronGeometry(R, 1);

  const ball = new THREE.Mesh(
    ballGeo,
    new THREE.MeshStandardMaterial({
      color: 0x3a1418, roughness: 0.34, metalness: 0.55, flatShading: true,
      emissive: 0x7a1119, emissiveIntensity: 0.65
    })
  );
  ballGroup.add(ball);

  /* Nervures lumineuses entre les facettes */
  const seams = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R * 1.004, 1)),
    new THREE.LineBasicMaterial({ color: 0xff8a8f, transparent: true, opacity: 0.8 })
  );
  ballGroup.add(seams);

  /* Halo externe (faux glow par matériau en face arrière) */
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.19, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0xff2230, transparent: true, opacity: 0.16, side: THREE.BackSide })
  );
  ballGroup.add(halo);

  /* Anneau d'orbite incliné */
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R * 1.52, 0.012, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xff6a72, transparent: true, opacity: 0.42 })
  );
  ring.rotation.set(Math.PI / 2.35, 0.3, 0);
  ballGroup.add(ring);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(R * 1.78, 0.007, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0x1f9d55, transparent: true, opacity: 0.3 })
  );
  ring2.rotation.set(Math.PI / 1.85, -0.5, 0.4);
  ballGroup.add(ring2);

  /* ------------------------------------------------- étoiles marocaines 3D */
  const starShape = (() => {
    const s = new THREE.Shape();
    const outer = 1, inner = 0.42;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
    }
    s.closePath();
    return s;
  })();

  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.09, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  starGeo.center();

  const stars = [];
  for (let i = 0; i < 7; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: i % 3 === 0 ? 0x1f9d55 : 0xd8232f,
      emissive: i % 3 === 0 ? 0x0c4d29 : 0x5e0d13,
      emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.8
    });
    const m = new THREE.Mesh(starGeo, mat);
    const s = 0.16 + Math.random() * 0.2;
    m.scale.setScalar(s);
    m.position.set(
      -5 + Math.random() * 12,
      -2.6 + Math.random() * 5.4,
      -4 + Math.random() * 5
    );
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    m.userData = {
      spin: (Math.random() - 0.5) * 0.9,
      float: 0.2 + Math.random() * 0.4,
      phase: Math.random() * 6.28,
      y0: m.position.y
    };
    stars.push(m);
    scene.add(m);
  }

  /* ---------------------------------------------------------- poussière */
  const COUNT = 900;
  const pos = new Float32Array(COUNT * 3);
  const spd = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 34;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 4;
    spd[i] = 0.1 + Math.random() * 0.45;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xffb0a8, size: 0.045, transparent: true, opacity: 0.5,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  scene.add(dust);

  /* ------------------------------------------------- crêtes de l'Atlas */
  function ridge (yBase, amp, zPos, color, opacity, seed) {
    const pts = [];
    const W = 46, STEP = 0.55;
    for (let x = -W / 2; x <= W / 2; x += STEP) {
      const h =
        Math.sin(x * 0.19 + seed) * amp +
        Math.sin(x * 0.51 + seed * 2.1) * amp * 0.42 +
        Math.sin(x * 1.13 + seed * 3.7) * amp * 0.16;
      pts.push(new THREE.Vector2(x, yBase + h));
    }
    const shape = new THREE.Shape();
    shape.moveTo(pts[0].x, -12);
    pts.forEach(p => shape.lineTo(p.x, p.y));
    shape.lineTo(pts[pts.length - 1].x, -12);
    shape.closePath();
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
    );
    mesh.position.z = zPos;
    return mesh;
  }

  const ridges = new THREE.Group();
  ridges.add(ridge(-3.4, 1.5, -13, 0x3a0a10, 0.85, 0.4));
  ridges.add(ridge(-4.2, 1.1, -9.5, 0x24070c, 0.9, 2.8));
  ridges.add(ridge(-5.0, 0.8, -6.5, 0x120407, 0.95, 5.1));
  scene.add(ridges);

  /* ------------------------------------------------------------ interaction */
  const mouse = new THREE.Vector2(0, 0);
  const target = new THREE.Vector2(0, 0);
  function onMove (e) {
    const r = canvas.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }
  window.addEventListener('pointermove', onMove, { passive: true });

  /* ----------------------------------------------------------------- boucle */
  const clock = new THREE.Clock();
  let raf = 0, running = true;

  function resize () {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    /* Recadre le ballon sur les petits écrans */
    ballGroup.position.x = w < 820 ? 0 : 3.2;
    ballGroup.scale.setScalar(w < 820 ? 0.72 : 1);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  resize();

  function tick () {
    raf = requestAnimationFrame(tick);
    if (!running) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 0.05);

    ballGroup.rotation.y += dt * 0.26;
    ballGroup.rotation.x = Math.sin(t * 0.32) * 0.12;
    ballGroup.position.y = 0.1 + Math.sin(t * 0.7) * 0.14;
    seams.material.opacity = 0.68 + Math.sin(t * 1.6) * 0.18;
    ring.rotation.z += dt * 0.35;
    ring2.rotation.z -= dt * 0.22;
    halo.scale.setScalar(1 + Math.sin(t * 1.1) * 0.025);

    stars.forEach(s => {
      s.rotation.y += dt * s.userData.spin;
      s.rotation.x += dt * s.userData.spin * 0.4;
      s.position.y = s.userData.y0 + Math.sin(t * s.userData.float + s.userData.phase) * 0.45;
    });

    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      p[i * 3 + 1] += spd[i] * dt * 0.55;
      if (p[i * 3 + 1] > 8) p[i * 3 + 1] = -8;
    }
    dustGeo.attributes.position.needsUpdate = true;

    mouse.lerp(target, 0.045);
    camera.position.x = mouse.x * 0.85;
    camera.position.y = 0.3 - mouse.y * 0.45;
    camera.lookAt(1.2, 0, 0);
    ridges.position.x = -mouse.x * 0.5;

    renderer.render(scene, camera);
  }
  tick();

  return {
    pause () { running = false; },
    resume () { running = true; clock.getDelta(); },
    dispose () {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      renderer.dispose();
    }
  };
}
