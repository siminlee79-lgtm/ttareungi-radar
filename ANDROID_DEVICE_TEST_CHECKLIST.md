# Android 실기기 테스트 체크리스트

## 테스트 기준

- 작업 폴더: `C:\dev\ttareungi-radar`
- APK 위치: `android\app\build\outputs\apk\debug\app-debug.apk`
- 테스트 목적: Android 앱에서 실제 따릉이 데이터, 위치, 지도, 저장 장소가 동작하는지 확인

## 1. 테스트 전 PC 확인

```powershell
git remote -v
git config user.email
npm run check
npm run android:build:debug
```

정상 기준:

- remote가 `git@github.com-siminlee79:siminlee79-lgtm/ttareungi-radar.git`
- email이 `siminlee79@gmail.com`
- APK 빌드 성공

## 2. 폰 준비

1. Android 폰 잠금 해제
2. 설정 > 휴대전화 정보 > 소프트웨어 정보
3. `빌드번호` 7번 터치
4. 설정 > 개발자 옵션
5. `USB 디버깅` 켜기
6. PC와 USB 케이블 연결
7. 폰에 뜨는 `이 컴퓨터에서 USB 디버깅을 허용하시겠습니까?`에서 허용

## 3. 설치 방법

Android Studio에서 실행하는 방법:

1. Android Studio 열기
2. `C:\dev\ttareungi-radar\android` 폴더 열기
3. 상단 기기 선택에서 연결된 Android 폰 선택
4. Run 버튼 클릭

APK 파일로 설치하는 방법:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

`adb`가 안 잡히면 Android Studio로 실행하는 방식을 먼저 사용합니다.

## 4. 앱 실행 후 필수 확인

- 앱이 설치되는가
- 앱이 실행되는가
- 위치 권한 요청이 뜨는가
- 위치 권한 허용 후 현재 위치가 잡히는가
- 지도 영역이 실제 카카오맵으로 표시되는가
- 따릉이 데이터가 실제 대여소 기준으로 표시되는가
- 데모 대여소 4개만 보이지 않는가
- 저장 장소 1개 이상 저장되는가
- 앱 종료 후 다시 열어도 저장 장소가 유지되는가
- 따릉이 꿀팁/통계 카드가 표시되는가

## 5. 실데이터 확인 기준

정상이라면 앱은 아래 API를 통해 실시간 대여소 데이터를 가져옵니다.

```text
https://ttareungi-radar.pages.dev/api/bikes
```

현재 사전 확인 결과:

- API 응답: 200
- 대여소 수: 2,700개 이상

앱에 홍대/데모 대여소 4개만 보이면 실데이터 경로가 실패한 것입니다.

## 6. 캡처가 필요한 오류

아래 문제가 있으면 화면 캡처를 남깁니다.

- 앱 시작 직후 흰 화면
- 위치 권한 팝업이 안 뜸
- 현재 위치가 계속 서울시청/기본 위치로만 나옴
- 지도 영역이 빈 화면 또는 대체 그림으로만 나옴
- 대여소가 4개 정도만 보임
- 저장 장소 저장 후 목록에 안 뜸
- 앱 재실행 후 저장 장소가 사라짐

## 7. 테스트 후 보고 형식

아래처럼 알려주면 바로 다음 수정에 들어갈 수 있습니다.

```text
설치: 성공/실패
앱 실행: 성공/실패
위치 권한: 뜸/안 뜸
현재 위치: 맞음/틀림
지도: 뜸/안 뜸
따릉이 데이터: 실데이터/데모데이터
저장 장소: 저장됨/안 됨
캡처: 있음/없음
```
