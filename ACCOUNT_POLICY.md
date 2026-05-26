# 계정 분리 원칙

## 프로젝트 구분

- 따릉이 레이더: 개인 프로젝트
- 프라이싱팀 프로젝트: 회사 프로젝트

## 따릉이 레이더 Git 원칙

- GitHub 저장소: `siminlee79-lgtm/ttareungi-radar`
- 회사 계정 `superisgl`로 push하지 않는다.
- 작업 전 `git remote -v`로 개인 저장소인지 확인한다.
- 작업 전 `git config user.email`로 개인 이메일인지 확인한다.

## 회사 프로젝트 Git 원칙

- 프라이싱팀 프로젝트는 회사 저장소와 회사 계정만 사용한다.
- 회사 프로젝트의 코드, 설정, 인증정보를 따릉이 레이더 저장소에 섞지 않는다.

## 작업 전 체크 명령

```powershell
git remote -v
git config user.name
git config user.email
```

## 현재 로컬 기준

Android 앱 작업 기준 폴더:

```text
C:\dev\ttareungi-radar
```

기존 한글 경로 폴더는 백업처럼 둔다.
