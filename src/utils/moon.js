import { getMoonPosition, getMoonIllumination, getMoonTimes } from 'suncalc'

/**
 * suncalc v2: azimuth は既に北基準・度（0=北, 90=東, 180=南, 270=西）
 * altitude も度。v1 互換のため関数は残すが入力はそのまま返す。
 */
export function azimuthToBearingDeg(azimuthDeg) {
  return ((azimuthDeg % 360) + 360) % 360
}

/** 方位角（北=0°, 時計回り）と高度角（度）から Three.js 座標（Y=上） */
export function celestialToVector(bearingDeg, altitudeDeg, radius = 50) {
  const bearing = (bearingDeg * Math.PI) / 180
  const alt = (altitudeDeg * Math.PI) / 180
  const cosAlt = Math.cos(alt)
  return {
    x: cosAlt * Math.sin(bearing) * radius,
    y: Math.sin(alt) * radius,
    z: -cosAlt * Math.cos(bearing) * radius,
  }
}

export function getMoonData(lat, lon, date = new Date()) {
  const pos = getMoonPosition(date, lat, lon)
  const illum = getMoonIllumination(date)
  const times = getMoonTimes(date, lat, lon)

  const bearing = azimuthToBearingDeg(pos.azimuth)
  const altitude = pos.altitude

  const phaseNames = [
    '新月', '三日月', '上弦', '十三夜',
    '満月', '寝待月', '下弦', '有明月',
  ]
  const phaseIndex = Math.round(illum.phase * 8) % 8

  return {
    bearing,
    altitude,
    azimuth: pos.azimuth,
    distance: pos.distance,
    parallacticAngle: pos.parallacticAngle,
    fraction: illum.fraction,
    phase: illum.phase,
    phaseName: phaseNames[phaseIndex],
    times,
    vector: celestialToVector(bearing, altitude),
  }
}

export function formatLatLon(lat, lon) {
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`
  const lonStr = `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`
  return `${latStr}, ${lonStr}`
}

/** 基準方位から目標方位への相対角度（-180〜180、正=右回転） */
export function relativeBearing(targetDeg, headingDeg) {
  return ((targetDeg - headingDeg + 540) % 360) - 180
}

export function formatBearing(deg) {
  const dirs = ['北', '北東', '東', '南東', '南', '南西', '西', '北西']
  const index = Math.round(deg / 45) % 8
  return `${dirs[index]} ${deg.toFixed(1)}°`
}

export function formatTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}