import * as THREE from 'three'

const SKY_RADIUS = 100
const MOON_RADIUS = 4.5

function createStarField() {
  const count = 1200
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = SKY_RADIUS * 0.97
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.cos(phi)
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.4,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
  })
  return new THREE.Points(geo, mat)
}

function createHorizon() {
  const group = new THREE.Group()

  const ringGeo = new THREE.RingGeometry(47, 48.5, 64)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x3d5a80,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = -Math.PI / 2
  group.add(ring)

  const grid = new THREE.GridHelper(96, 16, 0x2a3f5f, 0x1a2840)
  grid.position.y = 0.01
  group.add(grid)

  return group
}

function createMoon() {
  const group = new THREE.Group()

  const moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 32, 32)
  const moonMat = new THREE.MeshStandardMaterial({
    color: 0xf0e6d3,
    emissive: 0xc8b89a,
    emissiveIntensity: 0.5,
    roughness: 0.85,
    metalness: 0.05,
  })
  const moon = new THREE.Mesh(moonGeo, moonMat)
  group.add(moon)

  const glowGeo = new THREE.SphereGeometry(MOON_RADIUS * 2.2, 16, 16)
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xfff8e7,
    transparent: true,
    opacity: 0.18,
  })
  const glow = new THREE.Mesh(glowGeo, glowMat)
  group.add(glow)

  return group
}

function createArrowIndicator() {
  const group = new THREE.Group()
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 20, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.7 }),
  )
  shaft.position.y = 10
  group.add(shaft)

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 4, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  )
  head.position.y = 22
  group.add(head)

  return group
}

export function createMoonScene(container) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050810)

  const camera = new THREE.PerspectiveCamera(
    70,
    container.clientWidth / container.clientHeight,
    0.1,
    500,
  )
  camera.position.set(0, 1.6, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0x4466aa, 0.5))
  const dirLight = new THREE.DirectionalLight(0xfff5e6, 1)
  dirLight.position.set(30, 50, -20)
  scene.add(dirLight)

  const stars = createStarField()
  scene.add(stars)

  const horizon = createHorizon()
  scene.add(horizon)

  const moon = createMoon()
  scene.add(moon)

  const arrow = createArrowIndicator()
  arrow.visible = false
  scene.add(arrow)

  let animationId = null

  function resize() {
    const w = container.clientWidth
    const h = container.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  window.addEventListener('resize', resize)

  function dispose() {
    window.removeEventListener('resize', resize)
    if (animationId) cancelAnimationFrame(animationId)
    renderer.dispose()
    container.removeChild(renderer.domElement)
  }

  return {
    scene,
    camera,
    renderer,
    stars,
    horizon,
    moon,
    arrow,
    dispose,
    setArMode(enabled) {
      horizon.visible = !enabled
      stars.visible = true
      scene.background.setHex(enabled ? 0x020408 : 0x050810)
      scene.fog = enabled ? null : new THREE.Fog(0x050810, 80, 200)
    },
    startLoop(callback) {
      const loop = () => {
        callback()
        renderer.render(scene, camera)
        animationId = requestAnimationFrame(loop)
      }
      loop()
    },
  }
}

/**
 * コンパス方位 + 加速度計でカメラ向きを設定
 * 世界座標: Y=上, -Z=北, +X=東
 */
export function applyDeviceOrientation(camera, heading, beta, gamma, screenOrientation = 0, offset = 0) {
  const d = Math.PI / 180
  const yaw = (heading + offset - screenOrientation + 360) % 360 * d
  const pitch = (90 - beta) * d
  const roll = -gamma * d

  camera.position.set(0, 1.6, 0)
  camera.rotation.set(pitch, yaw, roll, 'YXZ')
}

/** カメラが向いている方位（北=0°, 時計回り） */
export function getCameraHeading(camera) {
  camera.getWorldDirection(_camDir)
  _camDir.y = 0
  if (_camDir.lengthSq() < 1e-6) return 0
  _camDir.normalize()
  return (Math.atan2(_camDir.x, -_camDir.z) * (180 / Math.PI) + 360) % 360
}

const _camDir = new THREE.Vector3()
const _toMoon = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _moonWorld = new THREE.Vector3()

/** カメラ前方と月の角度差（度） */
export function angleToTarget(camera, target) {
  camera.getWorldDirection(_camDir)
  _toMoon.set(target.x, target.y, target.z).normalize()
  const dot = _camDir.dot(_toMoon)
  return Math.acos(Math.min(1, Math.max(-1, dot))) * (180 / Math.PI)
}

/** 月の方向ガイド（AR照準用） */
export function getMoonGuide(camera, target) {
  camera.getWorldDirection(_camDir)
  _toMoon.set(target.x, target.y, target.z).normalize()

  _right.setFromMatrixColumn(camera.matrixWorld, 0)
  _up.setFromMatrixColumn(camera.matrixWorld, 1)

  const horiz = _toMoon.dot(_right)
  const vert = _toMoon.dot(_up)
  const angle = Math.atan2(horiz, vert) * (180 / Math.PI)
  const distance = angleToTarget(camera, target)

  let turnText = ''
  if (distance > 8) {
    if (Math.abs(horiz) >= Math.abs(vert)) {
      turnText = horiz > 0 ? '右に向ける' : '左に向ける'
    } else {
      turnText = vert > 0 ? '上に向ける' : '下に向ける'
    }
  }

  return { angle, distance, horiz, vert, turnText }
}

/** 月が画面上のどこにあるか（照準とのずれ） */
export function getMoonScreenOffset(camera, target) {
  _moonWorld.set(target.x, target.y, target.z)
  const projected = _moonWorld.clone().project(camera)
  const onScreen =
    projected.z < 1 &&
    projected.x >= -1.2 && projected.x <= 1.2 &&
    projected.y >= -1.2 && projected.y <= 1.2

  return {
    onScreen,
    x: projected.x,
    y: projected.y,
  }
}