import React, { useState, useEffect } from "react";
import NetworkGraph from "./components/NetworkGraph/NetworkGraph";
import NavigationBar from "./components/NavigationBar/NavigationBar";
import BottomSheet from "./components/BottomSheet/BottomSheet";
import "./App.css";
import axios from "axios";

function App() {
    // 상태 관리
    const [transactions, setTransactions] = useState([]);
    const [addressData, setAddressData] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [error, setError] = useState(null);

    // 필터 상태
    const [batchWeight, setBatchWeight] = useState(50);
    const [txCountWeight, setTxCountWeight] = useState(50);
    const [txAmountWeight, setTxAmountWeight] = useState(70);
    const [topN, setTopN] = useState(2); // Top-N 노드 수
    const [dateRange, setDateRange] = useState({
        startDate: "2022-01-01",
        endDate: "2022-03-29",
    });

    // Top 노드 데이터 저장
    const [topNodesData, setTopNodesData] = useState([]);

    // API URL 설정
    const API_URL = "http://localhost:8000";

    // 노드 데이터 로드 함수
    const loadData = async (filters = {}) => {
        console.log("loadData 함수 호출됨", { dateRange, batchWeight, txCountWeight, txAmountWeight, topN });
        setLoading(true);
        setLoadingProgress(10); // 초기 진행률

        try {
            // 필터 설정
            const requestData = {
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                batch_quant_weight: batchWeight,
                tx_count_weight: txCountWeight,
                tx_amount_weight: txAmountWeight,
                top_n: topN, // topN 값 전달
                ...filters,
            };

            console.log("API 요청 데이터:", requestData);
            setLoadingProgress(30); // API 호출 시작

            const response = await axios.post(`${API_URL}/get_nodes`, requestData);
            const data = response.data;

            setLoadingProgress(70); // 데이터 수신 완료

            // Top 노드 데이터 저장
            const topNodes = data.top_nodes_derived_json.map(node => ({
                ...node,
                id: node.address, // id 필드 추가
                tier: node.tier || "bronze",
                pagerank: node.pagerank || node.final_score || 0,
                chain: node.chain || node.address?.split("1")[0] || "unknown",
            }));
            setTopNodesData(topNodes);

            // 데이터 처리
            const allTransactions = [
                ...data.top_nodes_json,
                ...data.related_nodes_json,
            ];
            const allAddressData = [
                ...data.top_nodes_derived_json,
                ...data.related_nodes_derived_json,
            ];

            // 주소 ID 매핑 (고유 식별자 설정)
            const processedAddressData = allAddressData.map((addr) => ({
                ...addr,
                id: addr.address, // id 필드 추가
                // tier 속성이 없는 경우 'bronze'로 초기화
                tier: addr.tier || "bronze",
                // pagerank 속성이 없는 경우 0으로 초기화
                pagerank: addr.pagerank || addr.final_score || 0,
                // 체인 정보 가져오기
                chain: addr.chain || addr.address?.split("1")[0] || "unknown",
                // 거래 통계 필드 매핑
                sent_tx_count: addr.sent_tx_count || 0,
                recv_tx_count: addr.recv_tx_count || 0,
                sent_tx_amount: addr.sent_tx_amount || 0,
                recv_tx_amount: addr.recv_tx_amount || 0,
            }));

            setTransactions(allTransactions);
            setAddressData(processedAddressData);
            setLoadingProgress(100); // 처리 완료
            setError(null);
        } catch (err) {
            console.error("데이터 로드 오류:", err);
            setError("데이터를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // 초기 데이터 로드
    useEffect(() => {
        loadData();
        // 초기 로드 후에는 의존성 배열이 비어 있으므로 한 번만 실행됨
    }, []);

    // 필터 변경 시 데이터 다시 로드
    const handleFilterApply = () => {
        console.log("필터 적용 버튼 클릭: API 호출 시작");
        loadData();
    };

    // 노드 선택 처리
    const handleNodeSelect = (node) => {
        // 노드 유효성 검사
        if (!node) {
            console.error("유효하지 않은 노드:", node);
            return;
        }

        // address 필드를 id로 변환 (Top-K 목록에서 선택된 경우)
        if (node.address && !node.id) {
            node.id = node.address;
        }

        // id나 address 중 하나는 필요함
        if (!node.id && !node.address) {
            console.error("식별자가 없는 노드:", node);
            return;
        }

        setSelectedNode(node);
        setBottomSheetOpen(true);
    };

    // 바텀 시트 닫기
    const handleBottomSheetClose = () => {
        setBottomSheetOpen(false);
    };

    // 슬라이더 값 변경 핸들러
    const handleBatchWeightChange = (value) => {
        setBatchWeight(value);
    };

    const handleTxCountWeightChange = (value) => {
        setTxCountWeight(value);
    };

    const handleTxAmountWeightChange = (value) => {
        setTxAmountWeight(value);
    };

    // topN 값 변경 핸들러 추가
    const handleTopNChange = (value) => {
        setTopN(value);
    };

    // 날짜 범위 변경 핸들러
    const handleDateRangeChange = (newRange) => {
        setDateRange(newRange);
    };

    // 로딩 화면 렌더링
    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>데이터 로딩 중... {loadingProgress}%</p>
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${loadingProgress}%` }}
                    ></div>
                </div>
            </div>
        );
    }

    // 에러 화면 렌더링
    if (error) {
        return (
            <div className="error-container">
                <h2>오류 발생</h2>
                <p>{error}</p>
                <button onClick={() => loadData()}>새로고침</button>
            </div>
        );
    }

    return (
        <div className="app">
            <div className="header">
                <h1>ChainEagles</h1>
            </div>
            <div className="main-content">
                <div className="graph-container">
                    <NetworkGraph
                        transactions={transactions}
                        addressData={addressData}
                        onNodeClick={handleNodeSelect}
                        selectedNode={selectedNode}
                    />
                </div>
                <div className="navigation-container">
                    <NavigationBar
                        addressData={addressData}
                        onNodeSelect={handleNodeSelect}
                        onFilterChange={{
                            batchWeight: handleBatchWeightChange,
                            txCountWeight: handleTxCountWeightChange,
                            txAmountWeight: handleTxAmountWeightChange,
                        }}
                        weights={{
                            batchWeight,
                            txCountWeight,
                            txAmountWeight,
                        }}
                        dateRange={dateRange}
                        onDateRangeChange={handleDateRangeChange}
                        onFilterApply={handleFilterApply}
                        topN={topN}
                        onTopNChange={handleTopNChange}
                        topNodesData={topNodesData} // 추가: API에서 받은 top_nodes_derived_json 전달
                    />
                </div>
            </div>

            <BottomSheet
                isOpen={bottomSheetOpen}
                onClose={handleBottomSheetClose}
                selectedNode={selectedNode}
                allTransactions={transactions}
                addressData={addressData}
            />
        </div>
    );
}

export default App;
