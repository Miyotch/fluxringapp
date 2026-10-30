package expo.modules.audio

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.media3.common.util.UnstableApi

/** Owns the deadline and volume envelope independently of React Native's JS thread. */
@UnstableApi
internal class FluxSleepTimer(private val context: Context, private val owner: AudioPlayer) {
  private val handler = Handler(Looper.getMainLooper())
  private val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
  private var wakeLock: PowerManager.WakeLock? = null
  private var deadline = -1L
  private var baseVolume = 1f
  private var expired = false
  private var lastLog = -1L
  val remaining: Double
    get() = if (deadline < 0) (if (expired) 0.0 else -1.0) else (deadline - SystemClock.elapsedRealtime()).coerceAtLeast(0).toDouble()

  fun set(durationMs: Double) {
    cancel()
    if (!durationMs.isFinite() || durationMs <= 0) return
    val duration = durationMs.toLong().coerceAtMost(90 * 60_000L)
    baseVolume = owner.ref.volume
    deadline = SystemClock.elapsedRealtime() + duration
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FluxRing:SleepTimer").apply {
      setReferenceCounted(false)
      acquire(duration + 5_000L)
    }
    Log.i("FluxSleepTimer", "armed durationMs=$duration")
    handler.post(tick)
  }

  fun cancel() {
    handler.removeCallbacksAndMessages(null)
    if (deadline >= 0) owner.ref.volume = baseVolume
    deadline = -1
    expired = false
    lastLog = -1
    releaseWakeLock()
  }

  private fun releaseWakeLock() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
  }

  private val tick = object : Runnable {
    override fun run() {
      if (deadline < 0) return
      val left = deadline - SystemClock.elapsedRealtime()
      val gain = (left / 30_000f).coerceIn(0f, 1f)
      owner.ref.volume = baseVolume * gain
      val bucket = left.coerceAtLeast(0) / 5_000
      if (bucket != lastLog) {
        lastLog = bucket
        Log.i("FluxSleepTimer", "remainingMs=$left gain=$gain screenOn=${power.isInteractive}")
      }
      if (left <= 0) {
        // Clear auto-resume intent, including transient audio focus interruptions.
        owner.isPaused = false
        owner.ref.pause()
        deadline = -1
        expired = true
        owner.ref.volume = baseVolume
        releaseWakeLock()
        Log.i("FluxSleepTimer", "expired playing=${owner.ref.playWhenReady} screenOn=${power.isInteractive}")
      } else handler.postDelayed(this, 100)
    }
  }
}
