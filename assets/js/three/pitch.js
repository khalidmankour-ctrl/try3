/* ============================================================================
 * Terrain 3D animé : pelouse texturée, marqueurs de joueurs pulsés,
 * lignes de passe, caméra en balancement lent + survol interactif.
 * ==========================================================================*/
import * as THREE from 'three';

const PITCH_W = 16;   // longueur (axe X)
const PITCH_H = 10;   // largeur  (axe Z)

/* --------------------------------------------------- texture de la pelouse */
function grassTexture () {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const g = c.getContext('2d');

  /* Bandes tondues */
  const bands = 10;
  for (let i = 0; i < bands; i++) {
    g.fillStyle = i % 2 === 0 ? '#1f6b38' : '#1a5c30';
    g.fillRect((c.width / bands) * i, 0, c.width / bands + 1, c.height);
  }

  /* Vignette + grain */
  const vg = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.2, c.width / 2, c.height / 2, c.width * 0.72);
  vg.addColorStop(0, 'rgba(255,255,255,.05)');
  vg.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = vg;
  g.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 1.6, 1.6);
  }

  /* Tracés */
  const m = 34;
  g.strokeStyle = 'rgba(255,255,255,.72)';
  g.lineWidth = 3;
  g.strokeRect(m, m, c.width - m * 2, c.height - m * 2);

  g.beginPath();
  g.moveTo(c.width / 2, m);
  g.lineTo(c.width / 2, c.height - m);
  g.stroke();

  g.beginPath();
  g.arc(c.width / 2, c.height / 2, 78, 0, Math.PI * 2);
  g.stroke();

  g.beginPath();
  g.arc(c.width / 2, c.height / 2, 5, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.fill();

  /* Surfaces + six mètres */
  const boxH = 260, boxW = 128, smallH = 120, smallW = 52;
  [0, 1].forEach(side => {
    const x = side === 0 ? m : c.width - m - boxW;
    g.strokeRect(x, (c.height - boxH) / 2, boxW, boxH);
    const sx = side === 0 ? m : c.width - m - smallW;
    g.strokeRect(sx, (c.height - smallH) / 2, smallW, smallH);
    /* Point de penalty */
    const px = side === 0 ? m + 86 : c.width - m - 86;
    g.beginPath(); g.arc(px, c.height / 2, 4, 0, Math.PI * 2); g.fill();
    /* Arc de surface */
    g.beginPath();
    g.arc(px, c.height / 2, 60, side === 0 ? -Math.PI / 2.6 : Math.PI - Math.PI / 2.6,
          side === 0 ? Math.PI / 2.6 : Math.PI + Math.PI / 2.6);
    g.stroke();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------- disque lumineux */
function glowTexture (hex) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, hex + 'ff');
  grd.addColorStop(0.35, hex + '77');
  grd.addColorStop(1, hex + '00');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{id:string,x:number,y:number,tag:string,name:string}>} slots
 * @param {(hit:null|{id:string,x:number,y:number})=>void} onHover
 */
export function createPitchScene (canvas, slots, onHover) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x04100a, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1.6, 0.1, 200);
  const TILT = THREE.MathUtils.degToRad(54);   // élévation de la caméra
  let camDist = 20;                             // recalculé dans fitCamera()

  /* Ajuste la distance pour que tout le terrain tienne dans le cadre,
     quel que soit le format du canvas. */
  function fitCamera () {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const needH = (PITCH_W / 2 + 1.1) / Math.tan(hFov / 2);          // largeur du terrain
    const needV = ((PITCH_H / 2 + 0.9) * Math.sin(TILT) + 0.9) / Math.tan(vFov / 2);
    camDist = Math.max(needH, needV);
  }

  scene.add(new THREE.AmbientLight(0xbfe6cd, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-6, 12, 6);
  scene.add(sun);
  const warm = new THREE.PointLight(0xff6a5a, 40, 30, 2);
  warm.position.set(8, 6, -4);
  scene.add(warm);

  /* Pelouse */
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH_W, PITCH_H),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.94, metalness: 0 })
  );
  pitch.rotation.x = -Math.PI / 2;
  scene.add(pitch);

  /* Bordure lumineuse */
  const edge = new THREE.Mesh(
    new THREE.RingGeometry(0, 1, 4),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  scene.add(edge);
  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(PITCH_W + 0.5, 0.06, PITCH_H + 0.5)),
    new THREE.LineBasicMaterial({ color: 0x2f8f57, transparent: true, opacity: 0.55 })
  );
  border.position.y = -0.02;
  scene.add(border);

  /* Buts */
  function goal (sign) {
    const gGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8f3ec, roughness: 0.5, metalness: 0.2 });
    const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.05, 8);
    const p1 = new THREE.Mesh(postGeo, mat); p1.position.set(0, 0.52, -1.1);
    const p2 = new THREE.Mesh(postGeo, mat); p2.position.set(0, 0.52, 1.1);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.2, 8), mat);
    bar.rotation.x = Math.PI / 2; bar.position.set(0, 1.04, 0);
    const net = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.05),
      new THREE.MeshBasicMaterial({ color: 0xcfe6d8, transparent: true, opacity: 0.1, side: THREE.DoubleSide, wireframe: true })
    );
    net.position.set(sign * 0.36, 0.52, 0);
    net.rotation.y = Math.PI / 2;
    gGroup.add(p1, p2, bar, net);
    gGroup.position.x = sign * (PITCH_W / 2);
    return gGroup;
  }
  scene.add(goal(1), goal(-1));

  /* --------------------------------------------------- marqueurs joueurs */
  const glowTex = glowTexture('#ffffff');
  const redGlow = glowTexture('#ff3b46');
  const markers = [];
  const markerGroup = new THREE.Group();
  scene.add(markerGroup);

  const nodeGeo = new THREE.SphereGeometry(0.2, 22, 22);
  const ringGeo = new THREE.RingGeometry(0.3, 0.36, 40);

  slots.forEach((slot, i) => {
    const g = new THREE.Group();
    const px = (slot.x - 0.5) * PITCH_W;
    const pz = (slot.y - 0.5) * PITCH_H;
    g.position.set(px, 0, pz);

    const node = new THREE.Mesh(nodeGeo, new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xdfeee6, emissiveIntensity: 0.85, roughness: 0.25, metalness: 0.1
    }));
    node.position.y = 0.24;
    node.userData.slot = slot;
    g.add(node);

    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    g.add(ring);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    halo.scale.setScalar(0.95);
    halo.position.y = 0.24;
    g.add(halo);

    /* Onde de pulsation au sol */
    const pulse = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.4, 44),
      new THREE.MeshBasicMaterial({ color: 0x9ff0bf, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.y = 0.014;
    g.add(pulse);

    markerGroup.add(g);
    markers.push({ group: g, node, ring, halo, pulse, slot, phase: i * 0.42, base: { x: px, z: pz } });
  });

  /* ------------------------------------------------------ lignes de passe */
  const links = [[1, 2], [2, 3], [3, 4], [5, 6], [5, 7], [6, 7], [8, 9], [9, 10], [5, 9], [1, 6], [4, 7]];
  const lineGroup = new THREE.Group();
  scene.add(lineGroup);
  const lines = links.map(([a, b]) => {
    if (!markers[a] || !markers[b]) return null;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(markers[a].base.x, 0.1, markers[a].base.z),
      new THREE.Vector3(markers[b].base.x, 0.1, markers[b].base.z)
    ]);
    const mat = new THREE.LineBasicMaterial({ color: 0x7fe3a5, transparent: true, opacity: 0.12 });
    const l = new THREE.Line(geo, mat);
    lineGroup.add(l);
    return l;
  }).filter(Boolean);

  /* Ballon au centre */
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.16, 1),
    new THREE.MeshStandardMaterial({ color: 0xf2f5f3, roughness: 0.4, metalness: 0.15, flatShading: true })
  );
  ball.position.set(0, 0.17, 0);
  scene.add(ball);

  const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: redGlow, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  ballGlow.scale.setScalar(1.1);
  ballGlow.position.copy(ball.position);
  scene.add(ballGlow);

  /* ---------------------------------------------------------- interaction */
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let hovered = null;
  let pointerInside = false;

  function onPointerMove (e) {
    const r = canvas.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    pointerInside = true;
  }
  function onLeave () { pointerInside = false; if (hovered) { hovered = null; onHover?.(null); } }
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onLeave);

  /* ---------------------------------------------------------------- boucle */
  const clock = new THREE.Clock();
  let raf = 0, running = true;

  function resize () {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCamera();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function tick () {
    raf = requestAnimationFrame(tick);
    if (!running) return;
    const t = clock.getElapsedTime();

    /* Caméra : léger balancement */
    const sway = Math.sin(t * 0.16);
    camera.position.set(
      sway * camDist * 0.06,
      Math.sin(TILT) * camDist * (1 + Math.sin(t * 0.23) * 0.02),
      Math.cos(TILT) * camDist * (1 + Math.cos(t * 0.16) * 0.02)
    );
    camera.lookAt(0, 0, 0);

    markers.forEach((m, i) => {
      const p = (t * 0.55 + m.phase) % 1;
      m.pulse.scale.setScalar(1 + p * 1.9);
      m.pulse.material.opacity = 0.3 * (1 - p);
      const bob = Math.sin(t * 1.3 + m.phase * 2) * 0.035;
      m.node.position.y = 0.24 + bob;
      m.halo.position.y = 0.24 + bob;
      /* micro-déplacement : les joueurs « respirent » dans leur zone */
      m.group.position.x = m.base.x + Math.sin(t * 0.42 + i) * 0.16;
      m.group.position.z = m.base.z + Math.cos(t * 0.36 + i * 1.7) * 0.14;
      const on = hovered === m;
      m.node.scale.lerp(new THREE.Vector3(on ? 1.5 : 1, on ? 1.5 : 1, on ? 1.5 : 1), 0.16);
      m.node.material.emissive.lerp(new THREE.Color(on ? 0xff5560 : 0xdfeee6), 0.16);
      m.halo.material.opacity += ((on ? 0.9 : 0.42) - m.halo.material.opacity) * 0.16;
      m.ring.material.opacity += ((on ? 0.8 : 0.35) - m.ring.material.opacity) * 0.16;
    });

    lines.forEach((l, i) => {
      l.material.opacity = 0.08 + Math.abs(Math.sin(t * 0.5 + i * 0.7)) * 0.18;
      const a = markers[links[i][0]], b = markers[links[i][1]];
      const arr = l.geometry.attributes.position.array;
      arr[0] = a.group.position.x; arr[2] = a.group.position.z;
      arr[3] = b.group.position.x; arr[5] = b.group.position.z;
      l.geometry.attributes.position.needsUpdate = true;
    });

    ball.rotation.y += 0.014;
    ball.rotation.x += 0.006;
    ball.position.y = 0.17 + Math.sin(t * 1.8) * 0.03;
    ballGlow.position.copy(ball.position);
    ballGlow.material.opacity = 0.4 + Math.sin(t * 2.2) * 0.14;

    /* Survol */
    if (pointerInside) {
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects(markers.map(m => m.node), false);
      const next = hits.length ? markers.find(m => m.node === hits[0].object) : null;
      if (next !== hovered) {
        hovered = next;
        if (!next) onHover?.(null);
        else {
          const v = next.group.position.clone();
          v.y = 0.55;
          v.project(camera);
          const r = canvas.getBoundingClientRect();
          onHover?.({
            id: next.slot.id,
            x: (v.x * 0.5 + 0.5) * r.width,
            y: (-v.y * 0.5 + 0.5) * r.height
          });
        }
      } else if (next) {
        const v = next.group.position.clone();
        v.y = 0.55;
        v.project(camera);
        const r = canvas.getBoundingClientRect();
        onHover?.({
          id: next.slot.id,
          x: (v.x * 0.5 + 0.5) * r.width,
          y: (-v.y * 0.5 + 0.5) * r.height
        });
      }
      canvas.style.cursor = hovered ? 'pointer' : 'default';
    }

    renderer.render(scene, camera);
  }
  tick();

  return {
    highlight (id) {
      hovered = markers.find(m => m.slot.id === id) || null;
    },
    pause () { running = false; },
    resume () { running = true; },
    dispose () {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onLeave);
      renderer.dispose();
    }
  };
}
