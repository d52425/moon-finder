<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSensors } from '../composables/useSensors'
import { getMoonData, formatBearing, formatTime, formatLatLon } from '../utils/moon'
import {
  createMoonScene,
  applyDeviceOrientation,
  getCameraHeading,
  angleToTarget,
  getMoonGuide,
  getMoonScreenOffset,
} from './MoonScene.js'
import MoonGuide from './MoonGuide.vue'
import MoonCompass from './MoonCompass.vue'

const canvasRef = ref(null)
const started = ref(false)
const loading = ref(false)
const showDetails = ref(false)
const angleDiff = ref(null)
const moonData = ref(null)
const guide = ref({ angle: 0, distance: null, turnText: '' })
const moonScreen = ref({ onScreen: false, x: 0, y: 0 })
const cameraHeading = ref(null)
const compassOffset = ref(Number(localStorage.getItem('compassOffset') || 0))

const sensors = useSensors()
const {
  isSecureContext,
  lat, lon, geoError, geoReady, manualLocation,
  alpha, beta, gamma, compassHeading, orientationAbsolute,
  orientationReady, orientationError, needsPermission,
  setManualLocation, startGeolocation, startOrientation,
} = sensors

const manualLat = ref('35.6762')
const manualLon = ref('139.6503')
const showManualForm = ref(false)

const isMoonVisible = computed(() => moonData.value && moonData.value.altitude > 0)
const hasOrientation = computed(() => orientationReady.value)
const arMode = computed(() => started.value && hasOrientation.value && geoReady.value)
const isAligned = computed(() => arMode.value && angleDiff.value != null && angleDiff.value < 8)

const statusText = computed(() => {
  if (!started.value) return 'スマホを構えて月の方向を探しましょう'
  if (!geoReady.value) return '位置情報を取得中…'
  if (!moonData.value) return '月の位置を計算中…'
  if (!hasOrientation.value) return 'コンパスモード（スマホでは HTTPS + センサー許可が必要）'
  if (!isMoonVisible.value) return '月は地平線の向こう — 照準の方向へスマホを向けてください'
  if (isAligned.value) return 'スマホが月の方向を向いています'
  return guide.value.turnText
    ? `スマホを${guide.value.turnText}`
    : 'ゆっくりスマホを動かして照準を月に合わせてください'
})

let sceneApi = null
let tickTimer = null
let wasAligned = false

function updateMoon() {
  if (lat.value == null || lon.value == null) return
  moonData.value = getMoonData(lat.value, lon.value)
}

async function start() {
  loading.value = true
  startGeolocation()
  await startOrientation()
  started.value = true
  showManualForm.value = !isSecureContext.value || !!geoError.value
  loading.value = false
}

function applyManualLocation() {
  const la = parseFloat(manualLat.value)
  const lo = parseFloat(manualLon.value)
  if (Number.isNaN(la) || Number.isNaN(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
    geoError.value = '緯度（-90〜90）・経度（-180〜180）を正しく入力してください'
    return
  }
  setManualLocation(la, lo)
  showManualForm.value = false
  updateMoon()
}

function tick() {
  updateMoon()
  if (!sceneApi || !moonData.value) return

  const { x, y, z } = moonData.value.vector
  sceneApi.moon.position.set(x, y, z)

  const belowHorizon = moonData.value.altitude <= 0
  sceneApi.setArMode(arMode.value)

  if (arMode.value) {
    sceneApi.arrow.visible = false
    const screenOrientation = window.screen?.orientation?.angle ?? window.orientation ?? 0
    const heading = compassHeading.value ?? alpha.value
    applyDeviceOrientation(
      sceneApi.camera,
      heading,
      beta.value,
      gamma.value,
      screenOrientation,
      compassOffset.value,
    )
    cameraHeading.value = getCameraHeading(sceneApi.camera)
    sceneApi.moon.lookAt(sceneApi.camera.position)
    angleDiff.value = angleToTarget(sceneApi.camera, moonData.value.vector)
    guide.value = getMoonGuide(sceneApi.camera, moonData.value.vector)
    moonScreen.value = getMoonScreenOffset(sceneApi.camera, moonData.value.vector)

    if (isAligned.value && !wasAligned) {
      navigator.vibrate?.(80)
    }
    wasAligned = isAligned.value
  } else {
    wasAligned = false
    angleDiff.value = null
    guide.value = { angle: 0, distance: null, turnText: '' }
    moonScreen.value = { onScreen: false, x: 0, y: 0 }

    sceneApi.arrow.visible = belowHorizon || !hasOrientation.value
    if (sceneApi.arrow.visible) {
      const bearing = (moonData.value.bearing * Math.PI) / 180
      sceneApi.arrow.position.set(0, 1.6, 0)
      sceneApi.arrow.rotation.set(0, bearing, 0)
    }

    sceneApi.camera.position.set(0, 8, 20)
    sceneApi.camera.lookAt(x * 0.3, y * 0.3 + 2, z * 0.3)
    sceneApi.moon.lookAt(0, 1.6, 0)
  }
}

watch(arMode, (on) => {
  if (on) showDetails.value = false
})

onMounted(() => {
  sceneApi = createMoonScene(canvasRef.value)
  sceneApi.startLoop(tick)
  tickTimer = setInterval(updateMoon, 30_000)
})

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer)
  sceneApi?.dispose()
  sensors.stop()
})
</script>

<template>
  <div class="finder" :class="{ 'ar-mode': arMode, aligned: isAligned }">
    <div ref="canvasRef" class="canvas" />

    <div class="hud">
      <header class="hud-header" :class="{ minimal: arMode }">
        <h1>月を探す</h1>
        <p v-if="!arMode" class="subtitle">Point your phone at the moon</p>
      </header>

      <MoonGuide
        v-if="arMode"
        :active="true"
        :aligned="isAligned"
        :below-horizon="!isMoonVisible"
        :guide-angle="guide.angle"
        :turn-text="guide.turnText"
        :distance="guide.distance"
        :moon-on-screen="moonScreen.onScreen"
        :moon-screen-x="moonScreen.x"
        :moon-screen-y="moonScreen.y"
      />

      <div v-if="!started" class="overlay start-panel">
        <div class="card">
          <div class="card-icon">☽</div>
          <p class="card-lead">
            スマホを<strong>カメラのように構え</strong>、空に向けてゆっくり動かします。
            画面中央の照準と月が重なると、月の方向です。
          </p>
          <ol class="card-steps">
            <li>スマホを胸の高さで構える</li>
            <li>空に向けてゆっくり左右・上下に動かす</li>
            <li>照準の中心に ☽ が入るまで探す</li>
          </ol>
          <button class="btn-primary" :disabled="loading" @click="start">
            {{ loading ? '準備中…' : 'スマホを構える' }}
          </button>
          <p v-if="!isSecureContext" class="hint warn-hint">
            スマホからは <strong>https://</strong> でアクセスしてください
          </p>
          <p v-if="needsPermission" class="hint">
            iOS：「モーションと画面の向き」を許可してください
          </p>
        </div>
      </div>

      <div v-if="started && showManualForm" class="overlay manual-panel">
        <div class="card">
          <p class="card-lead">位置情報が使えないため、手動で場所を入力してください。</p>
          <div class="manual-fields">
            <label>
              <span>緯度</span>
              <input v-model="manualLat" type="text" inputmode="decimal" placeholder="35.6762" />
            </label>
            <label>
              <span>経度</span>
              <input v-model="manualLon" type="text" inputmode="decimal" placeholder="139.6503" />
            </label>
          </div>
          <button class="btn-primary" @click="applyManualLocation">この位置で計算</button>
        </div>
      </div>

      <div v-if="started && !arMode && moonData" class="compass-fallback">
        <MoonCompass
          :bearing="moonData.bearing"
          :altitude="moonData.altitude"
          :heading="null"
          :aligned="false"
        />
        <p class="fallback-hint">スマホでセンサーを有効にすると AR 照準モードになります</p>
      </div>

      <button
        v-if="started && moonData && arMode"
        class="details-toggle"
        @click="showDetails = !showDetails"
      >
        {{ showDetails ? '閉じる' : '詳細' }}
      </button>

      <div v-if="started && moonData && showDetails" class="info-panel">
        <div class="info-grid">
          <div class="info-item">
            <span class="label">方位</span>
            <span class="value">{{ formatBearing(moonData.bearing) }}</span>
          </div>
          <div class="info-item">
            <span class="label">高度</span>
            <span class="value" :class="{ below: moonData.altitude <= 0 }">
              {{ moonData.altitude.toFixed(1) }}°
            </span>
          </div>
          <div class="info-item">
            <span class="label">月相</span>
            <span class="value">{{ moonData.phaseName }}</span>
          </div>
          <div class="info-item">
            <span class="label">照度</span>
            <span class="value">{{ (moonData.fraction * 100).toFixed(0) }}%</span>
          </div>
        </div>
        <div class="times" v-if="moonData.times">
          <span>月の出 {{ formatTime(moonData.times.rise) }}</span>
          <span>月の入り {{ formatTime(moonData.times.set) }}</span>
        </div>
        <div class="coords" v-if="geoReady">
          <p class="coords-title">座標・コンパス</p>
          <dl class="coords-list">
            <div class="coords-row">
              <dt>地点</dt>
              <dd>{{ formatLatLon(lat, lon) }}</dd>
            </div>
            <div class="coords-row">
              <dt>月の方位</dt>
              <dd>{{ formatBearing(moonData.bearing) }}</dd>
            </div>
            <div class="coords-row">
              <dt>月の高度</dt>
              <dd>{{ moonData.altitude.toFixed(1) }}°</dd>
            </div>
            <div v-if="compassHeading != null" class="coords-row">
              <dt>コンパス</dt>
              <dd>{{ formatBearing(compassHeading) }}</dd>
            </div>
            <div v-if="cameraHeading != null" class="coords-row">
              <dt>向き認識</dt>
              <dd>{{ formatBearing(cameraHeading) }}</dd>
            </div>
            <div class="coords-row">
              <dt>センサー</dt>
              <dd>{{ orientationAbsolute ? '絶対方位' : '相対（要補正）' }}</dd>
            </div>
          </dl>
          <label class="calibrate" v-if="arMode">
            <span>コンパス補正 {{ compassOffset > 0 ? '+' : '' }}{{ compassOffset }}°</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              v-model.number="compassOffset"
              @change="localStorage.setItem('compassOffset', compassOffset)"
            />
            <span class="calibrate-hint">北を向けてずれを直してください</span>
          </label>
        </div>
      </div>

      <footer class="status-bar" :class="{ aligned: isAligned }">
        <span
          class="status-dot"
          :class="{
            ready: geoReady && moonData,
            aligned: isAligned,
            warn: !isMoonVisible && moonData,
          }"
        />
        <span class="status-text">{{ statusText }}</span>
        <span v-if="angleDiff != null" class="angle-diff">
          {{ angleDiff.toFixed(0) }}°
        </span>
      </footer>

      <p v-if="geoError && !showManualForm" class="error" @click="showManualForm = true">
        {{ geoError }}
        <span class="error-action">タップして手動入力</span>
      </p>
      <p v-if="manualLocation && geoReady" class="manual-badge">手動設定の位置</p>
      <p v-if="orientationError && !arMode" class="error subtle">{{ orientationError }}</p>
      <p v-if="arMode && !orientationAbsolute" class="calibrate-banner">
        相対コンパスモード — 「詳細」から補正してください
      </p>
    </div>
  </div>
</template>

<style scoped>
.finder {
  position: relative;
  width: 100%;
  height: 100%;
}

.finder.ar-mode .canvas {
  opacity: 1;
}

.finder.aligned .canvas {
  filter: none;
}

.canvas {
  position: absolute;
  inset: 0;
}

.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: env(safe-area-inset-top, 12px) 16px env(safe-area-inset-bottom, 12px);
}

.hud-header {
  text-align: center;
  padding-top: 4px;
  transition: opacity 0.3s;
}

.hud-header.minimal {
  opacity: 0.5;
}

.hud-header.minimal h1 {
  font-size: 0.85rem;
}

.hud-header h1 {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.subtitle {
  font-size: 0.65rem;
  color: #7ec8e3;
  letter-spacing: 0.12em;
  margin-top: 2px;
  opacity: 0.7;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 8, 16, 0.82);
  backdrop-filter: blur(8px);
  pointer-events: auto;
}

.card {
  max-width: 340px;
  padding: 28px 24px;
  background: rgba(15, 20, 36, 0.95);
  border: 1px solid rgba(126, 200, 227, 0.2);
  border-radius: 20px;
  text-align: center;
}

.card-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
  filter: drop-shadow(0 0 12px rgba(255, 248, 231, 0.4));
}

.card-lead {
  font-size: 0.92rem;
  line-height: 1.7;
  color: #c8d0e0;
  margin-bottom: 16px;
}

.card-lead strong {
  color: #fff8e7;
}

.card-steps {
  text-align: left;
  font-size: 0.85rem;
  color: #8a94a8;
  line-height: 1.9;
  margin-bottom: 24px;
  padding-left: 20px;
}

.btn-primary {
  width: 100%;
  padding: 16px 24px;
  background: linear-gradient(135deg, #4a8fd4, #2a5f8f);
  color: #fff;
  border-radius: 14px;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  transition: transform 0.15s;
  pointer-events: auto;
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-primary:disabled {
  opacity: 0.6;
}

.hint {
  margin-top: 12px;
  font-size: 0.75rem;
  color: #6a7488;
  line-height: 1.5;
}

.warn-hint {
  color: #f0a050;
}

.manual-fields {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
  text-align: left;
}

.manual-fields label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
  color: #8a94a8;
}

.manual-fields input {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(126, 200, 227, 0.25);
  background: rgba(10, 14, 26, 0.8);
  color: #e8ecf4;
  font-size: 1rem;
  pointer-events: auto;
}

.compass-fallback {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -55%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.fallback-hint {
  font-size: 0.72rem;
  color: #6a7488;
  text-align: center;
  max-width: 220px;
}

.details-toggle {
  position: absolute;
  top: env(safe-area-inset-top, 12px);
  right: 16px;
  padding: 6px 14px;
  background: rgba(10, 14, 26, 0.6);
  border: 1px solid rgba(126, 200, 227, 0.25);
  border-radius: 8px;
  color: #7ec8e3;
  font-size: 0.75rem;
  pointer-events: auto;
}

.info-panel {
  position: absolute;
  bottom: 72px;
  left: 16px;
  right: 16px;
  padding: 14px 16px;
  background: rgba(5, 8, 16, 0.85);
  border: 1px solid rgba(126, 200, 227, 0.15);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  pointer-events: auto;
  max-height: 40vh;
  overflow-y: auto;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: 0.7rem;
  color: #6a7488;
}

.value {
  font-size: 0.95rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.value.below {
  color: #ffd166;
}

.times {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(126, 200, 227, 0.1);
  font-size: 0.72rem;
  color: #8a94a8;
}

.coords {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(126, 200, 227, 0.1);
}

.coords-title {
  font-size: 0.68rem;
  color: #7ec8e3;
  margin-bottom: 6px;
}

.coords-list {
  display: grid;
  gap: 4px;
}

.coords-row {
  display: grid;
  grid-template-columns: 3.5em 1fr;
  gap: 8px;
  font-size: 0.72rem;
}

.coords-row dt {
  color: #6a7488;
}

.coords-row dd {
  color: #c8d0e0;
  font-variant-numeric: tabular-nums;
}

.calibrate {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(126, 200, 227, 0.1);
  font-size: 0.72rem;
  color: #8a94a8;
  pointer-events: auto;
}

.calibrate input[type='range'] {
  width: 100%;
  accent-color: #7ec8e3;
}

.calibrate-hint {
  font-size: 0.65rem;
  color: #6a7488;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(5, 8, 16, 0.75);
  border-radius: 10px;
  backdrop-filter: blur(6px);
  transition: background 0.3s;
}

.status-bar.aligned {
  background: rgba(110, 231, 160, 0.15);
  border: 1px solid rgba(110, 231, 160, 0.3);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4a5568;
  flex-shrink: 0;
  transition: background 0.3s, box-shadow 0.3s;
}

.status-dot.ready { background: #7ec8e3; }
.status-dot.aligned { background: #6ee7a0; box-shadow: 0 0 8px #6ee7a0; }
.status-dot.warn { background: #ffd166; }

.status-text {
  flex: 1;
  font-size: 0.78rem;
  color: #c8d0e0;
}

.angle-diff {
  font-size: 0.82rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #7ec8e3;
}

.status-bar.aligned .angle-diff {
  color: #6ee7a0;
}

.manual-badge {
  position: absolute;
  top: 48px;
  right: 16px;
  padding: 3px 8px;
  background: rgba(240, 160, 80, 0.2);
  border-radius: 6px;
  font-size: 0.65rem;
  color: #f0a050;
}

.error {
  position: absolute;
  bottom: 68px;
  left: 16px;
  right: 16px;
  padding: 10px 14px;
  background: rgba(180, 50, 50, 0.85);
  border-radius: 8px;
  font-size: 0.78rem;
  text-align: center;
  pointer-events: auto;
}

.error.subtle {
  background: rgba(60, 50, 30, 0.85);
  color: #f0a050;
}

.error-action {
  display: block;
  margin-top: 4px;
  font-size: 0.72rem;
  text-decoration: underline;
}

.calibrate-banner {
  position: absolute;
  top: 48px;
  left: 16px;
  right: 16px;
  padding: 6px 12px;
  background: rgba(240, 160, 80, 0.15);
  border: 1px solid rgba(240, 160, 80, 0.35);
  border-radius: 8px;
  font-size: 0.72rem;
  color: #f0a050;
  text-align: center;
}
</style>