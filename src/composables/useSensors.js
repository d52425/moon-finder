import { ref, onUnmounted } from 'vue'

const INSECURE_MSG =
  '位置情報・コンパスには HTTPS が必要です。https:// でアクセスするか、手動で位置を入力してください。'

/** iOS / 各ブラウザからコンパス方位（北=0°, 時計回り）を取り出す */
function extractCompassHeading(event) {
  if (event.webkitCompassHeading != null && !Number.isNaN(event.webkitCompassHeading)) {
    return event.webkitCompassHeading
  }
  if (event.alpha == null) return null
  // absolute イベントなら alpha が北基準
  if (event.absolute) return event.alpha
  // 相対イベント（iOS 等）: alpha は北から反時計回り → 北基準時計回りに変換
  return (360 - event.alpha + 360) % 360
}

export function useSensors() {
  const isSecureContext = ref(
    typeof window !== 'undefined' ? window.isSecureContext : true,
  )

  const lat = ref(null)
  const lon = ref(null)
  const geoError = ref(null)
  const geoReady = ref(false)
  const manualLocation = ref(false)

  const alpha = ref(0)
  const beta = ref(0)
  const gamma = ref(0)
  const compassHeading = ref(null)
  const orientationAbsolute = ref(false)
  const orientationReady = ref(false)
  const orientationError = ref(null)
  const needsPermission = ref(
    typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function',
  )

  let geoWatchId = null

  function setManualLocation(newLat, newLon) {
    lat.value = newLat
    lon.value = newLon
    geoReady.value = true
    manualLocation.value = true
    geoError.value = null
  }

  function startGeolocation() {
    if (!navigator.geolocation) {
      geoError.value = '位置情報が利用できません'
      return
    }

    if (!isSecureContext.value) {
      geoError.value = INSECURE_MSG
      return
    }

    geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        lat.value = pos.coords.latitude
        lon.value = pos.coords.longitude
        geoReady.value = true
        manualLocation.value = false
        geoError.value = null
      },
      (err) => {
        const msg = err.message || ''
        geoError.value = msg.includes('secure origin') || msg.includes('Only secure')
          ? INSECURE_MSG
          : msg || '位置情報の取得に失敗しました'
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    )
  }

  function onOrientation(event) {
    if (event.beta == null && event.alpha == null) return

    const heading = extractCompassHeading(event)
    if (heading != null) {
      compassHeading.value = heading
      alpha.value = heading
    } else if (event.alpha != null) {
      alpha.value = event.alpha
    }

    beta.value = event.beta ?? 0
    gamma.value = event.gamma ?? 0
    orientationAbsolute.value = !!event.absolute || event.webkitCompassHeading != null
    orientationReady.value = true
  }

  async function startOrientation() {
    orientationError.value = null

    if (!isSecureContext.value) {
      orientationError.value = 'コンパスには HTTPS でのアクセスが必要です（方位矢印は利用可能）'
      return false
    }

    if (needsPermission.value) {
      try {
        const result = await DeviceOrientationEvent.requestPermission()
        if (result !== 'granted') {
          orientationError.value = 'デバイスの向きへのアクセスが拒否されました'
          return false
        }
      } catch (e) {
        const msg = e?.message || ''
        orientationError.value = msg.includes('secure origin') || msg.includes('Only secure')
          ? 'コンパスには HTTPS でのアクセスが必要です（方位矢印は利用可能）'
          : 'デバイスの向きへのアクセスに失敗しました'
        return false
      }
    }

    window.addEventListener('deviceorientationabsolute', onOrientation, true)
    window.addEventListener('deviceorientation', onOrientation, true)
    return true
  }

  function stop() {
    if (geoWatchId != null) {
      navigator.geolocation.clearWatch(geoWatchId)
      geoWatchId = null
    }
    window.removeEventListener('deviceorientationabsolute', onOrientation, true)
    window.removeEventListener('deviceorientation', onOrientation, true)
  }

  onUnmounted(stop)

  return {
    isSecureContext,
    lat,
    lon,
    geoError,
    geoReady,
    manualLocation,
    alpha,
    beta,
    gamma,
    compassHeading,
    orientationAbsolute,
    orientationReady,
    orientationError,
    needsPermission,
    setManualLocation,
    startGeolocation,
    startOrientation,
    stop,
  }
}