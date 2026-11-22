import com.bienestarappmobile.reminders.ReminderEngine;
import java.util.*;

/** Runs the production state machine without Android, Gradle, or a device. */
public final class ReminderEngineTest {
  static class Store implements ReminderEngine.Store {
    Map<String, ReminderEngine.Instance> records = new LinkedHashMap<>();
    boolean fail;
    boolean paused;
    public List<ReminderEngine.Instance> all() { return new ArrayList<>(records.values()); }
    public void put(ReminderEngine.Instance r) {
      if (fail) throw new IllegalStateException("disk full");
      records.put(r.id, r);
    }
    public boolean isPaused() { return paused; }
    public void setPaused(boolean value) {
      if (fail) throw new IllegalStateException("disk full");
      paused = value;
    }
  }
  static class Scheduler implements ReminderEngine.Scheduler {
    Map<String, Long> alarms = new HashMap<>();
    Set<String> visible = new HashSet<>();
    int shows;
    boolean failCancel;
    public void schedule(String id, long at) { alarms.put(id, at); }
    public void cancel(String id) { if (failCancel) throw new IllegalStateException(); alarms.remove(id); }
    public void dismiss(String id) { visible.remove(id); }
    public void show(ReminderEngine.Instance r) { shows++; visible.add(r.id); }
  }
  static ReminderEngine.Instance reminder(String id) {
    return new ReminderEngine.Instance(id, "task", "source", "Test", "Body", 10000, 1000, "scheduled", 0, 10000);
  }
  static void check(boolean result, String message) {
    if (!result) throw new AssertionError(message);
    System.out.println("PASS: " + message);
  }
  public static void main(String[] args) {
    Store store = new Store(); Scheduler os = new Scheduler();
    ReminderEngine engine = new ReminderEngine(store, os);
    engine.create(reminder("a"));
    check(store.records.get("a").status.equals("scheduled") && os.alarms.get("a") == 10000, "create and persist initial alarm");
    engine.create(reminder("a")); engine.reconcile(2000); engine.reconcile(2000);
    check(store.records.size() == 1 && os.alarms.size() == 1, "duplicate creation and reconciliation are idempotent");
    engine.fire("a", 10000);
    check(store.records.get("a").status.equals("active"), "delivery activates instance");
    check(os.alarms.get("a") == 310000, "next alert is five minutes after actual delivery");
    engine.fire("a", 10001);
    check(os.shows == 1, "duplicate stale delivery cannot alert twice");
    os.dismiss("a"); engine.reconcile(11000);
    check(store.records.get("a").status.equals("active") && os.alarms.size() == 1, "swipe and open never complete");
    os.alarms.clear(); engine = new ReminderEngine(store, os); engine.reconcile(12000);
    check(os.alarms.get("a") == 310000, "process restart restores pending alarm");
    engine.fire("a", 900000);
    check(os.alarms.get("a") == 1200000 && os.shows == 2, "late delivery schedules one repeat without catch-up flood");
    engine.finish("a", true, 920000);
    check(store.records.get("a").status.equals("completed") && store.records.get("a").completedAt == 920000, "explicit completion records timestamp");
    check(os.alarms.isEmpty() && os.visible.isEmpty(), "completion cancels future and displayed notifications");
    engine.create(reminder("a")); engine.fire("a", 1300000); engine.reconcile(1400000);
    check(os.alarms.isEmpty() && os.shows == 2, "completed tombstone prevents resurrection and stale broadcasts");
    engine.create(reminder("b")); engine.create(reminder("c")); engine.finish("b", false, 2000);
    check(store.records.get("b").status.equals("cancelled") && store.records.get("b").completedAt == 0 && os.alarms.containsKey("c"), "cancel is not completion and does not affect another instance");
    engine.reconcile(20000);
    check(store.records.get("c").status.equals("active") && os.alarms.get("c") == 21000, "overdue restoration activates and recovers promptly");
    os.failCancel = true;
    try { engine.finish("c", true, 22000); } catch (IllegalStateException expected) {}
    check(store.records.get("c").status.equals("completed"), "completion persists before cancellation failure");
    os.failCancel = false; engine = new ReminderEngine(store, os); engine.reconcile(23000);
    check(os.alarms.isEmpty(), "restart retries cancellation for terminal instances");
    store.fail = true;
    try { engine.create(reminder("d")); } catch (IllegalStateException expected) {}
    check(!os.alarms.containsKey("d"), "storage failure cannot create an untracked alarm");
    store.fail = false;
    engine.create(reminder("e"));
    engine.fire("e", 10000);
    engine.pause();
    check(store.paused && os.alarms.isEmpty() && os.visible.isEmpty(), "pause hides notifications and cancels alarms");
    check(store.records.get("e").status.equals("active"), "pause preserves pending state");
    engine = new ReminderEngine(store, os);
    engine.fire("e", 400000);
    check(engine.reconcile(400000).isEmpty() && os.alarms.isEmpty() && os.visible.isEmpty(), "pause survives restart and ignores stale deliveries");
    try { engine.create(reminder("f")); throw new AssertionError("creation while paused succeeded"); }
    catch (IllegalStateException expected) {}
    check(!store.records.containsKey("f"), "creation while paused is rejected");
    try { engine.finish("e", true, 400000); throw new AssertionError("completion while paused succeeded"); }
    catch (IllegalStateException expected) {}
    check(store.records.get("e").status.equals("active"), "completion while paused is rejected");
    engine.resume(400000);
    check(!store.paused && os.alarms.containsKey("e") && !os.alarms.containsKey("c"), "resume restores pending alarms without reviving completed reminders");
    os.failCancel = true;
    try { engine.pause(); throw new AssertionError("pause cancellation failure was hidden"); }
    catch (IllegalStateException expected) {}
    check(store.paused, "pause is persisted before a cancellation failure");
    os.failCancel = false;
    engine.reconcile(500000);
    check(os.alarms.isEmpty(), "paused reconciliation retries cancellation");
    System.out.println("All 24 reminder engine checks passed.");
  }
}
