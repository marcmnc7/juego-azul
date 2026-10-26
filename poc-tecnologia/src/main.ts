import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { makeMaterials, setAnisotropy } from './materials';
import { buildPlaza } from './world';
import { Player, makeCharacterModel, makeNPC, HEIGHT } from './player';
import { FollowCam } from './camera';
import { Input } from './input';
import azulUrl from './assets/azul.glb';
import animsUrl from './assets/anims.glb';
import envUrl from './assets/env.hdr';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const prog = $('prog'), loadmsg = $('loadmsg');
const setProg = (p: number, msg: string) => { prog.style.width = `${Math.round(p * 100)}%`; loadmsg.textContent = msg; };

async function main() {
  setProg(0.05, 'Arrancando el motor de física…');
  await RAPIER.init();

  const canvas = $<HTMLCanvasElement>('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const maxDpr = Math.min(window.devicePixelRatio, 2);
  let dpr = Math.min(maxDpr, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  setAnisotropy(renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);

  // Cielo físico (con horizonte de verdad) y luz de un cielo real fotografiado (HDRI) para los reflejos
  const sunDir = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
  const sky = new Sky();
  sky.scale.setScalar(800);
  const su = sky.material.uniforms;
  su.turbidity.value = 3.2; su.rayleigh.value = 1.2; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.85;
  su.sunPosition.value.copy(sunDir);
  scene.add(sky);
  scene.fog = new THREE.Fog(0xbcd3e4, 90, 420);

  setProg(0.15, 'Cargando el cielo…');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdr = await new RGBELoader().loadAsync(envUrl);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.75;
  hdr.dispose();

  const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -22; sc.right = sc.top = 22; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  setProg(0.3, 'Construyendo la Plaça des Born…');
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const M = makeMaterials();
  const info = buildPlaza(scene, world, M);

  // Objetos con física: cajas, barriles y una pelota que se pueden empujar
  const dyn: { mesh: THREE.Mesh; body: RAPIER.RigidBody }[] = [];
  const addDyn = (mesh: THREE.Mesh, desc: RAPIER.ColliderDesc, p: THREE.Vector3, damping = 0.3) => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setLinearDamping(damping).setAngularDamping(0.4).setCcdEnabled(true));
    world.createCollider(desc, body);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    dyn.push({ mesh, body });
  };
  const crateGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  for (const [x, y, z] of [[16, 0.3, 6.2], [16.7, 0.3, 6.4], [16.3, 0.9, 6.3], [15.4, 0.3, 7], [16.4, 1.5, 6.3]])
    addDyn(new THREE.Mesh(crateGeo, M.wood), RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3).setDensity(90).setFriction(0.7), new THREE.Vector3(x, y, z));
  const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.85, 20);
  for (const [x, z] of [[-12, -11], [-11.3, -11.4], [-11.8, -10.3]])
    addDyn(new THREE.Mesh(barrelGeo, M.wood), RAPIER.ColliderDesc.cylinder(0.425, 0.3).setDensity(120).setFriction(0.6), new THREE.Vector3(x, 0.43, z));
  const ballTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d')!;
    ['#e63946', '#ffffff', '#1d6fd8', '#ffd23f', '#ffffff', '#2a9d8f'].forEach((col, i) => { g.fillStyle = col; g.fillRect((i * 256) / 6, 0, 256 / 6 + 1, 128); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  addDyn(new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 16), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35 })),
    RAPIER.ColliderDesc.ball(0.32).setDensity(12).setRestitution(0.75).setFriction(0.5), new THREE.Vector3(7, 1.5, 4), 0.15);

  setProg(0.5, 'Cargando a Azul…');
  const loader = new GLTFLoader();
  const [azul, anims] = (await Promise.all([loader.loadAsync(azulUrl), loader.loadAsync(animsUrl)])) as [GLTF, GLTF];

  setProg(0.8, 'Animando…');
  const parts = makeCharacterModel(azul, anims);
  scene.add(parts.root);
  const start = new THREE.Vector3(11, 0, 4);
  const player = new Player(world, parts.root, parts.model, parts.clips, start);
  player.yaw = -2.2;

  // Gente en la plaza
  const npcMixers: THREE.AnimationMixer[] = [];
  const npcDefs: [string, number, number, number, number, number][] = [
    ['SambaDance', 4.5, 7.2, 3.6, 0xffc7c7, 0], ['SambaDance', 6.2, 6.0, 4.4, 0xc8e6ff, 1.3],
    ['idle', -15.2, 9.6, 0.5, 0xd6ffd0, 0.4], ['idle', -14.0, 10.4, -2.4, 0xfff0b0, 1.1],
  ];
  for (const [clip, x, z, yaw, tint, off] of npcDefs) {
    const p = makeCharacterModel(azul, anims, tint);
    scene.add(p.root);
    npcMixers.push(makeNPC(world, p, clip, new THREE.Vector3(x, 0, z), yaw, off));
  }

  const follow = new FollowCam(camera, world, player.collider);
  follow.yaw = player.yaw + Math.PI;
  const head = new THREE.Vector3();
  const input = new Input(canvas, $('stick'), $('jump'), $('dance'));

  // Ajuste automático de resolución para mantener la fluidez
  let frames = 0, acc = 0, fps = 60;
  const stats = $('stats');
  const showStats = new URLSearchParams(location.search).has('debug') || location.hash.includes('test');

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  // Compilar shaders antes de quitar la pantalla de carga (sin tirones al empezar)
  setProg(0.92, 'Preparando la luz…');
  world.step();
  await renderer.compileAsync(scene, camera);
  setProg(1, '¡Lista!');
  $('loading').classList.add('done');
  $('hud').hidden = false;
  const about = $('about');
  $('info').addEventListener('pointerdown', (e) => { e.stopPropagation(); about.hidden = false; });
  $('close').addEventListener('click', () => (about.hidden = true));
  setTimeout(() => ($('hint').style.opacity = '0'), 7000);

  const STEP = 1 / 60;
  let accum = 0, last = performance.now(), t = 0;
  head.set(start.x, HEIGHT * 0.88, start.z);
  follow.snap(head);

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    const ctl = input.consume();
    const mv = input.read();
    // Dirección relativa a la cámara
    const fy = follow.yaw;
    const wx = Math.cos(fy) * mv.x - Math.sin(fy) * mv.y;
    const wz = -Math.sin(fy) * mv.x - Math.cos(fy) * mv.y;

    accum += dt;
    let first = true;
    while (accum >= STEP) {
      player.fixedUpdate(STEP, { x: wx, z: wz, run: mv.run, jump: first && ctl.jump, dance: first && ctl.dance });
      world.step();
      accum -= STEP;
      first = false;
    }
    if (first && (ctl.jump || ctl.dance)) { input.jump ||= ctl.jump; input.dance ||= ctl.dance; }
    player.update(dt, accum / STEP);
    for (const m of npcMixers) m.update(dt);
    for (const d of dyn) {
      const p = d.body.translation(), q = d.body.rotation();
      d.mesh.position.set(p.x, p.y, p.z);
      d.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }

    head.set(player.position.x, player.position.y + HEIGHT * 0.88, player.position.z);
    const idleLook = now - input.lastLook > 1500;
    follow.update(dt, head, ctl, player.yaw, player.speed, idleLook);

    // Sombra que sigue a la jugadora, con el centro pegado a la rejilla de la sombra (no parpadea)
    const texel = 44 / sun.shadow.mapSize.x;
    const cx = Math.round(player.position.x / texel) * texel, cz = Math.round(player.position.z / texel) * texel;
    sun.target.position.set(cx, 0, cz);
    sun.position.set(cx, 0, cz).addScaledVector(sunDir, 60);

    M.water.normalMap!.offset.set(t * 0.004, t * 0.006);
    renderer.render(scene, camera);

    frames++; acc += dt;
    if (acc >= 1) {
      fps = frames / acc; frames = 0; acc = 0;
      if (fps < 42 && dpr > 0.85) { dpr = Math.max(0.85, dpr - 0.15); renderer.setPixelRatio(dpr); }
      else if (fps > 57 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr + 0.1); renderer.setPixelRatio(dpr); }
      if (showStats) stats.textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris · x${dpr.toFixed(2)}`;
    }
  });
}

main().catch((e) => {
  console.error(e);
  loadmsg.textContent = 'Error: ' + (e?.message ?? e);
});
