// src/App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import NetworkGraph from './components/NetworkGraph/NetworkGraph';
import NavigationBar from './components/NavigationBar/NavigationBar';
import BottomSheet from './components/BottomSheet/BottomSheet';
import { fetchTransactions, fetchAddressData } from './services/api';

function App() {
    const [transactions, setTransactions] = useState([]);
    const [addressData, setAddressData] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 데이터 로드
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [txData, addrData] = await Promise.all([
                    fetchTransactions(),
                    fetchAddressData()
                ]);

                setTransactions(txData);
                setAddressData(addrData);
                setError(null);
            } catch (err) {
                console.error('Error loading data:', err);
                setError('데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
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
                <p>데이터 로딩 중...</p>
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
