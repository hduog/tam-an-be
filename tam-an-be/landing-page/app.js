/* MathViz landing page — Three.js visualizations.
   No build step: loaded as a classic script after the three.js CDN bundle. */

(function () {
  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function makeFaceTexture(value, symbol, hexColor, uprightAngle) {
    const size = 256;
    const cvs = document.createElement("canvas");
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext("2d");
    const c = new THREE.Color(hexColor);
    ctx.fillStyle = `rgb(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0})`;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    const cells = Math.max(2, Math.round(Math.sqrt(value)));
    const step = size / cells;
    for (let i = 1; i < cells; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();
    }
    // Counter-rotate the label so it renders upright on screen regardless of
    // how this square is rotated in-plane to align with its triangle side.
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(uprightAngle || 0);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 64px Segoe UI, sans-serif";
    ctx.fillText(String(value), 0, -10);
    ctx.font = "600 28px Segoe UI, sans-serif";
    ctx.fillText(symbol, 0, 40);
    ctx.restore();
    const tex = new THREE.CanvasTexture(cvs);
    tex.needsUpdate = true;
    return tex;
  }

  /* ---------------- Hero: Pythagorean theorem in 3D ---------------- */
  function initHero() {
    const canvas = document.getElementById("hero-canvas");
    const heroSection = document.getElementById("hero");
    if (!canvas || !heroSection || typeof THREE === "undefined") return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05060a, 0.045);

    const camera = new THREE.PerspectiveCamera(
      42,
      heroSection.clientWidth / heroSection.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.6, 17);
    camera.lookAt(0, 0, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
      document.body.classList.add("no-webgl");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(heroSection.clientWidth, heroSection.clientHeight);

    scene.add(new THREE.AmbientLight(0x8899ff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(4, 6, 6);
    scene.add(dirLight);
    const rim = new THREE.PointLight(0x7dd3fc, 1.2, 20);
    rim.position.set(-5, -3, 4);
    scene.add(rim);

    // starfield backdrop
    const starCount = 500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 40;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x9db4ff, size: 0.05, transparent: true, opacity: 0.6 })
    );
    scene.add(stars);

    // Right triangle 3-4-5 with squares built on each side
    const a = 3,
      b = 4,
      c = 5;
    const A = new THREE.Vector3(0, 0, 0);
    const B = new THREE.Vector3(a, 0, 0);
    const C = new THREE.Vector3(0, b, 0);
    const centroid = new THREE.Vector3().add(A).add(B).add(C).divideScalar(3);

    const pivot = new THREE.Group();
    const model = new THREE.Group();
    pivot.add(model);
    scene.add(pivot);

    const shape = new THREE.Shape();
    shape.moveTo(A.x, A.y);
    shape.lineTo(B.x, B.y);
    shape.lineTo(C.x, C.y);
    shape.closePath();
    const triGeo = new THREE.ShapeGeometry(shape);
    const triMesh = new THREE.Mesh(
      triGeo,
      new THREE.MeshStandardMaterial({
        color: 0x0ea5a5,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        roughness: 0.4,
        metalness: 0.1,
      })
    );
    triMesh.position.z = 0.001;
    model.add(triMesh);

    model.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(triGeo),
        new THREE.LineBasicMaterial({ color: 0x5eead4 })
      )
    );

    // right-angle marker at A
    const m = 0.35;
    model.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(m, 0, 0.02),
          new THREE.Vector3(m, m, 0.02),
          new THREE.Vector3(0, m, 0.02),
        ]),
        new THREE.LineBasicMaterial({ color: 0xffffff })
      )
    );

    function buildSquare(p1, p2, hexColor, value, symbol) {
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const length = dir.length();
      dir.normalize();
      const normal = new THREE.Vector3(dir.y, -dir.x, 0);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const towardCentroid = new THREE.Vector3().subVectors(centroid, mid);
      if (normal.dot(towardCentroid) > 0) normal.negate();
      const center = mid.clone().addScaledVector(normal, length / 2);
      const angle = Math.atan2(dir.y, dir.x);
      const depth = 0.3;
      const geo = new THREE.BoxGeometry(length, length, depth);
      const sideMat = new THREE.MeshStandardMaterial({ color: hexColor, roughness: 0.5, metalness: 0.15 });
      const faceMat = new THREE.MeshStandardMaterial({
        map: makeFaceTexture(value, symbol, hexColor, angle),
        roughness: 0.6,
      });
      const mesh = new THREE.Mesh(geo, [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat]);
      mesh.position.copy(center);
      mesh.rotation.z = angle;
      return mesh;
    }

    model.add(buildSquare(A, B, 0xf97316, a * a, "a²"));
    model.add(buildSquare(C, A, 0x8b5cf6, b * b, "b²"));
    model.add(buildSquare(B, C, 0x22d3ee, c * c, "c²"));

    // recenter the whole assembly on its bounding-box center
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    const mouse = { x: 0, y: 0 };
    heroSection.addEventListener("pointermove", (e) => {
      const rect = heroSection.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    });

    function layoutHero() {
      const w = heroSection.clientWidth;
      if (w < 760) {
        // Narrow screens: the text column takes full width, so tuck the
        // model into the lower-right corner instead of behind the copy.
        pivot.position.set(2.4, -3.1, -1.5);
        pivot.scale.setScalar(0.6);
      } else {
        pivot.position.set(3.6, -0.3, 0);
        pivot.scale.setScalar(0.88);
      }
    }
    layoutHero();

    let elapsed = 0;
    const parallax = { x: 0, y: 0 };
    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!reduceMotion) elapsed += dt;
      // Gentle sway within a readable angle range, instead of a full spin
      // that would keep sweeping through edge-on, hard-to-read angles.
      const sway = Math.sin(elapsed * 0.35) * 0.32;
      const bob = Math.sin(elapsed * 0.5) * 0.05;
      parallax.x += (mouse.y * 0.2 - parallax.x) * 0.05;
      parallax.y += (mouse.x * 0.25 - parallax.y) * 0.05;
      pivot.rotation.x = bob + parallax.x;
      pivot.rotation.y = sway + parallax.y;
      stars.rotation.y -= dt * 0.01;
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener("resize", () => {
      const w = heroSection.clientWidth,
        h = heroSection.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      layoutHero();
    });
  }

  /* ---------------- Shared helper for the small concept scenes ---------------- */
  function setupConceptRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    function resize() {
      const w = canvas.clientWidth || 300,
        h = canvas.clientHeight || 200;
      renderer.setSize(w, h, false);
      return { w, h };
    }
    return { renderer, resize };
  }

  /* ---------------- Concept 1: unit circle / trigonometry ---------------- */
  function initTrigScene(canvas) {
    const { renderer, resize } = setupConceptRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    camera.position.set(0, 0, 4.2);
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    const group = new THREE.Group();
    scene.add(group);

    const segs = 96;
    const circlePts = [];
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      circlePts.push(new THREE.Vector3(Math.cos(t) * 1.4, Math.sin(t) * 1.4, 0));
    }
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(circlePts),
        new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.6 })
      )
    );

    const axisMat = new THREE.LineBasicMaterial({ color: 0x475569 });
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-1.8, 0, 0),
          new THREE.Vector3(1.8, 0, 0),
        ]),
        axisMat
      )
    );
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, -1.8, 0),
          new THREE.Vector3(0, 1.8, 0),
        ]),
        axisMat
      )
    );

    const radiusLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.4, 0, 0)]),
      new THREE.LineBasicMaterial({ color: 0xf8fafc })
    );
    group.add(radiusLine);

    const cosLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1.4, 0, 0), new THREE.Vector3(1.4, 0, 0)]),
      new THREE.LineBasicMaterial({ color: 0xfb923c })
    );
    group.add(cosLine);

    const sinLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1.4, 0, 0), new THREE.Vector3(1.4, 0, 0)]),
      new THREE.LineBasicMaterial({ color: 0xf472b6 })
    );
    group.add(sinLine);

    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    tip.position.set(1.4, 0, 0);
    group.add(tip);

    let theta = 0;
    return {
      scene,
      camera,
      renderer,
      active: false,
      resize() {
        const { w, h } = resize();
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
      update(dt) {
        theta += dt * (reduceMotion ? 0.2 : 0.9);
        const x = Math.cos(theta) * 1.4,
          y = Math.sin(theta) * 1.4;
        tip.position.set(x, y, 0);
        radiusLine.geometry.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, y, 0)]);
        cosLine.geometry.setFromPoints([new THREE.Vector3(x, y, 0), new THREE.Vector3(x, 0, 0)]);
        sinLine.geometry.setFromPoints([new THREE.Vector3(x, y, 0), new THREE.Vector3(0, y, 0)]);
        group.rotation.y = Math.sin(theta * 0.15) * 0.4;
        group.rotation.x = 0.15;
      },
    };
  }

  /* ---------------- Concept 2: derivative / gradient descent surface ---------------- */
  function initSurfaceScene(canvas) {
    const { renderer, resize } = setupConceptRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
    camera.position.set(2.6, 2.2, 2.8);
    camera.lookAt(0, 0.3, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const light = new THREE.DirectionalLight(0xffffff, 0.9);
    light.position.set(3, 5, 2);
    scene.add(light);

    const group = new THREE.Group();
    scene.add(group);

    const size = 3.4,
      seg = 36;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    const pos = geo.attributes.position;
    let maxH = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i);
      const h = 0.32 * (x * x + y * y);
      pos.setZ(i, h);
      maxH = Math.max(maxH, h);
    }
    const colors = new Float32Array(pos.count * 3);
    const cTop = new THREE.Color(0x8b5cf6),
      cBottom = new THREE.Color(0x22d3ee);
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getZ(i) / (maxH || 1);
      const col = cBottom.clone().lerp(cTop, t);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.rotateX(-Math.PI / 2);

    const surface = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide })
    );
    group.add(surface);
    group.add(
      new THREE.LineSegments(
        new THREE.WireframeGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 })
      )
    );

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x334155, roughness: 0.3 })
    );
    group.add(ball);

    let t = 0;
    return {
      scene,
      camera,
      renderer,
      active: false,
      resize() {
        const { w, h } = resize();
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
      update(dt) {
        t = (t + dt * (reduceMotion ? 0.04 : 0.12)) % 1;
        const r = 1.55 * (1 - t) + 0.03;
        const angle = t * Math.PI * 9;
        const x = Math.cos(angle) * r,
          z = Math.sin(angle) * r;
        const h = 0.32 * (x * x + z * z);
        ball.position.set(x, h + 0.09, z);
        if (!reduceMotion) group.rotation.y += dt * 0.08;
      },
    };
  }

  /* ---------------- Concept 3: Sierpinski tetrahedron fractal ---------------- */
  function initFractalScene(canvas) {
    const { renderer, resize } = setupConceptRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
    camera.position.set(0, 0.4, 4.6);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(3, 4, 5);
    scene.add(light);

    const group = new THREE.Group();
    scene.add(group);

    const cornerDirs = [
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(1, -1, -1),
      new THREE.Vector3(-1, 1, -1),
      new THREE.Vector3(-1, -1, 1),
    ];
    const baseGeo = new THREE.TetrahedronGeometry(1);
    const maxDepth = 3;

    function build(depth, center, size, colorT) {
      if (depth === 0) {
        const color = new THREE.Color().setHSL(0.5 + colorT * 0.25, 0.75, 0.55);
        const mesh = new THREE.Mesh(
          baseGeo,
          new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 })
        );
        mesh.scale.setScalar(size * 0.46);
        mesh.position.copy(center);
        group.add(mesh);
        return;
      }
      const half = size / 2;
      cornerDirs.forEach((d) => {
        const newCenter = center.clone().addScaledVector(d, half / 2);
        build(depth - 1, newCenter, half, colorT + d.y * 0.05);
      });
    }
    build(maxDepth, new THREE.Vector3(0, 0, 0), 2.6, 0);

    return {
      scene,
      camera,
      renderer,
      active: false,
      resize() {
        const { w, h } = resize();
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
      update(dt) {
        if (reduceMotion) return;
        group.rotation.y += dt * 0.35;
        group.rotation.x = Math.sin(Date.now() * 0.0003) * 0.25;
      },
    };
  }

  /* ---------------- Concept 4: Fibonacci golden-rectangle tiling ---------------- */
  function initFibonacciScene(canvas) {
    const { renderer, resize } = setupConceptRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 24, 15);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const light = new THREE.DirectionalLight(0xffffff, 0.9);
    light.position.set(6, 20, 12);
    scene.add(light);

    const group = new THREE.Group();
    scene.add(group);

    // [x0, y0, x1, y1] for each square, built in Fibonacci spiral order (sizes 1,1,2,3,5,8,13)
    const rects = [
      [0, 0, 1, 1],
      [-1, 0, 0, 1],
      [-1, -2, 1, 0],
      [1, -2, 4, 1],
      [-1, 1, 4, 6],
      [-9, -2, -1, 6],
      [-9, -15, 4, -2],
    ];
    const colorA = new THREE.Color(0xf59e0b),
      colorB = new THREE.Color(0x8b5cf6);
    const maxSize = 13;

    rects.forEach(([x0, y0, x1, y1], i) => {
      const w = x1 - x0,
        h = y1 - y0;
      const size = Math.max(w, h);
      const blockHeight = 0.35 + (size / maxSize) * 0.55;
      const geo = new THREE.BoxGeometry(w, blockHeight, h);
      const col = colorA.clone().lerp(colorB, i / (rects.length - 1));
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.15 }));
      mesh.position.set(x0 + w / 2, blockHeight / 2, y0 + h / 2);
      group.add(mesh);
    });

    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.children.forEach((child) => child.position.sub(center));

    return {
      scene,
      camera,
      renderer,
      active: false,
      resize() {
        const { w, h } = resize();
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
      update(dt) {
        if (!reduceMotion) group.rotation.y += dt * 0.18;
      },
    };
  }

  /* ---------------- Boot ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof THREE === "undefined") {
      document.body.classList.add("no-webgl");
      return;
    }

    try {
      initHero();
    } catch (e) {
      console.warn("Hero scene failed to initialize:", e);
      document.body.classList.add("no-webgl");
    }

    const conceptConfigs = [
      { id: "trig-canvas", init: initTrigScene },
      { id: "surface-canvas", init: initSurfaceScene },
      { id: "fractal-canvas", init: initFractalScene },
      { id: "fibonacci-canvas", init: initFibonacciScene },
    ];

    const activeScenes = [];
    conceptConfigs.forEach((cfg) => {
      const canvas = document.getElementById(cfg.id);
      if (!canvas) return;
      let sceneEntry;
      try {
        sceneEntry = cfg.init(canvas);
      } catch (e) {
        console.warn("Concept scene failed to initialize:", cfg.id, e);
        const wrap = canvas.parentElement;
        if (wrap) wrap.classList.add("no-webgl");
        return;
      }
      sceneEntry.resize();
      activeScenes.push(sceneEntry);

      const container = canvas.parentElement;
      const io = new IntersectionObserver(
        (entries) => entries.forEach((entry) => { sceneEntry.active = entry.isIntersecting; }),
        { threshold: 0.15 }
      );
      io.observe(container);

      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => sceneEntry.resize());
        ro.observe(container);
      }
    });

    const clock = new THREE.Clock();
    function loop() {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      activeScenes.forEach((s) => {
        if (s.active) {
          s.update(dt);
          s.renderer.render(s.scene, s.camera);
        }
      });
    }
    loop();
  });
})();
