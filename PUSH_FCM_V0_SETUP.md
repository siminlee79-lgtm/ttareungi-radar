# FCM server push v0 setup

This project now has the first server-push path for Android.

## What is implemented

- Android app requests push permission through Capacitor Push Notifications.
- The app receives an FCM token and posts it to `POST /api/push/register`.
- The app can disable server push through `POST /api/push/unregister`.
- The server stores the token, saved places, timezone, and place alarm times in D1.
- `GET/POST /api/push/run` checks due alarms, loads Seoul bike data, calculates nearby station risk, and sends FCM HTTP v1 notifications.
- `POST /api/push/test` sends an immediate test notification to the latest enabled device or a provided device/token.

## Required Firebase setup

1. Create a Firebase project.
2. Add an Android app with package name:

```text
com.bikeradarseoul.app
```

3. Download `google-services.json`.
4. Put it here locally:

```text
android/app/google-services.json
```

Do not commit this file.

5. In Firebase or Google Cloud IAM, create/download a service account JSON that can send Firebase Cloud Messaging messages.

## Required Cloudflare setup

Create a D1 database and bind it to Pages Functions as:

```text
DB
```

Run the migration:

```powershell
wrangler d1 execute <database-name> --file migrations/0001_push.sql
```

Set these environment variables for the Pages project:

```text
SEOUL_OPEN_API_KEY=<existing Seoul Open API key>
PUSH_CRON_SECRET=<long random secret>
FIREBASE_SERVICE_ACCOUNT_JSON=<full Firebase service account JSON>
```

Generate a local secret candidate with:

```powershell
npm run push:secret
```

Alternative Firebase env vars are also supported:

```text
FIREBASE_PROJECT_ID=<firebase project id>
FIREBASE_CLIENT_EMAIL=<service account client_email>
FIREBASE_PRIVATE_KEY=<service account private_key with \n line breaks>
```

## Cron

For v0, call this endpoint every minute from a Cloudflare Worker Cron, an external cron, or a manually configured scheduled job:

```text
https://ttareungi-radar.pages.dev/api/push/run
```

Use either:

```http
Authorization: Bearer <PUSH_CRON_SECRET>
```

or:

```text
https://ttareungi-radar.pages.dev/api/push/run?secret=<PUSH_CRON_SECRET>
```

A sample Worker is included:

```text
workers/push-cron.js
wrangler.push-cron.example.toml
```

Copy the example TOML to your Worker project config, then set the secret with:

```powershell
wrangler secret put PUSH_CRON_SECRET
```

## Local Android test flow

1. Add `android/app/google-services.json`.
2. Build:

```powershell
npm run android:build:debug
```

3. Install the APK on the phone.
4. Save at least one place and alarm time.
5. Tap `알림 켜기`.
6. Confirm the app shows that server push is ready.
7. In Cloudflare D1, confirm a row was inserted into `push_subscriptions`.
8. Send an immediate test:

```powershell
curl.exe -X POST "https://ttareungi-radar.pages.dev/api/push/test" -H "Authorization: Bearer <PUSH_CRON_SECRET>" -H "Content-Type: application/json" --data "{}"
```

9. Set the saved place alarm time to the next minute and call `/api/push/run`.

## Notes

- This is Android/FCM first. iOS APNs comes later.
- The app still keeps local notification behavior for browser/PWA testing.
- Production launch still needs a release AAB, Play Console app content forms, Data Safety, and privacy policy alignment.
