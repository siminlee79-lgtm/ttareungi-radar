# Play Console 제출 가이드

출시 직전 점검(2026-07-20)에서 확정한 값들입니다. **Data Safety 답변이 코드와
어긋나면 앱이 정지될 수 있으므로**, 아래 표는 실제 전송·저장 코드를 추적해서
작성했습니다. 임의로 바꾸지 마세요.

## 업로드 파일

| 항목 | 값 |
|---|---|
| AAB | `android/app/build/outputs/bundle/release/app-release.aab` |
| 패키지 | `com.bikeradarseoul.app` |
| versionCode / versionName | `1` / `1.0` |
| targetSdk / minSdk | `36` / `24` |
| 앱 아이콘 512 | `assets/play-store-icon-512.png` |
| 피쳐 그래픽 1024×500 | `assets/play-feature-graphic-1024x500.png` |

재빌드가 필요하면 `npm run android:build:release` 를 쓰세요. 이 스크립트는
`keystore.properties` 가 없으면 서명 없는 번들을 만들지 않고 중단합니다.

## 스토어 등록정보

- 앱 이름: `따릉이 레이더`
- 짧은 설명 / 긴 설명: `PLAY_STORE_LISTING.md`
- 카테고리: 지도/내비게이션
- 개인정보처리방침 URL: `https://ttareungi-radar.pages.dev/privacy`
- 개발자 웹사이트: `https://ttareungi-radar.pages.dev/developer`

`.html` 없는 주소를 쓰세요. `/privacy.html` 은 308 리다이렉트를 거칩니다.

## 앱 콘텐츠

| 질문 | 답 | 근거 |
|---|---|---|
| 광고 포함 | **아니오** | 광고 SDK 없음. 병합 매니페스트에 `AD_ID` 권한 없음 |
| 앱 접근 권한 | 제한 없음 | 로그인·결제 없이 전 기능 사용 |
| 콘텐츠 등급 | 전체 이용가 | 사용자 생성 콘텐츠·소셜 기능 없음 |
| 타겟 연령 | 만 13세 이상 | 아동 대상 아님 |
| 뉴스 앱 | 아니오 | |
| 코로나19 접촉 확인 앱 | 아니오 | |
| 데이터 보안 | 아래 표 참조 | |
| 정부 기관 앱 | **아니오** | 서울시 비공식 서비스임을 명시 |

## 데이터 보안 (Data Safety)

### 수집·전송함

| 데이터 | 유형 | 목적 | 필수/선택 | 공유 |
|---|---|---|---|---|
| **정확한 위치** | 위치 | 앱 기능 | **선택** | 아니오 |
| **기기 또는 기타 ID** | 기기 ID | 앱 기능(푸시 발송) | **선택** | 아니오 |

두 항목 모두 **알림을 켠 경우에만** 전송되므로 "선택"입니다.

- 정확한 위치 = 이용자가 저장한 장소(집·회사)의 위경도. `app.js` 의
  `getPushPayload()` 가 `places` 를 `/api/push/register` 로 보내고
  `push_subscriptions.places_json` 에 저장합니다.
- 기기 ID = 앱이 만든 임의 UUID + FCM 토큰. 광고 ID가 아닙니다.
- **현재 GPS 위치는 신고 대상이 아닙니다.** 기기 안에서만 계산하고 서버로
  보내지 않습니다(코드로 확인).

### 아니오로 답할 것

앱 활동, 앱 정보 및 성능, 웹 검색 기록, 연락처, 사진/동영상, 파일, 캘린더,
금융 정보, 건강, 메시지, 오디오. **분석·추적 SDK를 하나도 쓰지 않습니다.**

### 보안 관행

| 질문 | 답 |
|---|---|
| 전송 중 암호화 | **예** (HTTPS 전용) |
| 데이터 삭제 요청 가능 | **예** |
| 삭제 방법 | 앱에서 알림을 끄면 서버 데이터가 즉시 삭제됨. 이메일 요청도 가능 |

삭제는 실제로 동작합니다 — `/api/push/unregister` 가 행을 `DELETE` 하며,
운영 DB에 테스트 행을 넣고 호출해 0건이 되는 것을 확인했습니다.

## 권한 설명

최종 병합 매니페스트 기준 8개이며, 아래 4개만 직접 선언한 것입니다.

| 권한 | 용도 |
|---|---|
| `INTERNET` | 대여소 API 조회 |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | 현재 위치 주변 대여소 계산 |
| `POST_NOTIFICATIONS` | 지정 시간 알림 |

나머지 `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `com.google.android.c2dm.permission.RECEIVE`,
`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` 은 FCM·AndroidX가 주입합니다.

**백그라운드 위치 권한을 쓰지 않으므로** 별도 심사 대상이 아닙니다.

## 출시 순서

1. 내부 테스트 트랙에 먼저 올려 본인 기기에 Play를 통해 설치해 보세요.
   지금까지의 검증은 debug 빌드로 했고, 서명된 릴리스 빌드가 실제로 도는지는
   이 단계에서 확인됩니다.
2. 알림 켜기 → 저장장소 등록 → 알림시간을 다음 분으로 → 알림 수신 확인.
3. 이상 없으면 프로덕션 트랙으로 승격.

## v1.1에서 AdMob을 넣을 때

`AD_ID` 권한이 자동으로 추가되므로 **Data Safety를 반드시 함께 갱신**해야
합니다. 광고 포함 = 예, 기기 ID 항목에 광고 목적 추가. 이걸 빼먹고 광고만
넣으면 정책 위반입니다. 자세한 내용은 작업 목록의 Phase E 항목 참조.
