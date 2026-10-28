import * as THREE from "three";
import { gsap } from "gsap";

export interface BattleSceneHandle {
  destroy: () => void;
  pulseStability: (side: "player" | "enemy") => void;
  pulseSlot: (side: "player" | "enemy", slot: number) => void;
  signalInitiative: (side: "player" | "enemy") => void;
  revealCard: (card: HTMLElement, cover: HTMLElement | null) => void;
}

export function mountBattleScene(root: HTMLElement): BattleSceneHandle {
  root.classList.add("battle-scene-root");
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog("#111827", 9, 23);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(0, 10.5, 14.5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
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
  const rim = new THREE.PointLight("#3c9eff", 24, 15);
  rim.position.set(-5, 2.3, -2);
  scene.add(rim);
  const hot = new THREE.PointLight("#ff5b70", 18, 14);
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

  const particleCount = 130;
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

  const resize = () => {
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.aspect = rect.width / rect.height;
    camera.position.x = rect.width < 520 ? 0 : 0;
    camera.position.z = rect.width < 520 ? 17 : 14.5;
    camera.position.y = rect.width < 520 ? 12 : 10.5;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  const clock = new THREE.Clock();
  let raf = 0;
  let disposed = false;
  const animate = () => {
    if (disposed) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    const pos = particleGeometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < particleCount; i++) {
      pos.array[i * 3 + 1] += particleSpeeds[i] * delta;
      if (pos.array[i * 3 + 1] > 2.7) pos.array[i * 3 + 1] = 0.1;
    }
    pos.needsUpdate = true;
    particles.rotation.y += delta * 0.018;
    rim.intensity = 22 + Math.sin(clock.elapsedTime * 1.8) * 3;
    hot.intensity = 17 + Math.sin(clock.elapsedTime * 1.3 + 1.4) * 2;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  };
  animate();

  const pulseStability = (side: "player" | "enemy") => {
    const light = side === "player" ? rim : hot;
    gsap.killTweensOf(light);
    gsap.fromTo(light, { intensity: 4 }, { intensity: 48, duration: 0.18, yoyo: true, repeat: 2, ease: "power2.out" });
    gsap.fromTo(centerRail.scale, { x: 0.55, y: 1, z: 1 }, { x: 1, duration: 0.42, ease: "elastic.out(1, 0.4)" });
  };

  const signalInitiative = (side: "player" | "enemy") => {
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

  const revealCard = (card: HTMLElement, cover: HTMLElement | null) => {
    gsap.killTweensOf(card);
    gsap.set(card, { transformPerspective: 720, transformOrigin: "50% 50%", rotationY: 180 });
    let coverRemoved = false;
    if (cover) gsap.set(cover, { opacity: 1, transformOrigin: "50% 50%" });
    gsap.to(card, {
      rotationY: 0, duration: 0.72, ease: "back.out(1.25)", overwrite: "auto",
      onUpdate: () => {
        const rotation = Number(gsap.getProperty(card, "rotationY"));
        if (!coverRemoved && rotation <= 92) {
          coverRemoved = true;
          cover?.remove();
        }
      },
      onComplete: () => {
        cover?.remove();
        gsap.set(card, { clearProps: "transformPerspective" });
      },
    });
  };

  const pulseSlot = (side: "player" | "enemy", slot: number) => {
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

  const animateCards = () => {
    const cards = root.querySelectorAll<HTMLElement>(".field-slot .game-card, .hand-cards .game-card");
    gsap.fromTo(cards, { opacity: 0.72, y: 12, rotateX: 4 }, { opacity: 1, y: 0, rotateX: 0, duration: 0.34, stagger: 0.035, ease: "power3.out", overwrite: "auto" });
    root.querySelectorAll<HTMLElement>(".game-card").forEach(card => {
      card.addEventListener("pointerenter", () => gsap.to(card, { y: -7, scale: 1.045, duration: 0.18, ease: "power2.out", overwrite: "auto" }));
      card.addEventListener("pointerleave", () => gsap.to(card, { y: 0, scale: 1, duration: 0.22, ease: "power2.out", overwrite: "auto" }));
    });
  };
  animateCards();

  return {
    pulseStability,
    pulseSlot,
    signalInitiative,
    revealCard,
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
