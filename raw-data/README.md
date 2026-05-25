# 과거 따릉이 데이터 작업 공간

이 폴더는 일반 사용자가 쓰는 곳이 아닙니다. 운영자/개발자가 원본 대용량 CSV를 내려받아 작은 통계 JSON으로 가공하기 위한 작업 공간입니다.

일반 사용자는 CSV를 내려받거나 집계하지 않습니다. 앱에는 이미 가공된 `data/station-stats.json`만 배포합니다.

## 사용 순서

1. 최신 일별 이용정보 CSV를 자동으로 내려받습니다.

```powershell
node scripts\fetch-latest-daily-usage.js
```

2. 내려받은 CSV를 집계합니다.

```powershell
node scripts\build-station-stats.js
```

3. `data/station-stats.json` 파일이 갱신됩니다.
4. 앱의 `따릉이 꿀팁 > 재미있는 통계`에서 최다 이용 대여소와 저이용 대여소 순위가 표시됩니다.

수동으로 내려받은 CSV를 쓰는 경우에는 `raw-data/daily-usage/` 폴더에 넣고 2번 집계 명령만 실행하면 됩니다.

## 주의

- 원본 CSV는 용량이 클 수 있으므로 GitHub에 올리지 않습니다.
- 앱에는 집계 결과인 `data/station-stats.json`만 올립니다.
- CSV 컬럼에 `대여소`와 `이용건수`가 있어야 합니다.
