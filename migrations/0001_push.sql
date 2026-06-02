CREATE TABLE IF NOT EXISTS push_subscriptions (
  device_id TEXT PRIMARY KEY,
  fcm_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  enabled INTEGER NOT NULL DEFAULT 0,
  places_json TEXT NOT NULL DEFAULT '[]',
  alarm_settings_json TEXT NOT NULL DEFAULT '{}',
  app_version TEXT,
  last_sent_key TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_enabled
  ON push_subscriptions (enabled, timezone);

CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  sent_key TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_device
  ON notification_logs (device_id, created_at);
