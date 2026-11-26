package com.bienestarappmobile.reminders

import android.app.*
import android.content.*
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.bienestarappmobile.MainActivity
import com.bienestarappmobile.R
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import org.json.JSONArray
import org.json.JSONObject

private const val CHANNEL = "persistent-reminders-v1"
private const val PREFS = "persistent_reminders_v1"
private const val STATE_PREFS = "persistent_reminders_v1_state"

private fun encode(r: ReminderEngine.Instance) = JSONObject().apply {
  put("id", r.id); put("sourceType", r.sourceType); put("sourceId", r.sourceId)
  put("title", r.title); put("body", r.body); put("scheduledAt", r.scheduledAt)
  put("createdAt", r.createdAt); put("status", r.status)
  put("completedAt", if (r.completedAt == 0L) JSONObject.NULL else r.completedAt)
  put("nextAlertAt", r.nextAlertAt); put("repeatMinutes", 5)
  put("notificationIds", JSONArray().put(r.id))
}

private fun decode(o: JSONObject) = ReminderEngine.Instance(
  o.getString("id"), o.getString("sourceType"), o.getString("sourceId"),
  o.getString("title"), o.getString("body"), o.getLong("scheduledAt"),
  o.getLong("createdAt"), o.getString("status"), o.optLong("completedAt", 0), o.getLong("nextAlertAt")
)

object ReminderRuntime {
  private var cachedAccount: String? = null
  private var instance: ReminderEngine? = null

  private fun digest(accountId: String): String {
  val bytes = java.security.MessageDigest.getInstance("SHA-256").digest(accountId.toByteArray(Charsets.UTF_8))
  return bytes.joinToString("") { "%02x".format(it) }
  }

  fun activeAccount(context: Context): String? =
  context.getSharedPreferences(STATE_PREFS, Context.MODE_PRIVATE)
    .getString("active_account", null)?.takeIf { it.isNotBlank() }

  @Synchronized fun engine(context: Context): ReminderEngine {
  val accountId = activeAccount(context)
  return engine(context, accountId)
  }

  @Synchronized private fun engine(context: Context, accountId: String?): ReminderEngine {
  if (cachedAccount == accountId && instance != null) return instance!!
    val app = context.applicationContext
  val state = app.getSharedPreferences(STATE_PREFS, Context.MODE_PRIVATE)
  val prefs = if (accountId == null) null else app.getSharedPreferences("${PREFS}_${digest(accountId)}", Context.MODE_PRIVATE)
  val pausedKey = if (accountId == null) "paused_inactive" else "paused_${digest(accountId)}"
    val store = object : ReminderEngine.Store {
    override fun all(): List<ReminderEngine.Instance> = prefs?.all?.values?.map {
        decode(JSONObject(it as String)) // Corruption fails visibly; never erase pending records.
    } ?: emptyList()
      override fun put(r: ReminderEngine.Instance) {
      val accountPrefs = prefs ?: throw IllegalStateException("Reminders require an active account")
      check(accountPrefs.edit().putString(r.id, encode(r).toString()).commit()) { "No se pudo guardar el recordatorio" }
      }
    override fun isPaused() = accountId == null || state.getBoolean(pausedKey, false)
      override fun setPaused(paused: Boolean) {
      check(state.edit().putBoolean(pausedKey, paused).commit()) { "No se pudo actualizar el estado de los recordatorios" }
      }
    }
  return ReminderEngine(store, AndroidScheduler(app)).also {
    cachedAccount = accountId
    instance = it
  }
  }

  @Synchronized fun activateAccount(context: Context, accountId: String) {
  val state = context.applicationContext.getSharedPreferences(STATE_PREFS, Context.MODE_PRIVATE)
  val previous = activeAccount(context)
  if (previous != null && previous != accountId) {
    engine(context, previous).pause()
  }
  check(state.edit().putString("active_account", accountId).commit()) { "No se pudo guardar la cuenta activa" }
  engine(context, accountId).resume(System.currentTimeMillis())
  }

  @Synchronized fun pauseActive(context: Context) {
  val app = context.applicationContext
  val accountId = activeAccount(app)
  if (accountId != null) engine(app, accountId).pause()
  val state = app.getSharedPreferences(STATE_PREFS, Context.MODE_PRIVATE)
  check(state.edit().remove("active_account").commit()) { "No se pudo cerrar la sesión de recordatorios" }
  cachedAccount = null
  instance = null
  }

  @Synchronized fun deleteAccount(context: Context, accountId: String) {
  val app = context.applicationContext
  val accountHash = digest(accountId)
  val accountPrefs = app.getSharedPreferences("${PREFS}_$accountHash", Context.MODE_PRIVATE)
  val scheduler = AndroidScheduler(app)
  accountPrefs.all.keys.forEach { id ->
    scheduler.cancel(id)
    scheduler.dismiss(id)
  }
  check(accountPrefs.edit().clear().commit()) { "No se pudieron eliminar los recordatorios locales" }

  val state = app.getSharedPreferences(STATE_PREFS, Context.MODE_PRIVATE)
  val editor = state.edit().remove("paused_$accountHash")
  if (activeAccount(app) == accountId) editor.remove("active_account")
  check(editor.commit()) { "No se pudo limpiar la cuenta de recordatorios" }
  if (cachedAccount == accountId) {
    cachedAccount = null
    instance = null
  }
  }

  fun channel(context: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "Recordatorios persistentes", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Alertas pendientes hasta confirmar Hecho"
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 500, 250, 500)
      lockscreenVisibility = Notification.VISIBILITY_PRIVATE
      setSound(Settings.System.DEFAULT_NOTIFICATION_URI,
        android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION).build())
    })
  }
}

private class AndroidScheduler(private val context: Context) : ReminderEngine.Scheduler {
  private val alarms = context.getSystemService(AlarmManager::class.java)
  private fun intent(id: String) = PendingIntent.getBroadcast(context, 0,
    Intent(context, ReminderAlarmReceiver::class.java).apply {
      action = "com.bienestarappmobile.REMINDER_FIRE"
      data = Uri.Builder().scheme("bienestar-alarm").authority("instance").appendPath(id).build()
      putExtra("id", id)
    }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  override fun schedule(id: String, at: Long) {
    val operation = intent(id)
    if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) {
      try {
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation)
        return
      } catch (_: SecurityException) { /* Permission may be revoked between check and call. */ }
    }
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation)
  }
  override fun cancel(id: String) { alarms.cancel(intent(id)) }
  override fun dismiss(id: String) { NotificationManagerCompat.from(context).cancel(id, 0) }
  override fun show(r: ReminderEngine.Instance) {
    ReminderRuntime.channel(context)
    val open = Intent(context, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = Uri.Builder().scheme("com.bienestarappmobile").authority("reminder").appendPath(r.id).build()
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val notification = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(R.drawable.notification_icon)
      .setContentTitle(r.title).setContentText(r.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText("${r.body}\nAbre la app y confirma ✓ Hecho."))
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setDefaults(Notification.DEFAULT_SOUND or Notification.DEFAULT_VIBRATE)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setLocalOnly(false).setAutoCancel(true).setOnlyAlertOnce(false)
      .setContentIntent(PendingIntent.getActivity(context, 0, open,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)).build()
    // Swiping/tapping only dismisses the tray item. No deleteIntent or completion action.
    try { NotificationManagerCompat.from(context).notify(r.id, 0, notification) }
    catch (_: SecurityException) { /* Keep the durable pending state when permission is revoked. */ }
  }
}

class ReminderAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val result = goAsync()
    Thread {
      try {
        val engine = ReminderRuntime.engine(context)
        if (intent.action == "com.bienestarappmobile.REMINDER_FIRE") {
          intent.getStringExtra("id")?.let { engine.fire(it, System.currentTimeMillis()) }
        } else engine.reconcile(System.currentTimeMillis())
      } catch (_: Exception) {
        android.util.Log.e("ReminderAlarm", "No se pudo recuperar la alarma; revisa Recordatorios en la app")
      } finally { result.finish() }
    }.start()
  }
}

class ReminderAlarmModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "ReminderAlarm"
  private fun run(promise: Promise, block: () -> Any?) {
    try { promise.resolve(block()) }
    catch (e: Exception) {
      val message = if (e is IllegalArgumentException || e is IllegalStateException) {
        e.message ?: "No se pudo guardar o programar el recordatorio."
      } else {
        "No se pudo guardar o programar el recordatorio. Abre Recordatorios para reintentar."
      }
      promise.reject("REMINDER_ERROR", message)
    }
  }
  @ReactMethod fun create(json: String, promise: Promise) = run(promise) {
    if (ReminderRuntime.activeAccount(context) == null) {
      throw IllegalStateException("Inicia sesión con tu cuenta antes de crear recordatorios.")
    }
    ReminderRuntime.channel(context)
    encode(ReminderRuntime.engine(context).create(decode(JSONObject(json)))).toString()
  }
  @ReactMethod fun reconcile(promise: Promise) = run(promise) {
    ReminderRuntime.channel(context)
    JSONArray().apply { ReminderRuntime.engine(context).reconcile(System.currentTimeMillis()).forEach { put(encode(it)) } }.toString()
  }
  @ReactMethod fun finish(id: String, completed: Boolean, promise: Promise) = run(promise) {
    ReminderRuntime.engine(context).finish(id, completed, System.currentTimeMillis()); null
  }
  @ReactMethod fun capabilities(promise: Promise) = run(promise) {
    ReminderRuntime.channel(context)
    val channelEnabled = Build.VERSION.SDK_INT < 26 || context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL).importance != NotificationManager.IMPORTANCE_NONE
    Arguments.createMap().apply {
      putBoolean("paused", ReminderRuntime.activeAccount(context) == null)
      putBoolean("notifications", NotificationManagerCompat.from(context).areNotificationsEnabled() && channelEnabled)
      putBoolean("exactAlarms", Build.VERSION.SDK_INT < 31 || context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms())
    }
  }
  @ReactMethod fun openExactAlarmSettings(promise: Promise) = run(promise) {
    if (Build.VERSION.SDK_INT >= 31) context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
      Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    null
  }
  @ReactMethod fun activateAccount(accountId: String, promise: Promise) = run(promise) {
    if (accountId.isBlank()) throw IllegalArgumentException("Account is required")
    ReminderRuntime.activateAccount(context, accountId)
    null
  }
  @ReactMethod fun pause(promise: Promise) = run(promise) {
    ReminderRuntime.pauseActive(context)
    null
  }
  @ReactMethod fun deleteAccount(accountId: String, promise: Promise) = run(promise) {
    if (accountId.isBlank()) throw IllegalArgumentException("Account is required")
    ReminderRuntime.deleteAccount(context, accountId)
    null
  }
}

class ReminderAlarmPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(ReminderAlarmModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
