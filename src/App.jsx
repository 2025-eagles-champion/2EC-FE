// src/App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import NetworkGraph from './components/NetworkGraph/NetworkGraph';
import NavigationBar from './components/NavigationBar/NavigationBar';
import BottomSheet from './components/BottomSheet/BottomSheet';
import {
    fetchTransactions,
    fetchAddressData,
    initDataLoading,
    getDataLoadingProgress,
    cleanupData
} from './services/api';

function App() {
    const [transactions, setTransactions] = useState([]);
    const [addressData, setAddressData] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [error, setError] = useState(null);

    // 데이터 로드
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // 데이터 로딩 시작
                initDataLoading();

                // 진행률 업데이트 간격 설정
                const progressInterval = setInterval(() => {
                    const progress = getDataLoadingProgress();
                    setLoadingProgress(progress);
                }, 300);

                // 데이터 로딩 완료 이벤트 리스너
                const handleDataLoaded = (event) => {
                    const { transactions, addressData } = event.detail;

                    setTransactions(transactions);
                    setAddressData(addressData);
                    setLoading(false);
                    setError(null);

                    clearInterval(progressInterval);
                    window.removeEventListener('dataLoaded', handleDataLoaded);
                };

                window.addEventListener('dataLoaded', handleDataLoaded);

                // 직접 API 호출도 백업으로 유지
                const [txData, addrData] = await Promise.all([
                    fetchTransactions(),
                    fetchAddressData()
                ]);

                // 이벤트가 발생하지 않은 경우를 대비
                if (loading) {
                    setTransactions(txData);
                    setAddressData(addrData);
                    setLoading(false);
                    clearInterval(progressInterval);
                }

            } catch (err) {
                console.error('Error loading data:', err);
                setError('데이터를 불러오는 중 오류가 발생했습니다.');
                setLoading(false);
            }
        };

        loadData();

        // 컴포넌트 언마운트 시 리소스 정리
        return () => {
            cleanupData();
        };
    }, []);

    // 노드 선택 처리
    const handleNodeSelect = (node) => {
        // 노드 유효성 검사
        if (!node) {
            console.error('Invalid node selected:', node);
            return;
        }

        // address 필드를 id로 변환 (Top-K 목록에서 선택된 경우)
        if (node.address && !node.id) {
            node.id = node.address;
        }

        // id나 address 중 하나는 필요함
        if (!node.id && !node.address) {
            console.error('Node has no identifier:', node);
            return;
        }

        setSelectedNode(node);
        setBottomSheetOpen(true);
    };

    // 바텀 시트 닫기
    const handleBottomSheetClose = () => {
        setBottomSheetOpen(false);
    };

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

    if (error) {
        return (
            <div className="error-container">
                <h2>오류 발생</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>새로고침</button>
            </div>
        );
    }

    return (
        <div className="app">
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
                    <NavigationBar onNodeSelect={handleNodeSelect} />
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
