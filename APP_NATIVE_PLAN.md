# 앱 전환 실행 계획

## 방향

PWA는 웹 데모와 기능 검증용으로 유지하고, 실제 알림 서비스는 iOS/Android 앱으로 전환합니다.

핵심은 앱 자체가 아니라 "정해진 시간에 서버가 따릉이 상태를 확인하고 푸시를 보내는 구조"입니다.

## 1단계: 현재 웹앱을 앱에 넣을 수 있게 정리

- 현재 `index.html`, `app.js`, `styles.css` 구조 유지
- 앱에서 필요 없는 PWA 전용 안내 문구는 점진적으로 정리
- 앱 안에서 저장 장소, 지도, 통계 카드가 그대로 동작하는지 확인
- 앱 이름, 아이콘, 스플래시 화면 정리

## 2단계: Capacitor 도입

준비할 것:

- Node.js
- Android Studio
- Xcode 또는 Mac 빌드 환경
- Apple Developer 계정
- Google Play Console 계정

예상 명령:

```powershell
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
npx cap add ios
```

초기 앱 ID 후보:

- `com.bikeradarseoul.app`
- `com.publicbikeradar.seoul`

앱스토어 이름은 상표 리스크를 줄이기 위해 나중에 확정합니다.

## 3단계: 앱 푸시 토큰 저장

- Firebase 프로젝트 생성
- iOS APNs 연결
- Android FCM 연결
- 앱에서 알림 권한 요청
- 푸시 토큰을 서버에 저장

저장 데이터:

- 기기 식별값
- 푸시 토큰
- 저장 장소 1/2
- 장소명, 주소, 좌표
- 알림 시간
- 알림 활성화 여부

## 4단계: 서버 예약 알림

- Cloudflare D1 또는 Supabase에 사용자 알림 데이터 저장
- Cloudflare Workers Cron으로 매분 또는 5분마다 대상 확인
- 서울시 따릉이 API 조회
- 주변 대여소 상태 계산
- 대체 대여소 포함 푸시 발송

## 5단계: 실기기 테스트

iPhone:

- 알림 권한 허용
- 앱 종료 후 예약 알림 수신
- 알림 클릭 시 앱 열림
- 앱 아이콘 배지 가능 여부 확인

Android:

- 알림 권한 허용
- 백그라운드/절전모드 상태 테스트
- 알림 클릭 시 앱 열림

## 6단계: 출시 준비

- 개인정보처리방침 업데이트
- 위치정보 이용약관 작성
- 서비스 이용약관 작성
- 데이터 출처와 비공식 서비스 문구 유지
- 앱스토어/플레이스토어 심사용 설명 작성

## 우선순위

1. 앱 전환 골격 만들기
2. 앱에서 현재 기능 동작 확인
3. 즉시 푸시 테스트
4. 예약 푸시 자동화
5. 통계 데이터 보정
6. 심사 문서 정리
