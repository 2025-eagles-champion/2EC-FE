// src/components/NavigationBar/NavigationBar.jsx
import React, { useState, useEffect } from 'react';
import Slider from './Slider';
import NodeList from './NodeList';
import './NavigationBar.css';
import { fetchTopKNodes } from '../../services/api';
import { getTierColor } from '../../utils/colorUtils';

const NavigationBar = ({ onNodeSelect }) => {
    // 슬라이더 상태 값
    const [batchWeight, setBatchWeight] = useState(50);
    const [txCountWeight, setTxCountWeight] = useState(25);
    const [txAmountWeight, setTxAmountWeight] = useState(25);
    const [topNodes, setTopNodes] = useState([]);
    const [loading, setLoading] = useState(false);

    // 슬라이더 값이 변경될 때마다 Top-K 노드 조회
    useEffect(() => {
        const getTopNodes = async () => {
            setLoading(true);
            try {
                const nodes = await fetchTopKNodes(batchWeight, txCountWeight, txAmountWeight);
                setTopNodes(nodes);
            } catch (error) {
                console.error("Failed to fetch top nodes:", error);
            } finally {
                setLoading(false);
            }
        };

        // 디바운스 처리
        const timeoutId = setTimeout(() => {
            getTopNodes();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [batchWeight, txCountWeight, txAmountWeight]);

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

    // 노드 선택 핸들러
    const handleNodeSelect = (node) => {
        onNodeSelect(node);
    };

    return (
        <div className="navigation-bar">
            <div className="sliders-section">
                <h3>필터링 옵션</h3>
                <div className="slider-container">
                    <label>배치 가중치</label>
                    <Slider
                        value={batchWeight}
                        onChange={handleBatchWeightChange}
                        min={0}
                        max={100}
                    />
                    <span className="slider-value">{batchWeight}%</span>
                </div>

                <div className="slider-container">
                    <label>거래 횟수 가중치</label>
                    <Slider
                        value={txCountWeight}
                        onChange={handleTxCountWeightChange}
                        min={0}
                        max={100}
                    />
                    <span className="slider-value">{txCountWeight}%</span>
                </div>

                <div className="slider-container">
                    <label>거래량 가중치</label>
                    <Slider
                        value={txAmountWeight}
                        onChange={handleTxAmountWeightChange}
                        min={0}
                        max={100}
                    />
                    <span className="slider-value">{txAmountWeight}%</span>
                </div>
            </div>

            <div className="nodes-section">
                <h3>Top 노드 목록</h3>
                {loading ? (
                    <div className="loading">노드 목록 로딩 중...</div>
                ) : (
                    <NodeList nodes={topNodes} onNodeSelect={handleNodeSelect} />
                )}
            </div>
        </div>
    );
};

export default NavigationBar;

