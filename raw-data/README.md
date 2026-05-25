# 과거 따릉이 데이터 넣는 곳

이 폴더는 GitHub에 원본 대용량 CSV를 올리지 않고, 로컬에서만 집계하기 위한 작업 공간입니다.

## 사용 순서

1. 공공데이터포털 또는 서울 열린데이터광장에서 `서울특별시_공공자전거 일별 이용정보` CSV를 내려받습니다.
2. 내려받은 CSV 파일을 `raw-data/daily-usage/` 폴더에 넣습니다.
3. 아래 명령을 실행합니다.

```powershell
node scripts\build-station-stats.js
```

4. `data/station-stats.json` 파일이 갱신됩니다.
5. 앱의 `따릉이 꿀팁 > 재미있는 통계`에서 최다 이용 대여소와 저이용 대여소 순위가 표시됩니다.

## 주의

- 원본 CSV는 용량이 클 수 있으므로 GitHub에 올리지 않습니다.
- 앱에는 집계 결과인 `data/station-stats.json`만 올립니다.
- CSV 컬럼에 `대여소`와 `이용건수`가 있어야 합니다.
