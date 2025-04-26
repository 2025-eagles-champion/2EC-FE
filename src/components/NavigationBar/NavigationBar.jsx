// src/components/NavigationBar/NavigationBar.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Slider from './Slider';
import NodeList from './NodeList';
import './NavigationBar.css';
import { fetchAddressData } from '../../services/api';
import { getTopKNodes } from '../../utils/dataUtils';

const NavigationBar = ({ onNodeSelect }) => {
    // 슬라이더 상태 값
    const [batchWeight, setBatchWeight] = useState(50);
    const [txCountWeight, setTxCountWeight] = useState(25);
    const [txAmountWeight, setTxAmountWeight] = useState(25);
    const [topNodes, setTopNodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [addressData, setAddressData] = useState([]);

    // 주소 데이터 로드
    useEffect(() => {
        const loadAddressData = async () => {
            try {
                const data = await fetchAddressData();
                console.log("Loaded address data:", data.length, "items");
                setAddressData(data);
            } catch (error) {
                console.error("Failed to fetch address data:", error);
            }
        };

        loadAddressData();
    }, []);

    // 슬라이더 값이 변경될 때마다 Top-K 노드 조회
    useEffect(() => {
        if (!addressData || addressData.length === 0) {
            console.log("No address data available yet");
            return;
        }

        console.log("Calculating top nodes with weights:", batchWeight, txCountWeight, txAmountWeight);
        setLoading(true);

        // setTimeout을 사용하여 UI 렌더링 차단 방지
        setTimeout(() => {
            try {
                const nodes = getTopKNodes(addressData, batchWeight, txCountWeight, txAmountWeight, 10);
                console.log("Top nodes calculated:", nodes);
                setTopNodes(nodes);
            } catch (error) {
                console.error("Error calculating top nodes:", error);
            } finally {
                setLoading(false);
            }
        }, 0);

    }, [batchWeight, txCountWeight, txAmountWeight, addressData]);

    // 슬라이더 값 변경 핸들러
    const handleBatchWeightChange = (value) => {
        console.log("Batch weight changed to:", value);
        setBatchWeight(value);
    };

    const handleTxCountWeightChange = (value) => {
        console.log("TX count weight changed to:", value);
        setTxCountWeight(value);
    };

    const handleTxAmountWeightChange = (value) => {
        console.log("TX amount weight changed to:", value);
        setTxAmountWeight(value);
    };

    // 노드 선택 핸들러
    const handleNodeSelect = (node) => {
        console.log("Node selected:", node);
        onNodeSelect(node);
    };

    console.log("NavigationBar rendering with top nodes:", topNodes?.length);

    return (
        <div className="navigation-bar">
            <div className="sliders-section">
                <h3>필터링 옵션</h3>
                <div className="slider-container">
                    <div className="slider-flex">
                        <label>배치/퀀트 가중치</label>
                        <span className="slider-value">{batchWeight}%</span>
                    </div>
                    <Slider
                        value={batchWeight}
                        onChange={handleBatchWeightChange}
                        min={0}
                        max={100}
                    />
                </div>

                <div className="slider-container">
                    <div className="slider-flex">
                        <label>거래 횟수 가중치</label>
                        <span className="slider-value">{txCountWeight}%</span>
                    </div>
                    <Slider
                        value={txCountWeight}
                        onChange={handleTxCountWeightChange}
                        min={0}
                        max={100}
                    />
                </div>

                <div className="slider-container">
                    <div className="slider-flex">
                        <label>거래량 가중치</label>
                        <span className="slider-value">{txAmountWeight}%</span>
                    </div>
                    <Slider
                        value={txAmountWeight}
                        onChange={handleTxAmountWeightChange}
                        min={0}
                        max={100}
                    />
                </div>
            </div>

            <div className="nodes-section">
                <h3>Top10 노드 목록 ({topNodes?.length || 0}개)</h3>
                {loading ? (
                    // <div className="loading">노드 목록 로딩 중...</div>
                    <></>
                ) : (
                    <div className="node-list-container">
                        <NodeList
                            nodes={topNodes}
                            onNodeSelect={handleNodeSelect}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default NavigationBar;
