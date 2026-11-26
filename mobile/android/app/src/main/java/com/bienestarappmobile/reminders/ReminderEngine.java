package com.bienestarappmobile.reminders;

import java.util.List;
import java.util.Collections;

/** OS-independent state machine. Store writes must be durable before returning. */
public final class ReminderEngine {
  public static final long REPEAT_MS = 5 * 60 * 1000L;

  public static final class Instance {
    public final String id, sourceType, sourceId, title, body, status;
    public final long scheduledAt, createdAt, completedAt, nextAlertAt;

    public Instance(String id, String sourceType, String sourceId, String title, String body,
        long scheduledAt, long createdAt, String status, long completedAt, long nextAlertAt) {
      this.id = id; this.sourceType = sourceType; this.sourceId = sourceId;
      this.title = title; this.body = body; this.scheduledAt = scheduledAt;
      this.createdAt = createdAt; this.status = status;
      this.completedAt = completedAt; this.nextAlertAt = nextAlertAt;
    }

    public boolean pending() { return status.equals("scheduled") || status.equals("active"); }
    Instance change(String status, long completedAt, long nextAlertAt) {
      return new Instance(id, sourceType, sourceId, title, body, scheduledAt, createdAt,
          status, completedAt, nextAlertAt);
    }
  }

  public interface Store {
    List<Instance> all();
    void put(Instance instance);
    boolean isPaused();
    void setPaused(boolean paused);
  }
  public interface Scheduler {
    void schedule(String id, long at);
    void cancel(String id);
    void dismiss(String id);
    void show(Instance instance);
  }
  private final Store store;
  private final Scheduler scheduler;
  public ReminderEngine(Store store, Scheduler scheduler) {
    this.store = store; this.scheduler = scheduler;
  }
  private Instance find(String id) {
    for (Instance r : store.all()) if (r.id.equals(id)) return r;
    return null;
  }
  public synchronized Instance create(Instance r) {
    if (store.isPaused()) throw new IllegalStateException("Reminders are paused");
    Instance existing = find(r.id);
    if (existing != null) {
      if (existing.pending()) scheduler.schedule(existing.id, existing.nextAlertAt);
      return existing; // Includes terminal tombstones: never resurrect.
    }
    if (r.id.isEmpty() || r.title.trim().isEmpty() || r.scheduledAt <= 0
        || !r.status.equals("scheduled")) throw new IllegalArgumentException("Invalid reminder");
    store.put(r);
    scheduler.schedule(r.id, r.nextAlertAt);
    return r;
  }
  public synchronized void fire(String id, long now) {
    if (store.isPaused()) { scheduler.cancel(id); scheduler.dismiss(id); return; }
    Instance r = find(id);
    if (r == null || !r.pending()) { scheduler.cancel(id); scheduler.dismiss(id); return; }
    if (now < r.nextAlertAt) { scheduler.schedule(id, r.nextAlertAt); return; }
    // No catch-up burst after Doze/reboot. Five minutes from actual delivery.
    r = r.change("active", 0, now + REPEAT_MS);
    store.put(r);
    scheduler.schedule(id, r.nextAlertAt);
    scheduler.show(r);
  }
  public synchronized void finish(String id, boolean completed, long now) {
    if (store.isPaused()) throw new IllegalStateException("Reminders are paused");
    Instance r = find(id);
    if (r == null) return;
    if (r.pending()) store.put(r.change(completed ? "completed" : "cancelled",
        completed ? now : 0, 0));
    scheduler.cancel(id);
    scheduler.dismiss(id);
  }
  public synchronized List<Instance> reconcile(long now) {
    if (store.isPaused()) {
      cancelScheduled();
      return Collections.emptyList();
    }
    for (Instance r : store.all()) {
      if (!r.pending()) { scheduler.cancel(r.id); scheduler.dismiss(r.id); continue; }
      if (r.scheduledAt <= now && r.status.equals("scheduled")) {
        r = r.change("active", 0, r.nextAlertAt);
        store.put(r);
      }
      // Same PendingIntent identity replaces the previous alarm, never adds another.
      scheduler.schedule(r.id, Math.max(now + 1000, r.nextAlertAt));
    }
    return store.all();
  }

  public synchronized void pause() {
    store.setPaused(true);
    cancelScheduled();
  }

  public synchronized List<Instance> resume(long now) {
    store.setPaused(false);
    return reconcile(now);
  }

  private void cancelScheduled() {
    for (Instance r : store.all()) {
      scheduler.cancel(r.id);
      scheduler.dismiss(r.id);
    }
  }
}
