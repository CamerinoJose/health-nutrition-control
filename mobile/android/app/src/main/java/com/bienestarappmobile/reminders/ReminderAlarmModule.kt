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
  private var instance: ReminderEngine? = null
  @Synchronized fun engine(context: Context): ReminderEngine {
    instance?.let { return it }
    val app = context.applicationContext
    val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val state = app.getSharedPreferences("${PREFS}_state", Context.MODE_PRIVATE)
    val store = object : ReminderEngine.Store {
      override fun all(): List<ReminderEngine.Instance> = prefs.all.values.map {
        decode(JSONObject(it as String)) // Corruption fails visibly; never erase pending records.
      }
      override fun put(r: ReminderEngine.Instance) {
        check(prefs.edit().putString(r.id, encode(r).toString()).commit()) { "No se pudo guardar el recordatorio" }
      }
      override fun isPaused() = state.getBoolean("paused", false)
      override fun setPaused(paused: Boolean) {
        check(state.edit().putBoolean("paused", paused).commit()) { "No se pudo actualizar el estado de los recordatorios" }
      }
    }
    return ReminderEngine(store, AndroidScheduler(app)).also { instance = it }
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
    catch (_: Exception) { promise.reject("REMINDER_ERROR", "No se pudo guardar o programar el recordatorio. Abre Recordatorios para reintentar.") }
  }
  @ReactMethod fun create(json: String, promise: Promise) = run(promise) {
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
      putBoolean("notifications", NotificationManagerCompat.from(context).areNotificationsEnabled() && channelEnabled)
      putBoolean("exactAlarms", Build.VERSION.SDK_INT < 31 || context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms())
    }
  }
  @ReactMethod fun openExactAlarmSettings(promise: Promise) = run(promise) {
    if (Build.VERSION.SDK_INT >= 31) context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
      Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    null
  }
}

class ReminderAlarmPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(ReminderAlarmModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
