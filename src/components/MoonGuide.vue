<script setup>
import { computed } from 'vue'

const props = defineProps({
  active: { type: Boolean, default: false },
  aligned: { type: Boolean, default: false },
  belowHorizon: { type: Boolean, default: false },
  guideAngle: { type: Number, default: 0 },
  turnText: { type: String, default: '' },
  distance: { type: Number, default: null },
  moonOnScreen: { type: Boolean, default: false },
  moonScreenX: { type: Number, default: 0 },
  moonScreenY: { type: Number, default: 0 },
})

const showEdgeArrow = computed(
  () => props.active && !props.aligned && props.distance != null && props.distance > 8,
)

const moonMarkerStyle = computed(() => {
  if (!props.moonOnScreen || props.aligned) return null
  const x = ((props.moonScreenX + 1) / 2) * 100
  const y = ((1 - props.moonScreenY) / 2) * 100
  return { left: `${x}%`, top: `${y}%` }
})
</script>

<template>
  <div v-if="active" class="guide" :class="{ aligned, below: belowHorizon }">
    <div class="reticle" aria-hidden="true">
      <div class="reticle-ring" />
      <div class="reticle-h" />
      <div class="reticle-v" />
      <div class="reticle-dot" />
    </div>

    <div
      v-if="showEdgeArrow"
      class="edge-arrow"
      :style="{ transform: `translate(-50%, -50%) rotate(${guideAngle}deg)` }"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 48" class="edge-arrow-svg">
        <path d="M12 44 L12 8 M12 8 L4 20 M12 8 L20 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </svg>
    </div>

    <div
      v-if="moonMarkerStyle && !aligned"
      class="moon-marker"
      :style="moonMarkerStyle"
      aria-hidden="true"
    >☽</div>

    <div v-if="aligned" class="aligned-badge">月の方向！</div>

    <p v-else-if="turnText" class="turn-hint">{{ turnText }}</p>
    <p v-else-if="belowHorizon" class="turn-hint below-hint">地平線の向こう — 照準の方向へ向けてください</p>
    <p v-else class="turn-hint">ゆっくりスマホを動かして ☽ を照準の中心へ</p>
  </div>
</template>

<style scoped>
.guide {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.reticle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 72px;
  height: 72px;
  transform: translate(-50%, -50%);
}

.reticle-ring {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(126, 200, 227, 0.6);
  border-radius: 50%;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.reticle-h,
.reticle-v {
  position: absolute;
  background: rgba(126, 200, 227, 0.5);
  transition: background 0.3s;
}

.reticle-h {
  top: 50%;
  left: 8px;
  right: 8px;
  height: 1px;
  margin-top: -0.5px;
}

.reticle-v {
  left: 50%;
  top: 8px;
  bottom: 8px;
  width: 1px;
  margin-left: -0.5px;
}

.reticle-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  margin: -2px 0 0 -2px;
  border-radius: 50%;
  background: #7ec8e3;
  transition: background 0.3s;
}

.guide.aligned .reticle-ring {
  border-color: #6ee7a0;
  box-shadow: 0 0 20px rgba(110, 231, 160, 0.5);
}

.guide.aligned .reticle-h,
.guide.aligned .reticle-v,
.guide.aligned .reticle-dot {
  background: #6ee7a0;
}

.guide.below .reticle-ring {
  border-color: rgba(255, 209, 102, 0.6);
}

.edge-arrow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 56px;
  margin-top: -120px;
  color: #ffd166;
  filter: drop-shadow(0 0 8px rgba(255, 209, 102, 0.5));
  transition: transform 0.1s linear;
}

.guide.aligned .edge-arrow {
  display: none;
}

.edge-arrow-svg {
  width: 100%;
  height: 100%;
}

.moon-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: 1.6rem;
  color: #fff8e7;
  text-shadow: 0 0 12px rgba(255, 248, 231, 0.8);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
}

.aligned-badge {
  position: absolute;
  top: calc(50% + 56px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 20px;
  background: rgba(110, 231, 160, 0.2);
  border: 1px solid rgba(110, 231, 160, 0.6);
  border-radius: 20px;
  font-size: 1rem;
  font-weight: 600;
  color: #6ee7a0;
  letter-spacing: 0.1em;
  animation: pop 0.4s ease-out;
}

@keyframes pop {
  from { transform: translateX(-50%) scale(0.8); opacity: 0; }
  to { transform: translateX(-50%) scale(1); opacity: 1; }
}

.turn-hint {
  position: absolute;
  top: calc(50% + 52px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.85rem;
  color: #c8d0e0;
  text-align: center;
  white-space: nowrap;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.below-hint {
  color: #ffd166;
}
</style>