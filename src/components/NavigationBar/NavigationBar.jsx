// src/components/NavigationBar/NavigationBar.jsx
import React, { useState, useEffect } from "react";
import Slider from "./Slider";
import NodeList from "./NodeList";
import DateRangePicker from "../DateRangePicker/DateRangePicker";
import "./NavigationBar.css";

const NavigationBar = ({
                           addressData,
                           onNodeSelect,
                           onFilterChange,
                           weights,
                           dateRange,
                           onDateRangeChange,
                           onFilterApply,
                           topN,
                           onTopNChange,
                           topNodesData // 추가: API에서 받은 top_nodes_derived_json
                       }) => {
    // App.jsx에서 받은 weights 사용 - 외부 활동 가중치 추가
    const { batchWeight, txCountWeight, txAmountWeight, externalActivityWeight } = weights || {
        batchWeight: 50,
        txCountWeight: 25,
        txAmountWeight: 25,
        externalActivityWeight: 25, // 기본값 추가
    };

    const [loading, setLoading] = useState(false);

    // API에서 받은 top_nodes_derived_json의 topN 개수만큼만 표시
    const topNodes = topNodesData ? topNodesData.slice(0, topN) : [];

    console.log("NavigationBar rendering with top nodes:", topNodes?.length, "from", topNodesData?.length);

    // 슬라이더 값 변경 핸들러 - 외부 활동 가중치 핸들러 추가
    const handleBatchWeightChange = (value) => {
        console.log("Batch weight changed to:", value);
        onFilterChange.batchWeight(value);
    };

    const handleTxCountWeightChange = (value) => {
        console.log("TX count weight changed to:", value);
        onFilterChange.txCountWeight(value);
    };

    const handleTxAmountWeightChange = (value) => {
        console.log("TX amount weight changed to:", value);
        onFilterChange.txAmountWeight(value);
    };

    // 새로 추가된 외부 활동 가중치 핸들러
    const handleExternalActivityWeightChange = (value) => {
        console.log("External activity weight changed to:", value);
        onFilterChange.externalActivityWeight(value);
    };

    const handleTopNChange = (value) => {
        console.log("Top N changed to:", value);
        onTopNChange(value);
    };

    return (
        <div className="navigation-bar">
            <div className="filter-section">
                <h3>필터 설정</h3>
                <div className="slider-container top-n-container">
                    <div className="slider-flex">
                        <label>상위 노드 수 (Top-N)</label>
                        <span className="slider-value">{topN}</span>
                    </div>
                    <Slider
                        label="상위 노드 수"
                        value={topN}
                        onChange={handleTopNChange}
                        min={1}
                        max={4}
                        step={1}
                    />
                    <div className="top-n-description">
                        Top-{topN}은 가중치가 적용된 상위 {topN}개 노드를 의미합니다
                    </div>
                </div>

                <div className="slider-container">
                    <div className="slider-flex">
                        <label>퀀트/배치 가중치</label>
                        <span className="slider-value">{batchWeight}%</span>
                    </div>
                    <Slider
                        label="배치 수량 가중치"
                        value={batchWeight}
                        onChange={handleBatchWeightChange}
                    />
                    <div className="slider-description">
                        거래 패턴의 규칙성과 자동화된 거래 특성을 측정합니다
                    </div>
                </div>
                <div className="slider-container">
                    <div className="slider-flex">
                        <label>거래 횟수 가중치</label>
                        <span className="slider-value">{txCountWeight}%</span>
                    </div>
                    <Slider
                        label="거래 횟수 가중치"
                        value={txCountWeight}
                        onChange={handleTxCountWeightChange}
                    />
                    <div className="slider-description">
                        총 거래 횟수가 많을수록 높은 점수를 부여합니다
                    </div>
                </div>
                <div className="slider-container">
                    <div className="slider-flex">
                        <label>거래량 가중치</label>
                        <span className="slider-value">{txAmountWeight}%</span>
                    </div>
                    <Slider
                        label="거래 금액 가중치"
                        value={txAmountWeight}
                        onChange={handleTxAmountWeightChange}
                    />
                    <div className="slider-description">
                        총 거래 금액이 클수록 높은 점수를 부여합니다
                    </div>
                </div>

                {/* 새로 추가된 외부 활동 가중치 슬라이더 */}
                <div className="slider-container">
                    <div className="slider-flex">
                        <label>외부 활동 가중치</label>
                        <span className="slider-value">{externalActivityWeight}%</span>
                    </div>
                    <Slider
                        label="외부 활동 가중치"
                        value={externalActivityWeight}
                        onChange={handleExternalActivityWeightChange}
                    />
                    <div className="slider-description">
                        크로스체인 거래 빈도와 체인 간 다양성을 측정합니다
                    </div>
                </div>

                {/* DateRangePicker 추가 */}
                <div className="date-picker-section">
                    <h4>날짜 범위 설정</h4>
                    <DateRangePicker
                        dateRange={dateRange}
                        onDateRangeChange={onDateRangeChange}
                    />
                    <button
                        className="apply-button"
                        onClick={() => {
                            console.log("NavigationBar: 필터 적용 버튼 클릭");
                            if (typeof onFilterApply === 'function') {
                                onFilterApply();
                            } else {
                                console.error("onFilterApply is not a function", onFilterApply);
                            }
                        }}
                    >
                        필터 적용
                    </button>
                </div>
            </div>
            <div className="nodes-section">
                <h3>Top-{topN} 노드 목록 ({topNodes?.length || 0}개)</h3>
                {/* NodeList 컴포넌트 추가 */}
                <NodeList
                    topNodes={topNodes}
                    loading={loading}
                    onNodeSelect={onNodeSelect}
                />
            </div>
        </div>
    );
};

export default NavigationBar;