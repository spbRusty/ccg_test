import * as THREE from "three";
import { gsap } from "gsap";

export interface RevealOptions {
  /** Start this far above the slot (px, negative = up) and fly in face-down before flipping. */
  fromY?: number;
  /** Called when the card lands after the flip, for slot shake / sound. */
  onLand?: () => void;
}

export interface BattleSceneHandle {
  attach: (root: HTMLElement) => void;
  destroy: () => void;
  pulseStability: (side: "player" | "enemy") => void;
  pulseSlot: (side: "player" | "enemy", slot: number) => void;
  signalInitiative: (side: "player" | "enemy") => void;
  revealCard: (card: HTMLElement, cover: HTMLElement | null, options?: RevealOptions) => void;
  animateVolley: (side: "player" | "enemy", slot: number, targetSide: "player" | "enemy", kind: "damage" | "heal") => void;
}

export function mountBattleScene(initialRoot: HTMLElement): BattleSceneHandle {
  let root = initialRoot;
  root.classList.add("battle-scene-root");
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog("#111827", 9, 23);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(0, 10.5, 14.5);
  camera.lookAt(0, 0, 0);

  const isMobile = window.matchMedia("(max-width: 680px)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: !isMobile,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.className = "battle-scene-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  root.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight("#c9e8ff", "#111827", 2.1));
  const key = new THREE.DirectionalLight("#fff0c7", 3.2);
  key.position.set(-3, 9, 5);
  scene.add(key);
  const rim = new THREE.PointLight("#3c9eff", 10, 15);
  rim.position.set(-5, 2.3, -2);
  scene.add(rim);
  const hot = new THREE.PointLight("#ff5b70", 8, 14);
  hot.position.set(5, 2.2, 1);
  scene.add(hot);

  const initiativeLight = new THREE.PointLight("#ffd36b", 0, 12);
  initiativeLight.position.set(0, 3.2, 2.25);
  scene.add(initiativeLight);

  const tableMaterial = new THREE.MeshStandardMaterial({ color: "#344b65", roughness: 0.42, metalness: 0.28, emissive: "#102238", emissiveIntensity: 0.35 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.42, 8.2), tableMaterial);
  table.position.y = -0.36;
  table.receiveShadow = true;
  scene.add(table);
  const inset = new THREE.Mesh(new THREE.BoxGeometry(11.9, 0.045, 7.6), new THREE.MeshStandardMaterial({ color: "#3d5874", roughness: 0.52, metalness: 0.2, emissive: "#172d45", emissiveIntensity: 0.3 }));
  inset.position.y = -0.125;
  scene.add(inset);

  const slotGroup = new THREE.Group();
  scene.add(slotGroup);
  const slotMaterial = new THREE.MeshStandardMaterial({ color: "#243a52", roughness: 0.46, metalness: 0.2, emissive: "#102b48", emissiveIntensity: 0.85 });
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: "#79c8ff", roughness: 0.28, metalness: 0.35, emissive: "#287fcb", emissiveIntensity: 1.25 });
  const slots: THREE.Mesh[] = [];
  for (const z of [-2.25, 2.25]) {
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 2.55;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.09, 2.65), slotMaterial);
      pad.position.set(x, -0.075, z);
      pad.rotation.x = z < 0 ? -0.08 : 0.08;
      slotGroup.add(pad);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.035, 2.69), edgeMaterial);
      edge.position.set(x, -0.025, z);
      edge.rotation.x = pad.rotation.x;
      slotGroup.add(edge);
      slots.push(pad);
    }
  }

  const centerRail = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.035, 0.11), new THREE.MeshStandardMaterial({ color: "#f5c66b", emissive: "#e98738", emissiveIntensity: 1.7, metalness: 0.35, roughness: 0.25 }));
  centerRail.position.set(0, 0.02, 0);
  scene.add(centerRail);

  // Ambient particles are decorative only. Disable them on phones and when motion is reduced.
  const particleCount = isMobile || reducedMotion ? 0 : 32;
  const positions = new Float32Array(particleCount * 3);
  const particleSpeeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = Math.random() * 2.2 + 0.15;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    particleSpeeds[i] = 0.12 + Math.random() * 0.35;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: "#ffd58a", size: 0.035, transparent: true, opacity: 0.65, depthWrite: false }));
  scene.add(particles);

  // State is declared before the first resize, which renders the initial still frame.
  let raf = 0;
  let disposed = false;
  let renderUntil = 0;
  let lastFrameTime = 0;
  const renderOnce = () => {
    if (!disposed) renderer.render(scene, camera);
  };
  const resize = () => {
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.aspect = rect.width / rect.height;
    camera.position.z = rect.width < 520 ? 17 : 14.5;
    camera.position.y = rect.width < 520 ? 12 : 10.5;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
    renderOnce();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  // Render a still frame while idle. Wake the renderer only for short visual effects.
  const animate = (time: number) => {
    raf = 0;
    if (disposed) return;
    const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
    lastFrameTime = time;
    if (particleCount > 0 && delta > 0) {
      const pos = particleGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        pos.array[i * 3 + 1] += particleSpeeds[i] * delta;
        if (pos.array[i * 3 + 1] > 2.7) pos.array[i * 3 + 1] = 0.1;
      }
      pos.needsUpdate = true;
      particles.rotation.y += delta * 0.018;
    }
    renderer.render(scene, camera);
    if (time < renderUntil) raf = requestAnimationFrame(animate);
    else lastFrameTime = 0;
  };
  const wake = (duration = 900) => {
    renderUntil = Math.max(renderUntil, performance.now() + duration);
    if (!raf && !disposed) raf = requestAnimationFrame(animate);
  };

  const pulseStability = (side: "player" | "enemy") => {
    wake(850);
    const light = side === "player" ? rim : hot;
    gsap.killTweensOf(light);
    gsap.fromTo(light, { intensity: 4 }, { intensity: 48, duration: 0.18, yoyo: true, repeat: 2, ease: "power2.out" });
    gsap.fromTo(centerRail.scale, { x: 0.55, y: 1, z: 1 }, { x: 1, duration: 0.42, ease: "elastic.out(1, 0.4)" });
  };

  const signalInitiative = (side: "player" | "enemy") => {
    wake(850);
    initiativeLight.position.z = side === "player" ? 2.25 : -2.25;
    gsap.killTweensOf(initiativeLight);
    gsap.fromTo(initiativeLight, { intensity: 0 }, {
      intensity: 36, duration: 0.24, yoyo: true, repeat: 1, ease: "power2.out",
      onComplete: () => { initiativeLight.intensity = 0; },
    });
    gsap.killTweensOf(centerRail.material);
    gsap.fromTo(centerRail.material, { emissiveIntensity: 0.5 }, {
      emissiveIntensity: 2.8, duration: 0.22, yoyo: true, repeat: 1, ease: "power2.out",
    });
  };

  const revealCard = (card: HTMLElement, cover: HTMLElement | null, options: RevealOptions = {}) => {
    wake(1500);
    gsap.killTweensOf(card);
    gsap.set(card, { transformPerspective: 720, transformOrigin: "50% 50%", rotationY: 0, opacity: 1 });
    if (cover) gsap.set(cover, { opacity: 1, transformOrigin: "50% 50%" });
    const tl = gsap.timeline({
      onComplete: () => {
        cover?.remove();
        gsap.set(card, { clearProps: "transformPerspective,x,y,scale,rotation,rotationY,zIndex" });
      },
    });
    gsap.set(card, { zIndex: 40 });
    if (options.fromY !== undefined) {
      // Opponent cards arrive from above the arena, face-down, with a slight random spin.
      gsap.set(card, { y: options.fromY, scale: 0.7, rotation: gsap.utils.random(-14, 14) });
      tl.to(card, { y: 0, scale: 1.2, rotation: 0, duration: 0.34, ease: "power3.out" });
    } else {
      // Own cards lift off the slot before turning over.
      tl.to(card, { y: -12, scale: 1.2, duration: 0.14, ease: "power2.out" });
    }
    // Flip: turn edge-on showing the card back, swap in the face, then turn the rest of the way.
    tl.to(card, { rotationY: 90, duration: 0.2, ease: "power2.in", onComplete: () => cover?.remove() });
    tl.fromTo(card, { rotationY: -90 }, { rotationY: 0, duration: 0.24, ease: "power2.out" });
    // Landing: squash back into the slot, then let the caller add the impact.
    tl.to(card, { y: 0, scale: 0.94, duration: 0.09, ease: "power2.in", onStart: () => options.onLand?.() });
    tl.to(card, { scale: 1, duration: 0.26, ease: "elastic.out(1, 0.45)" });
  };

  const animateVolley = (side: "player" | "enemy", slot: number, targetSide: "player" | "enemy", kind: "damage" | "heal") => {
    wake(850);
    if (!Number.isInteger(slot) || slot < 0 || slot > 3) return;
    const start = new THREE.Vector3((slot - 1.5) * 2.55, 0.42, side === "player" ? 2.25 : -2.25);
    const end = new THREE.Vector3((slot - 1.5) * 1.55, 1.15, targetSide === "player" ? 4.55 : -4.55);
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({
      color: kind === "damage" ? "#ff5268" : "#65ffad",
      transparent: true,
      opacity: 0,
    });
    const beam = new THREE.Line(geometry, material);
    beam.frustumCulled = false;
    scene.add(beam);
    gsap.to(material, {
      opacity: 0.9,
      duration: 0.13,
      onComplete: () => gsap.to(material, {
        opacity: 0,
        duration: 0.24,
        onComplete: () => {
          scene.remove(beam);
          geometry.dispose();
          material.dispose();
        },
      }),
    });

    if (kind === "heal") {
      for (let index = 0; index < 3; index++) {
        const sparkGeometry = new THREE.SphereGeometry(0.045, 6, 6);
        const sparkMaterial = new THREE.MeshBasicMaterial({ color: "#9bffc4", transparent: true, opacity: 0.95 });
        const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
        spark.position.copy(start).lerp(end, 0.12 + index * 0.14);
        scene.add(spark);
        gsap.to(spark.position, {
          x: end.x, y: end.y + 0.16, z: end.z,
          duration: 0.3, delay: index * 0.035, ease: "power2.out",
          onComplete: () => {
            gsap.to(sparkMaterial, {
              opacity: 0, duration: 0.12,
              onComplete: () => {
                scene.remove(spark);
                sparkGeometry.dispose();
                sparkMaterial.dispose();
              },
            });
          },
        });
      }
    }
  };

  const pulseSlot = (side: "player" | "enemy", slot: number) => {
    wake(850);
    if (!Number.isInteger(slot) || slot < 0 || slot > 3) return;
    const pad = slots[(side === "enemy" ? 0 : 4) + slot];
    if (!pad) return;
    gsap.killTweensOf(pad.scale);
    gsap.fromTo(pad.scale, { x: 0.82, y: 1.2, z: 0.82 }, {
      x: 1, y: 1, z: 1, duration: 0.48, ease: "elastic.out(1, 0.38)", overwrite: "auto",
    });
    const material = pad.material as THREE.MeshStandardMaterial;
    gsap.killTweensOf(material);
    gsap.fromTo(material, { emissiveIntensity: 2.8 }, {
      emissiveIntensity: 0.85, duration: 0.62, ease: "power2.out", overwrite: "auto",
    });
  };

  return {
    attach: (nextRoot: HTMLElement) => {
      if (disposed || nextRoot === root) return;
      observer.unobserve(root);
      root.classList.remove("battle-scene-root");
      root = nextRoot;
      root.classList.add("battle-scene-root");
      root.prepend(renderer.domElement);
      observer.observe(root);
      resize();
    },
    pulseStability,
    pulseSlot,
    signalInitiative,
    revealCard,
    animateVolley,
    destroy: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      gsap.killTweensOf([rim, hot, initiativeLight, centerRail.scale, centerRail.material]);
      renderer.dispose();
      table.geometry.dispose(); tableMaterial.dispose();
      inset.geometry.dispose(); (inset.material as THREE.Material).dispose();
      slotGroup.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
          else object.material.dispose();
        }
      });
      particleGeometry.dispose(); (particles.material as THREE.Material).dispose();
      scene.clear();
      renderer.domElement.remove();
      root.classList.remove("battle-scene-root");
    },
  };
}
