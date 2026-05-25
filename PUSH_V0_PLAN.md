# 서버 푸시 알림 v0 설계

## 결론

따릉이 레이더의 핵심은 알림입니다. 현재 브라우저 로컬 알림은 앱이 열려 있을 때만 의미가 있으므로, v0 목표는 서버가 정해진 시간에 저장 장소의 따릉이 상태를 확인하고 푸시를 보내는 구조로 전환하는 것입니다.

## v0 목표

- 사용자가 저장장소 1, 저장장소 2 각각에 알림 시간을 저장합니다.
- 사용자가 알림 권한을 허용하면 브라우저 Push Subscription을 서버에 저장합니다.
- 서버는 매분 또는 5분마다 알림 대상자를 확인합니다.
- 알림 시간에는 사용자의 저장 장소 주변 대여소를 서울시 API로 확인합니다.
- 마감임박/재고소진중/여유 상태와 대체 대여소를 푸시로 보냅니다.
- iPhone은 홈 화면에 추가한 PWA에서 우선 테스트합니다.

## 기술 선택

- Cloudflare Pages Functions: 현재 사용 중인 `/api/bikes`와 같은 방식으로 API 추가
- Cloudflare D1: 저장 장소, 알림 시간, 푸시 구독 저장
- Cloudflare Cron Trigger 또는 Workers Scheduled: 정해진 시간마다 알림 작업 실행
- Web Push VAPID: 브라우저 푸시 표준
- Badging API: 가능하면 홈 화면 아이콘 숫자 표시 테스트

## 저장할 데이터

### push_subscriptions

- id
- endpoint
- p256dh
- auth
- user_agent
- created_at
- updated_at

### alert_places

- id
- subscription_id
- slot_key: saved1 또는 saved2
- place_name
- place_type
- address
- lat
- lng
- alarm_time
- enabled
- created_at
- updated_at

### notification_logs

- id
- subscription_id
- alert_place_id
- scheduled_for
- sent_at
- status
- message

## API 초안

### GET /api/push/public-key

브라우저가 VAPID public key를 받는 API입니다.

### POST /api/push/subscribe

브라우저 Push Subscription과 저장 장소/알림 시간을 서버에 저장합니다.

### POST /api/push/unsubscribe

사용자가 알림을 끄면 서버 구독을 비활성화합니다.

### POST /api/push/sync-places

저장 장소나 알림 시간이 바뀌면 서버에 다시 동기화합니다.

## 알림 작업 흐름

1. Cron이 매분 또는 5분마다 실행됩니다.
2. 현재 한국 시간 기준 알림 시간인 `alert_places`를 찾습니다.
3. 같은 장소/같은 시간에 이미 보낸 로그가 있으면 건너뜁니다.
4. 서울시 따릉이 실시간 API를 조회합니다.
5. 저장 장소 주변 대여소와 대체 대여소를 계산합니다.
6. Web Push를 발송합니다.
7. 성공/실패를 `notification_logs`에 기록합니다.

## iPhone 테스트 조건

- iOS 16.4 이상
- Safari에서 홈 화면에 추가한 PWA
- 사용자가 앱 안에서 알림 권한 직접 허용
- 알림 권한 허용 후 Push Subscription 저장
- 앱 아이콘 숫자 배지는 별도 테스트 후 적용

## 구현 순서

1. VAPID 키 생성
2. D1 데이터베이스 생성
3. `/api/push/public-key` 추가
4. 클라이언트에서 Push Subscription 생성
5. `/api/push/subscribe` 저장
6. 저장 장소/알림 시간 서버 동기화
7. Cron 알림 Worker 추가
8. 테스트용 즉시 발송 API 추가
9. iPhone 홈 화면 PWA 테스트
10. 홈 아이콘 배지 가능 여부 테스트

## UX 문구 방향

현재 단계에서는 아래처럼 솔직하게 안내합니다.

> 현재 알림은 앱이 열려 있을 때만 동작합니다. 정해진 시간 자동 알림은 서버 푸시 단계에서 지원할 예정입니다.

서버 푸시 v0 적용 후에는 아래처럼 바꿉니다.

> 저장한 장소 기준으로 정해진 시간에 따릉이 상태를 알려드립니다.

## 보류 항목

- 네이티브 홈 화면 위젯
- 카카오톡 알림
- 문자 알림
- 로그인 기반 계정 동기화
- 유료 프리미엄 알림
