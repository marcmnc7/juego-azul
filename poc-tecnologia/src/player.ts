import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Azul: un modelo glTF con esqueleto (rig de Mixamo) movido por el controlador de personaje de Rapier.
// Las animaciones vienen de captura de movimiento (Mixamo) y se mezclan según la velocidad real,
// con la cadencia ajustada para que los pies no patinen.

export const HEIGHT = 1.66;
const RADIUS = 0.28;
const HALF = HEIGHT / 2 - RADIUS;
const WALK = 1.45, RUN = 4.6;
const GRAVITY = 9.81 * 1.35; // un poco más que la real: en pantalla se siente más natural
const JUMP_V = 4.1;          // ≈ 0,6 m de salto

export interface MoveInput { x: number; z: number; run: boolean; jump: boolean; dance: boolean }

interface Pose { q: Map<string, THREE.Quaternion>; p: Map<string, THREE.Vector3> }

function bones(root: THREE.Object3D) {
  const list: THREE.Object3D[] = [];
  root.traverse((o) => { if (o.name.startsWith('mixamorig')) list.push(o); }); // padres antes que hijos
  return list;
}

function worldPose(root: THREE.Object3D): Pose {
  root.updateMatrixWorld(true);
  const pose: Pose = { q: new Map(), p: new Map() };
  for (const b of bones(root)) { pose.q.set(b.name, b.getWorldQuaternion(new THREE.Quaternion())); pose.p.set(b.name, b.getWorldPosition(new THREE.Vector3())); }
  return pose;
}

/** Pose de referencia de un rig aplicando un clip en su primer fotograma (la T de Mixamo). */
function poseFromClip(root: THREE.Object3D, clip?: THREE.AnimationClip): Pose {
  if (!clip) return worldPose(root);
  const mixer = new THREE.AnimationMixer(root);
  const a = mixer.clipAction(clip).play();
  a.time = 0; mixer.update(0);
  const pose = worldPose(root);
  a.stop(); mixer.uncacheRoot(root);
  return pose;
}

/**
 * Retargeting de verdad: los dos rigs tienen los mismos huesos pero distintas orientaciones de
 * reposo. Se copia la rotación de cada hueso en espacio mundo respecto a la T de cada uno, y la
 * cadera se escala a la altura del personaje de destino.
 */
export function retargetClip(src: THREE.Object3D, srcRest: Pose, clip: THREE.AnimationClip, dst: THREE.Object3D, dstRest: Pose, fps = 30) {
  const srcBones = new Map(bones(src).map((b) => [b.name, b]));
  const dstBones = bones(dst).filter((b) => srcBones.has(b.name));
  const mixer = new THREE.AnimationMixer(src);
  const action = mixer.clipAction(clip).play();
  const n = Math.max(2, Math.ceil(clip.duration * fps) + 1);
  const times: number[] = [];
  const qv = new Map<string, number[]>(dstBones.map((b) => [b.name, []]));
  const pv: number[] = [];
  const hipsName = 'mixamorigHips';
  const k = dstRest.p.get(hipsName)!.y / srcRest.p.get(hipsName)!.y;
  const ws = new THREE.Quaternion(), delta = new THREE.Quaternion(), wt = new THREE.Quaternion(), pw = new THREE.Quaternion(), loc = new THREE.Quaternion();
  const dstWorld = new Map<string, THREE.Quaternion>();
  const sp = new THREE.Vector3();
  dst.updateMatrixWorld(true);
  for (let f = 0; f < n; f++) {
    const t = Math.min(clip.duration, f / fps);
    times.push(t);
    action.time = t;
    mixer.update(0);
    src.updateMatrixWorld(true);
    for (const b of dstBones) {
      srcBones.get(b.name)!.getWorldQuaternion(ws);
      delta.copy(ws).multiply(srcRest.q.get(b.name)!.clone().invert());
      wt.copy(delta).multiply(dstRest.q.get(b.name)!);
      const parent = b.parent!;
      if (dstWorld.has(parent.name) && parent.name.startsWith('mixamorig')) pw.copy(dstWorld.get(parent.name)!);
      else parent.getWorldQuaternion(pw);
      loc.copy(pw).invert().multiply(wt);
      qv.get(b.name)!.push(loc.x, loc.y, loc.z, loc.w);
      dstWorld.set(b.name, wt.clone());
    }
    srcBones.get(hipsName)!.getWorldPosition(sp);
    const restS = srcRest.p.get(hipsName)!, restD = dstRest.p.get(hipsName)!;
    const target = new THREE.Vector3(restD.x + (sp.x - restS.x) * k, restD.y + (sp.y - restS.y) * k, restD.z + (sp.z - restS.z) * k);
    dst.getObjectByName(hipsName)!.parent!.worldToLocal(target);
    pv.push(target.x, target.y, target.z);
  }
  action.stop();
  mixer.uncacheRoot(src);
  const tracks: THREE.KeyframeTrack[] = dstBones.map((b) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, qv.get(b.name)!));
  tracks.push(new THREE.VectorKeyframeTrack(`${hipsName}.position`, times, pv));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/** Velocidad a la que avanza el cuerpo en un ciclo sin desplazamiento: 2 × recorrido del pie / duración. */
function strideSpeed(root: THREE.Object3D, clip: THREE.AnimationClip) {
  const mixer = new THREE.AnimationMixer(root);
  const a = mixer.clipAction(clip).play();
  const foot = root.getObjectByName('mixamorigLeftFoot')!;
  const p = new THREE.Vector3();
  let min = Infinity, max = -Infinity;
  const inv = new THREE.Matrix4();
  for (let i = 0; i <= 60; i++) {
    a.time = (clip.duration * i) / 60;
    mixer.update(0);
    root.updateMatrixWorld(true);
    inv.copy(root.matrixWorld).invert();
    p.setFromMatrixPosition(foot.matrixWorld).applyMatrix4(inv);
    min = Math.min(min, p.z); max = Math.max(max, p.z);
  }
  a.stop();
  mixer.uncacheRoot(root);
  return (2 * (max - min) * root.scale.x) / clip.duration;
}

let clipCache: Record<string, THREE.AnimationClip> | null = null;

export function makeCharacterModel(gltf: GLTF, anims: GLTF, tint?: number) {
  const model = SkeletonUtils.clone(gltf.scene) as THREE.Object3D;
  if (!clipCache) {
    const tpose = gltf.animations.find((c) => c.name === 'TPose');
    const dstRest = poseFromClip(model, tpose);
    const srcRest = worldPose(anims.scene);
    clipCache = {};
    for (const c of anims.animations) clipCache[c.name] = retargetClip(anims.scene, srcRest, c, model, dstRest);
    for (const c of gltf.animations) clipCache[c.name] = c;
  }
  // Medir siempre en la misma pose (la T)
  const tp = gltf.animations.find((c) => c.name === 'TPose');
  if (tp) { const m = new THREE.AnimationMixer(model); const a = m.clipAction(tp).play(); m.update(0); a.stop(); m.uncacheRoot(model); }
  const clips = clipCache;
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.roughness = 0.75;
      mat.metalness = 0;
      if (tint) mat.color.setHex(tint);
      m.material = mat;
    }
  });
  // Escalar a la altura real, midiendo el esqueleto en reposo (de la punta del pie a la coronilla)
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  model.traverse((o) => { if ((o as THREE.Bone).isBone) box.expandByPoint(v.setFromMatrixPosition(o.matrixWorld)); });
  const s = HEIGHT / (box.max.y - box.min.y);
  model.scale.multiplyScalar(s);
  const wrap = new THREE.Group();
  wrap.add(model);
  model.position.y = -box.min.y * s;

  return { root: wrap, model, clips, scale: s };
}

export class Player {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  cc: RAPIER.KinematicCharacterController;
  vel = new THREE.Vector3();
  yaw = 0;
  grounded = true;
  private coyote = 0;
  private jumpBuf = 0;
  private prev = new THREE.Vector3();
  private cur = new THREE.Vector3();
  private mixer: THREE.AnimationMixer;
  private act: Record<string, THREE.AnimationAction> = {};
  private w: Record<string, number> = { idle: 1, walk: 0, run: 0, air: 0, dance: 0 };
  private dancing = false;
  private lean = 0;
  private pitch = 0;
  private landing = 0;
  private walkSpeed: number;
  private runSpeed: number;
  speed = 0;

  constructor(public world: RAPIER.World, public root: THREE.Object3D, model: THREE.Object3D, clips: Record<string, THREE.AnimationClip>, start: THREE.Vector3) {
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, start.y + HEIGHT / 2, start.z));
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS).setFriction(0), this.body);
    this.cc = world.createCharacterController(0.03);
    this.cc.enableAutostep(0.38, 0.15, false);
    this.cc.enableSnapToGround(0.35);
    this.cc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.cc.setMinSlopeSlideAngle((35 * Math.PI) / 180);
    this.cc.setApplyImpulsesToDynamicBodies(true);
    this.cc.setCharacterMass(55);
    this.cc.setUp({ x: 0, y: 1, z: 0 });
    this.prev.set(start.x, start.y, start.z);
    this.cur.copy(this.prev);

    this.walkSpeed = strideSpeed(model, clips.walk) || WALK;
    this.runSpeed = strideSpeed(model, clips.run) || RUN;
    this.mixer = new THREE.AnimationMixer(model);
    for (const n of ['idle', 'walk', 'run']) this.act[n] = this.mixer.clipAction(clips[n]).play();
    // Pose en el aire: un instante del ciclo de correr con las piernas recogidas
    const air = this.mixer.clipAction(clips.run.clone());
    air.play(); air.time = clips.run.duration * 0.3; air.timeScale = 0;
    this.act.air = air;
    this.act.dance = this.mixer.clipAction(clips.SambaDance).play();
    for (const k in this.act) this.act[k].setEffectiveWeight(this.w[k]);
  }

  /** Paso fijo de física. dir viene ya girado según la cámara. */
  fixedUpdate(dt: number, inp: MoveInput) {
    const mag = Math.min(1, Math.hypot(inp.x, inp.z));
    const max = inp.run && mag > 0.72 ? RUN : WALK * Math.min(1, mag / 0.72) + 0.0001;
    const tx = mag > 0.05 ? (inp.x / mag) * max * Math.max(mag, 0.3) : 0;
    const tz = mag > 0.05 ? (inp.z / mag) * max * Math.max(mag, 0.3) : 0;
    // Aceleración con inercia: arrancar cuesta un poco y en el aire casi no se puede corregir
    const acc = this.grounded ? (mag > 0.05 ? 9 : 14) : 2.2;
    const dvx = tx - this.vel.x, dvz = tz - this.vel.z;
    const dv = Math.hypot(dvx, dvz), lim = acc * dt;
    if (dv > lim) { this.vel.x += (dvx / dv) * lim; this.vel.z += (dvz / dv) * lim; }
    else { this.vel.x = tx; this.vel.z = tz; }

    if (inp.jump) this.jumpBuf = 0.15;
    this.jumpBuf -= dt;
    this.coyote = this.grounded ? 0.12 : this.coyote - dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vel.y = JUMP_V; this.jumpBuf = 0; this.coyote = 0; this.grounded = false; this.dancing = false;
    }
    this.vel.y -= GRAVITY * dt;
    if (inp.dance && this.grounded) this.dancing = !this.dancing;
    if (mag > 0.1) this.dancing = false;

    const desired = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.cc.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const mv = this.cc.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.cc.computedGrounded();
    if (this.grounded && this.vel.y < 0) {
      if (!wasGrounded && this.vel.y < -3) this.landing = Math.min(1, -this.vel.y / 8);
      this.vel.y = -0.5;
    }
    if (this.vel.y > 0 && mv.y < desired.y * 0.5) this.vel.y = 0; // cabeza contra algo
    // Si una pared nos frena, la velocidad también se pierde (no se acumula empujando)
    if (dt > 0) {
      this.vel.x = THREE.MathUtils.lerp(this.vel.x, mv.x / dt, 0.5);
      this.vel.z = THREE.MathUtils.lerp(this.vel.z, mv.z / dt, 0.5);
    }
    const t = this.body.translation();
    this.prev.copy(this.cur);
    const nx = t.x + mv.x, ny = t.y + mv.y, nz = t.z + mv.z;
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    this.cur.set(nx, ny - HEIGHT / 2, nz);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
  }

  /** Por fotograma: interpola la posición, gira, inclina y mezcla animaciones. */
  update(dt: number, alpha: number) {
    this.root.position.lerpVectors(this.prev, this.cur, alpha);
    const sp = this.speed;
    if (sp > 0.15) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = d * (1 - Math.exp(-10 * dt));
      this.yaw += turn;
      // Inclinación hacia dentro de la curva, proporcional a velocidad × giro
      this.lean = THREE.MathUtils.lerp(this.lean, THREE.MathUtils.clamp(-(turn / Math.max(dt, 1e-3)) * sp * 0.02, -0.22, 0.22), 1 - Math.exp(-8 * dt));
    } else this.lean = THREE.MathUtils.lerp(this.lean, 0, 1 - Math.exp(-8 * dt));
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.grounded ? Math.min(sp / RUN, 1) * 0.07 : 0, 1 - Math.exp(-6 * dt));
    this.root.rotation.set(0, 0, 0);
    this.root.rotateY(this.yaw);
    this.root.rotateZ(-this.lean);
    this.root.rotateX(this.pitch);
    // Aterrizaje: las rodillas absorben el golpe
    this.landing = Math.max(0, this.landing - dt * 4);
    this.root.position.y -= Math.sin(this.landing * Math.PI) * 0.08;

    // Mezcla de animaciones
    const tw: Record<string, number> = { idle: 0, walk: 0, run: 0, air: 0, dance: 0 };
    if (this.dancing) tw.dance = 1;
    else if (!this.grounded && this.coyote <= 0) tw.air = 1;
    else {
      const wr = THREE.MathUtils.smoothstep(sp, this.walkSpeed * 1.1, this.runSpeed * 0.8);
      const moving = THREE.MathUtils.smoothstep(sp, 0.05, 0.6);
      tw.idle = 1 - moving;
      tw.walk = moving * (1 - wr);
      tw.run = moving * wr;
    }
    const k = 1 - Math.exp(-(this.grounded ? 10 : 14) * dt);
    for (const n in tw) {
      this.w[n] += (tw[n] - this.w[n]) * k;
      this.act[n].setEffectiveWeight(this.w[n]);
    }
    // Cadencia ligada a la velocidad para que los pies no resbalen
    const walk = this.act.walk, run = this.act.run;
    walk.timeScale = THREE.MathUtils.clamp(sp / this.walkSpeed, 0.5, 2.2);
    run.timeScale = THREE.MathUtils.clamp(sp / this.runSpeed, 0.6, 1.6);
    if (this.w.walk > 0.05 && this.w.run > 0.05) {
      // Mientras se funden, la carrera sigue la fase del paso (mismo pie en el suelo)
      const ph = walk.time / walk.getClip().duration;
      run.time = ph * run.getClip().duration;
      const blend = this.w.run / (this.w.run + this.w.walk);
      const rate = THREE.MathUtils.lerp(sp / this.walkSpeed / walk.getClip().duration, sp / this.runSpeed / run.getClip().duration, blend);
      walk.timeScale = rate * walk.getClip().duration;
      run.timeScale = rate * run.getClip().duration;
    }
    this.mixer.update(dt);
  }

  get position() { return this.root.position; }
}

/** Personajes de ambiente: un modelo animado con su colisionador fijo. */
export function makeNPC(world: RAPIER.World, parts: ReturnType<typeof makeCharacterModel>, clip: string, pos: THREE.Vector3, yaw: number, offset = 0) {
  const mixer = new THREE.AnimationMixer(parts.model);
  const a = mixer.clipAction(parts.clips[clip]).play();
  a.time = offset;
  parts.root.position.copy(pos);
  parts.root.rotation.y = yaw;
  world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS).setTranslation(pos.x, pos.y + HEIGHT / 2, pos.z));
  return mixer;
}
