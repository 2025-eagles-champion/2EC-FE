# 블록체인 데이터 시각화 프로젝트

이 프로젝트는 블록체인 트랜잭션 데이터를 시각적으로 분석할 수 있는 웹 애플리케이션입니다. 네트워크 그래프와 샌키 다이어그램을 통해 블록체인 거래 패턴과 흐름을 분석할 수 있습니다.

## 주요 기능

- **네트워크 그래프 시각화**: 블록체인 주소 간의 거래를 노드-링크 다이어그램으로 시각화
- **샌키 차트**: 특정 주소의 거래 흐름을 샌키 다이어그램으로 시각화
- **필터링 기능**: 배치(PageRank), 거래 횟수, 거래량의 가중치를 조절하여 중요 노드 필터링
- **노드 상세 정보**: 특정 노드 선택 시 해당 주소의 상세 거래 정보 확인
- **티어 시스템**: PageRank 기반의 신뢰도에 따라 브론즈부터 다이아몬드까지 5단계 티어로 구분

## 기술 스택

- React.js
- D3.js (네트워크 그래프)
- D3-Sankey (샌키 다이어그램)

## 프로젝트 구조

```
blockchain-visualization/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── NetworkGraph/
│   │   │   ├── NetworkGraph.jsx
│   │   │   ├── NetworkGraph.css
│   │   │   └── NetworkGraphUtils.js
│   │   ├── SankeyChart/
│   │   │   ├── SankeyChart.jsx
│   │   │   ├── SankeyChart.css
│   │   │   └── SankeyChartUtils.js
│   │   ├── NavigationBar/
│   │   │   ├── NavigationBar.jsx
│   │   │   ├── NavigationBar.css
│   │   │   ├── Slider.jsx
│   │   │   ├── Slider.css
│   │   │   ├── NodeList.jsx
│   │   │   └── NodeList.css
│   │   └── BottomSheet/
│   │       ├── BottomSheet.jsx
│   │       └── BottomSheet.css
│   ├── services/
│   │   └── api.js
│   ├── utils/
│   │   ├── dataUtils.js
│   │   └── colorUtils.js
│   ├── constants/
│   │   ├── chainColors.js
│   │   └── tierConfig.js
│   ├── data/
│   │   ├── dummyTransactions.js
│   │   └── dummyAddressData.js
│   ├── App.jsx
│   ├── App.css
│   ├── index.js
│   └── index.css
├── package.json
└── README.md
```

## 설치 및 실행

### 사전 요구사항
- Node.js 14 이상
- npm 또는 yarn

### 설치 방법

1. 프로젝트 클론
```bash
git clone https://github.com/your-username/blockchain-visualization.git
cd blockchain-visualization
```

2. 의존성 설치
```bash
npm install
# 또는
yarn install
```

3. 개발 서버 실행
```bash
npm start
# 또는
yarn start
```

4. 브라우저에서 확인
```
http://localhost:3000
```

## 데이터 연동 방법

현재 프로젝트는 더미 데이터를 사용하고 있습니다. 실제 API 연동을 위해서는 다음과 같이 진행하세요:

1. `src/services/api.js` 파일에서 각 함수의 구현을 실제 API 호출로 대체합니다.
2. 백엔드 API가 반환하는 데이터 구조에 맞게 `src/utils/dataUtils.js`의 변환 함수를 필요에 따라 수정합니다.

## 주요 컴포넌트 설명

### NetworkGraph

블록체인 주소 간의 거래 관계를 노드-링크 다이어그램으로 시각화합니다. D3.js의 force-directed graph를 사용하여 구현되어 있습니다.

### SankeyChart

특정 주소의 거래 흐름을 샌키 다이어그램으로 시각화합니다. 주소 간 자금 흐름의 방향과 규모를 확인할 수 있습니다.

### NavigationBar

3개의 슬라이더를 통해 배치(PageRank), 거래 횟수, 거래량의 가중치를 조절하여 주요 노드를 필터링할 수 있습니다. 필터링 결과는 하단 노드 목록에 표시됩니다.

### BottomSheet

특정 노드 선택 시 나타나는 하단 시트로, 노드의 상세 정보와 샌키 차트, 최근 거래 내역을 확인할 수 있습니다.

## 티어 시스템

PageRank 알고리즘 기반의 신뢰도에 따라 5단계의 티어로 구분됩니다:

- 브론즈 (0.0 ~ 0.3)
- 실버 (0.3 ~ 0.5)
- 골드 (0.5 ~ 0.7)
- 플래티넘 (0.7 ~ 0.8)
- 다이아몬드 (0.8 ~ 1.0)

## 라이선스

MIT 라이선스
