<script setup>
import { computed } from 'vue'
import { relativeBearing } from '../utils/moon'

const props = defineProps({
  bearing: { type: Number, required: true },
  altitude: { type: Number, default: 0 },
  heading: { type: Number, default: null },
  aligned: { type: Boolean, default: false },
})

const hasHeading = computed(() => props.heading != null)

/** 矢印の回転角（上=0°、時計回り） */
const arrowRotation = computed(() => {
  if (hasHeading.value) {
    return relativeBearing(props.bearing, props.heading)
  }
  return props.bearing
})

const dialRotation = computed(() => (hasHeading.value ? -props.heading : 0))

const belowHorizon = computed(() => props.altitude <= 0)
</script>

<template>
  <div class="compass" :class="{ aligned, below: belowHorizon }">
    <div class="compass-ring" :style="{ transform: `rotate(${dialRotation}deg)` }">
      <span class="mark mark-n">北</span>
      <span class="mark mark-e">東</span>
      <span class="mark mark-s">南</span>
      <span class="mark mark-w">西</span>
      <svg class="ring-svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1" opacity="0.35" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.2" stroke-dasharray="2 4" />
      </svg>
    </div>

    <div class="arrow-wrap" :style="{ transform: `rotate(${arrowRotation}deg)` }">
      <svg class="arrow-svg" viewBox="0 0 40 120" aria-hidden="true">
        <defs>
          <linearGradient id="arrowGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.2" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="1" />
          </linearGradient>
        </defs>
        <path
          d="M20 110 L20 30 M20 30 L8 50 M20 30 L32 50"
          fill="none"
          stroke="url(#arrowGrad)"
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="20" cy="18" r="9" fill="currentColor" opacity="0.9" />
        <text x="20" y="22" text-anchor="middle" font-size="11" fill="#0a0e1a">☽</text>
      </svg>
    </div>

    <div class="center-dot" />

    <p class="hint">
      <template v-if="aligned">月の方向です</template>
      <template v-else-if="hasHeading">スマホを矢印の方向に向けてください</template>
      <template v-else-if="belowHorizon">月は地平線の向こう（方位のみ）</template>
      <template v-else>北を上にして、矢印の方向へ向けてください</template>
    </p>
  </div>
</template>

<style scoped>
.compass {
  position: relative;
  width: 180px;
  height: 180px;
  color: #ffd166;
  transition: color 0.3s;
}

.compass.aligned {
  color: #6ee7a0;
}

.compass.below:not(.aligned) {
  color: #f0a050;
}

.compass-ring {
  position: absolute;
  inset: 0;
  transition: transform 0.1s linear;
}

.ring-svg {
  width: 100%;
  height: 100%;
  color: #7ec8e3;
}

.mark {
  position: absolute;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #8a94a8;
  transform: translate(-50%, -50%);
}

.mark-n {
  top: 6%;
  left: 50%;
  color: #ff6b6b;
}

.mark-e {
  top: 50%;
  left: 94%;
}

.mark-s {
  top: 94%;
  left: 50%;
}

.mark-w {
  top: 50%;
  left: 6%;
}

.arrow-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  padding-top: 8px;
  transition: transform 0.1s linear;
  filter: drop-shadow(0 0 6px rgba(255, 209, 102, 0.4));
}

.compass.aligned .arrow-wrap {
  filter: drop-shadow(0 0 8px rgba(110, 231, 160, 0.6));
}

.arrow-svg {
  width: 36px;
  height: 108px;
}

.center-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: #3d5a80;
  border: 2px solid rgba(126, 200, 227, 0.5);
}

.hint {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 220px;
  font-size: 0.72rem;
  color: #8a94a8;
  text-align: center;
  line-height: 1.4;
}
</style>