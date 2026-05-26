# 따릉이 레이더

내가 매일 쓰는 대여소가 오늘 몇 시에 부족해질지 미리 알려주는 따릉이 레이더 프로토타입입니다.

현재 웹/PWA 버전은 기능 검증용입니다. 실제 정해진 시간 알림은 iOS/Android 앱 전환 후 서버 푸시로 구현합니다.

## 지금 들어간 것

- 모바일 우선 웹앱 화면
- 설치용 `manifest.webmanifest`
- 오프라인 캐시용 `service-worker.js`
- 알림 허용 UI와 테스트 알림
- 현재 날짜와 시간 기준 위험도 계산
- 현재 위치 기준 지도 흐름
- 마이메뉴 장소 저장: 집, 사무실, 학교, 학원, 기타
- 저장한 도착지 기준 목적지 주변 상황 예보
- 서울시 실시간 데이터 기반 여유/재고소진중/마감임박 표시
- 과거 이용량 데이터 기반 통계 카드

## 로컬 실행

```powershell
python -m http.server 5173
```

브라우저에서 `http://localhost:5173`을 엽니다.

## 다음 작업

1. Capacitor 기반 iOS/Android 앱 전환 준비
2. 앱에서 현재 레이더, 내장소저장, 따릉이 꿀팁 화면 동작 확인
3. Firebase FCM과 iOS APNs 기반 푸시 토큰 저장
4. Cloudflare D1 또는 Supabase에 저장장소/알림시간 저장
5. Cloudflare Workers Cron으로 정해진 시간 자동 알림 발송
6. 과거 이용량 통계 데이터를 3~6개월 기준으로 보정

상세 계획은 `APP_NATIVE_PLAN.md`, 알림 전략은 `NOTIFICATIONS.md`, 서버 푸시 v0 설계는 `PUSH_V0_PLAN.md`를 참고합니다.
