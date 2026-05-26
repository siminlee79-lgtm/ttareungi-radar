# Android 사전 점검 메모

## 앱 실데이터 경로

Android 앱 번들은 `www/config.local.js`에 아래 값을 넣어 빌드합니다.

```js
window.TTAREUNGI_CONFIG = {
  ...(window.TTAREUNGI_CONFIG || {}),
  IS_NATIVE_APP: true,
  API_BASE_URL: "https://ttareungi-radar.pages.dev",
};
```

따라서 Capacitor WebView가 `https://localhost`로 떠도 로컬 개발 분기로 빠지지 않고 Cloudflare API를 호출합니다.

```text
https://ttareungi-radar.pages.dev/api/bikes
```

## 사전 확인 결과

- API HTTP 상태: 200
- 응답 대여소 수: 2,734개
- 첫 대여소 예시: `102. 망원역 1번출구 앞`

## 카카오맵 예상 이슈

앱에서 지도만 안 뜨면 카카오 Developers JavaScript SDK 도메인 등록 문제일 가능성이 큽니다.

현재 웹 배포 도메인은 이미 등록되어 있어야 합니다.

추가 후보:

- `https://localhost`
- `capacitor://localhost`

실기기에서 지도 오류가 나면 먼저 카카오 Developers의 JavaScript SDK 도메인에 위 후보를 추가하고 재테스트합니다.

## 위치 권한 예상 이슈

Android Manifest에는 아래 권한이 들어가 있습니다.

- `android.permission.INTERNET`
- `android.permission.ACCESS_COARSE_LOCATION`
- `android.permission.ACCESS_FINE_LOCATION`
- `android.permission.POST_NOTIFICATIONS`

앱에서 위치 권한 팝업이 뜨지 않거나 현재 위치가 안 잡히면 아래 순서로 확인합니다.

1. Android 설정 > 앱 > Bike Radar Seoul > 권한
2. 위치 권한이 허용인지 확인
3. 정확한 위치 사용이 켜져 있는지 확인
4. 실내/지하철에서는 GPS가 흔들릴 수 있으므로 야외에서 재테스트

## 알림 권한 예상 이슈

현재 앱에는 Android 알림 권한만 선언되어 있습니다.

아직 Firebase FCM 푸시 토큰 발급과 서버 푸시가 구현된 상태는 아닙니다. 따라서 이번 실기기 테스트에서 알림은 핵심 테스트 대상이 아닙니다.

알림 테스트는 다음 단계에서 진행합니다.

## 앱 이름/아이콘

현재 Android 앱 이름은 임시로 `Bike Radar Seoul`입니다.

아이콘과 스플래시는 Capacitor 기본 이미지입니다. 실기기 기능 확인 후 별도 교체합니다.
