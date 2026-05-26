# Android 로컬 작업 기준

Android 빌드는 한글 경로에서 예민하게 실패할 수 있으므로 로컬 앱 작업 기준 폴더는 아래 경로로 둡니다.

```text
C:\dev\ttareungi-radar
```

기존 폴더는 백업처럼 남겨둘 수 있습니다.

```text
C:\Users\이승준\Desktop\클로드코드\따릉이레이다
```

## 처음 한 번 필요한 설정

`android/local.properties`는 Git에 올리지 않는 PC 전용 파일입니다.

```properties
sdk.dir=C:/Users/이승준/AppData/Local/Android/Sdk
```

## 자주 쓰는 명령

의존성 설치:

```powershell
npm install
```

문법 확인:

```powershell
npm run check
```

Android debug APK 빌드:

```powershell
npm run android:build:debug
```

APK 위치:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

## 참고

`android.overridePathCheck=true`는 더 이상 필요하지 않습니다. 영어 경로에서 빌드하면 Android Gradle의 한글 경로 경고를 우회하지 않아도 됩니다.
