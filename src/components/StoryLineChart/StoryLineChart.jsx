// src/components/StoryLineChart/StoryLineChart.jsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './StoryLineChart.css';
import { getChainColor } from '../../utils/colorUtils';
import { shortenAddress } from '../../utils/dataUtils';

const StoryLineChart = ({ transactions, selectedAddress }) => {
    const svgRef = useRef(null);

    useEffect(() => {
        if (!transactions || !selectedAddress || !svgRef.current) return;

        // 관련 트랜잭션 필터링
        const relevantTxs = transactions.filter(tx =>
            tx.fromAddress === selectedAddress || tx.toAddress === selectedAddress
        ).sort((a, b) => a.timestamp - b.timestamp);

        if (relevantTxs.length === 0) {
            // 거래 내역이 없을 때 메시지 표시
            d3.select(svgRef.current).selectAll("*").remove();
            d3.select(svgRef.current)
                .append("text")
                .attr("x", svgRef.current.clientWidth / 2)
                .attr("y", 150)
                .attr("text-anchor", "middle")
                .attr("fill", "#6c757d")
                .text("시간에 따른 거래 내역이 없습니다");
            return;
        }

        // 모든 관련 체인 수집
        const chains = new Set();
        relevantTxs.forEach(tx => {
            chains.add(tx.fromChain);
            chains.add(tx.toChain);
        });
        const chainsArray = Array.from(chains);

        // SVG 크기 설정
        const margin = { top: 40, right: 30, bottom: 50, left: 50 };
        const width = svgRef.current.clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        // 기존 SVG 내용 초기화
        d3.select(svgRef.current).selectAll("*").remove();

        // SVG 생성
        const svg = d3.select(svgRef.current)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // 시간 스케일 (가로축)
        const minTime = d3.min(relevantTxs, d => d.timestamp);
        const maxTime = d3.max(relevantTxs, d => d.timestamp);

        // 시간 범위가 너무 작으면 확장
        const timeRange = maxTime - minTime;
        const minTimeAdjusted = minTime - timeRange * 0.1;
        const maxTimeAdjusted = maxTime + timeRange * 0.1;

        const timeScale = d3.scaleTime()
            .domain([new Date(minTimeAdjusted), new Date(maxTimeAdjusted)])
            .range([0, width]);

        // 체인 스케일 (세로축)
        // 선택된 노드의 체인을 중앙에 위치시키기
        let selectedChain = '';
        const selectedTx = relevantTxs.find(tx =>
            tx.fromAddress === selectedAddress || tx.toAddress === selectedAddress
        );
        if (selectedTx) {
            selectedChain = selectedTx.fromAddress === selectedAddress
                ? selectedTx.fromChain
                : selectedTx.toChain;
        }

        // 체인 배열 재정렬 (선택된 체인을 중앙에)
        const reorderedChains = [...chainsArray];
        const selectedChainIndex = reorderedChains.indexOf(selectedChain);
        if (selectedChainIndex > -1) {
            reorderedChains.splice(selectedChainIndex, 1);
            const centerIndex = Math.floor(reorderedChains.length / 2);
            reorderedChains.splice(centerIndex, 0, selectedChain);
        }

        const chainScale = d3.scaleBand()
            .domain(reorderedChains)
            .range([0, height])
            .padding(0.3);

        // 가로축 (시간) 추가
        svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(timeScale)
                .ticks(5)
                .tickFormat(d3.timeFormat("%m/%d %H:%M")))
            .selectAll("text")
            .attr("y", 10)
            .attr("transform", "rotate(0)")
            .style("text-anchor", "middle");

        // X 축 레이블
        svg.append("text")
            .attr("class", "x-label")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .attr("text-anchor", "middle")
            .text("시간");

        // 체인 레인 및 체인 이름 라벨 추가
        reorderedChains.forEach(chain => {
            // 체인 레인 배경
            svg.append("rect")
                .attr("x", 0)
                .attr("y", chainScale(chain))
                .attr("width", width)
                .attr("height", chainScale.bandwidth())
                .attr("fill", getChainColor(chain))
                .attr("fill-opacity", 0.05);

            // 체인 레인 중심선
            svg.append("line")
                .attr("x1", 0)
                .attr("y1", chainScale(chain) + chainScale.bandwidth() / 2)
                .attr("x2", width)
                .attr("y2", chainScale(chain) + chainScale.bandwidth() / 2)
                .attr("stroke", getChainColor(chain))
                .attr("stroke-width", 1)
                .attr("stroke-opacity", 0.5)
                .attr("stroke-dasharray", "3,3");

            // 선택된 노드의 체인인 경우 강조
            if (chain === selectedChain) {
                svg.append("rect")
                    .attr("x", -margin.left)
                    .attr("y", chainScale(chain))
                    .attr("width", 3)
                    .attr("height", chainScale.bandwidth())
                    .attr("fill", "#2196F3");
            }

            // 체인 이름 라벨
            svg.append("text")
                .attr("x", -10)
                .attr("y", chainScale(chain) + chainScale.bandwidth() / 2)
                .attr("dy", "0.32em")
                .attr("text-anchor", "end")
                .attr("fill", getChainColor(chain))
                .attr("font-weight", chain === selectedChain ? "bold" : "normal")
                .text(chain);
        });

        // 툴팁 생성 - 기존 툴팁 재사용 또는 생성
        let tooltip = d3.select("body").select(".storyline-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body").append("div")
                .attr("class", "storyline-tooltip")
                .style("position", "absolute")
                .style("opacity", 0)  // visibility 대신 opacity 사용
                .style("pointer-events", "none")  // 마우스 이벤트 무시
                .style("background-color", "white")
                .style("border", "1px solid #ddd")
                .style("border-radius", "4px")
                .style("padding", "8px")
                .style("font-size", "12px")
                .style("box-shadow", "0 1px 3px rgba(0,0,0,0.2)")
                .style("z-index", "10000");
        }

        // 트랜잭션 노드와 연결선 그리기
        relevantTxs.forEach((tx, i) => {
            // 노드 크기 및 기본 속성 계산
            const nodeRadius = Math.max(3, Math.min(8, Math.log(tx.amount || 1) + 2));
            const strokeWidth = Math.max(1, Math.min(5, Math.log(tx.amount || 1) + 1));

            // 노드 위치 계산
            const txTime = new Date(tx.timestamp);
            const fromY = chainScale(tx.fromChain) + chainScale.bandwidth() / 2;
            const toY = chainScale(tx.toChain) + chainScale.bandwidth() / 2;
            const x = timeScale(txTime);

            // 노드 유형 결정
            const isSelectedFromNode = tx.fromAddress === selectedAddress;
            const isSelectedToNode = tx.toAddress === selectedAddress;
            const isInternalTx = tx.fromChain === tx.toChain;
            const isCurrentNodeFrom = isSelectedFromNode;
            const isCurrentNodeTo = isSelectedToNode;

            // 노드 클래스 결정
            const fromNodeClass = isInternalTx ? "outgoing-tx internal-tx" : "outgoing-tx";
            const toNodeClass = isInternalTx ? "incoming-tx internal-tx" : "incoming-tx";

            // 체인 간 거래 or 동일 체인 내 거래 표시
            if (tx.fromChain !== tx.toChain) {
                // 체인 간 트랜잭션 라인 (다른 체인 간)
                // 곡선 구성
                const curve = d3.line()
                    .x(d => d.x)
                    .y(d => d.y)
                    .curve(d3.curveBasis);

                // 중간 제어점 정의
                const controlPoints = [
                    { x: x, y: fromY },
                    { x: x + 10, y: (fromY + toY) / 2 - 10 },
                    { x: x - 10, y: (fromY + toY) / 2 + 10 },
                    { x: x, y: toY }
                ];

                // 곡선 그리기
                svg.append("path")
                    .datum(controlPoints)
                    .attr("d", curve)
                    .attr("stroke", d3.interpolateRgb(
                        getChainColor(tx.fromChain),
                        getChainColor(tx.toChain)
                    )(0.5))
                    .attr("stroke-width", strokeWidth)
                    .attr("stroke-opacity", 0.7)
                    .attr("fill", "none");
            } else {
                // 동일 체인 내 거래인 경우, 수신 노드도 표시
                // 동일 체인 내 거래는 선을 다른 스타일로 표시
                svg.append("line")
                    .attr("x1", x)
                    .attr("y1", fromY)
                    .attr("x2", x + 15) // 약간 옆으로 이동
                    .attr("y2", fromY)
                    .attr("stroke", getChainColor(tx.fromChain))
                    .attr("stroke-width", strokeWidth)
                    .attr("stroke-opacity", 0.7)
                    .attr("stroke-dasharray", "3,2");
            }

            // From 노드 그룹 생성
            const fromNodeGroup = svg.append("g")
                .attr("class", "tx-node-group")
                .attr("transform", `translate(${x},${fromY})`);

            // 노드 색상 및 스타일 설정
            let fromStrokeColor = "#FF5722";   // 발신 노드 기본 색상
            let fromDashArray = null;          // 대시 패턴

            // 내부 거래인 경우 색상 변경
            if (isInternalTx) {
                fromStrokeColor = "#9C27B0"; // 내부 거래는 보라색
            }

            // 현재 노드인 경우 표시
            if (isCurrentNodeFrom) {
                fromDashArray = "3,2";
                fromNodeGroup.append("circle")
                    .attr("r", nodeRadius + 5)
                    .attr("fill", "none")
                    .attr("stroke", "#2196F3") // 현재 노드는 파란색
                    .attr("stroke-width", 2)
                    .attr("stroke-dasharray", "2,1");
            }

            // 노드 외곽선 추가 (발신 노드)
            fromNodeGroup.append("circle")
                .attr("r", nodeRadius + 2)
                .attr("fill", "none")
                .attr("stroke", fromStrokeColor)
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", fromDashArray);

            // 실제 노드
            fromNodeGroup.append("circle")
                .attr("class", `tx-node ${fromNodeClass}`)
                .attr("r", nodeRadius)
                .attr("fill", getChainColor(tx.fromChain))
                .attr("stroke", "#fff")
                .attr("stroke-width", 0.5)
                .attr("opacity", isCurrentNodeFrom ? 1 : 0.8);

            // 이벤트를 그룹에 바인딩
            fromNodeGroup
                .on("mouseover", function(event) {
                    // 노드 강조
                    d3.select(this).select(".tx-node").attr("opacity", 1);

                    // 노드 유형 결정
                    let nodeType = "발신 노드";
                    if (isInternalTx) nodeType += " (내부 거래)";
                    if (isCurrentNodeFrom) nodeType += " (현재 노드)";

                    // 툴팁 내용 업데이트
                    tooltip.html(`
                        <div><strong>노드 유형:</strong> ${nodeType}</div>
                        <div><strong>TX Hash:</strong> ${tx.txhash.substring(0, 10)}...</div>
                        <div><strong>From:</strong> ${shortenAddress(tx.fromAddress)}</div>
                        <div><strong>To:</strong> ${shortenAddress(tx.toAddress)}</div>
                        <div><strong>Amount:</strong> ${(tx.amount || 0).toFixed(4)} ${tx.dpDenom || ''}</div>
                        <div><strong>Time:</strong> ${new Date(tx.timestamp).toLocaleString()}</div>
                    `);

                    // 툴팁 표시 애니메이션
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", 1);

                    // 툴팁 위치 설정
                    tooltip.style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 35) + "px");
                })
                .on("mouseout", function() {
                    // 노드 원래 상태로
                    d3.select(this).select(".tx-node")
                        .attr("opacity", isCurrentNodeFrom ? 1 : 0.8);

                    // 툴팁 숨기기 애니메이션
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });

            // To 노드 그리기 - 체인 간 거래 또는 내부 거래
            if (tx.fromChain !== tx.toChain) {
                // 다른 체인으로 가는 경우 수신 노드 위치
                createToNode(x, toY);
            } else {
                // 같은 체인 내 거래인 경우 수신 노드 위치 (발신 노드 옆)
                createToNode(x + 15, fromY);
            }

            // 수신 노드 생성 함수
            function createToNode(nodeX, nodeY) {
                const toNodeGroup = svg.append("g")
                    .attr("class", "tx-node-group")
                    .attr("transform", `translate(${nodeX},${nodeY})`);

                // 노드 색상 및 스타일 설정
                let toStrokeColor = "#4CAF50";   // 수신 노드 기본 색상
                let toDashArray = null;          // 대시 패턴

                // 내부 거래인 경우 색상 변경
                if (isInternalTx) {
                    toStrokeColor = "#9C27B0"; // 내부 거래는 보라색
                }

                // 현재 노드인 경우 표시
                if (isCurrentNodeTo) {
                    toDashArray = "3,2";
                    toNodeGroup.append("circle")
                        .attr("r", nodeRadius + 5)
                        .attr("fill", "none")
                        .attr("stroke", "#2196F3") // 현재 노드는 파란색
                        .attr("stroke-width", 2)
                        .attr("stroke-dasharray", "2,1");
                }

                // 노드 외곽선 추가 (수신 노드)
                toNodeGroup.append("circle")
                    .attr("r", nodeRadius + 2)
                    .attr("fill", "none")
                    .attr("stroke", toStrokeColor)
                    .attr("stroke-width", 1.5)
                    .attr("stroke-dasharray", toDashArray);

                // 실제 노드
                toNodeGroup.append("circle")
                    .attr("class", `tx-node ${toNodeClass}`)
                    .attr("r", nodeRadius)
                    .attr("fill", getChainColor(tx.toChain))
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 0.5)
                    .attr("opacity", isCurrentNodeTo ? 1 : 0.8);

                // 이벤트를 그룹에 바인딩
                toNodeGroup
                    .on("mouseover", function(event) {
                        // 노드 강조
                        d3.select(this).select(".tx-node").attr("opacity", 1);

                        // 노드 유형 결정
                        let nodeType = "수신 노드";
                        if (isInternalTx) nodeType += " (내부 거래)";
                        if (isCurrentNodeTo) nodeType += " (현재 노드)";

                        // 툴팁 내용 업데이트
                        tooltip.html(`
                            <div><strong>노드 유형:</strong> ${nodeType}</div>
                            <div><strong>TX Hash:</strong> ${tx.txhash.substring(0, 10)}...</div>
                            <div><strong>From:</strong> ${shortenAddress(tx.fromAddress)}</div>
                            <div><strong>To:</strong> ${shortenAddress(tx.toAddress)}</div>
                            <div><strong>Amount:</strong> ${(tx.amount || 0).toFixed(4)} ${tx.dpDenom || ''}</div>
                            <div><strong>Time:</strong> ${new Date(tx.timestamp).toLocaleString()}</div>
                        `);

                        // 툴팁 표시 애니메이션
                        tooltip.transition()
                            .duration(200)
                            .style("opacity", 1);

                        // 툴팁 위치 설정
                        tooltip.style("left", (event.pageX + 15) + "px")
                            .style("top", (event.pageY - 35) + "px");
                    })
                    .on("mouseout", function() {
                        // 노드 원래 상태로
                        d3.select(this).select(".tx-node")
                            .attr("opacity", isCurrentNodeTo ? 1 : 0.8);

                        // 툴팁 숨기기 애니메이션
                        tooltip.transition()
                            .duration(500)
                            .style("opacity", 0);
                    });
            }
        });

        // 레전드 추가
        const legendGroup = svg.append("g")
            .attr("transform", `translate(${width - 240}, -35)`);

        // 노드 유형 범례
        const legendData = [
            { label: "발신 노드", color: "#FF5722", dash: null, x: 0 },
            { label: "수신 노드", color: "#4CAF50", dash: null, x: 60 },
            { label: "내부 거래", color: "#9C27B0", dash: null, x: 120 },
            { label: "현재 노드", color: "#2196F3", dash: "2,1", x: 180 }
        ];

        legendData.forEach(item => {
            const legendItem = legendGroup.append("g")
                .attr("transform", `translate(${item.x}, 0)`);

            // 외부 원 (현재 노드 표시용)
            if (item.label === "현재 노드") {
                legendItem.append("circle")
                    .attr("r", 6)
                    .attr("fill", "none")
                    .attr("stroke", item.color)
                    .attr("stroke-width", 2)
                    .attr("stroke-dasharray", item.dash);
            }

            // 노드 외곽선
            legendItem.append("circle")
                .attr("r", item.label === "현재 노드" ? 4 : 5)
                .attr("fill", "none")
                .attr("stroke", item.color)
                .attr("stroke-width", 1.5);

            // 내부 원
            legendItem.append("circle")
                .attr("r", item.label === "현재 노드" ? 2.5 : 3.5)
                .attr("fill", item.color);

            // 라벨
            legendItem.append("text")
                .attr("x", 8)
                .attr("y", 4)
                .attr("fill", "#555")
                .style("font-size", "9px")
                .text(item.label);
        });

        // 제목
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text("시간에 따른 체인 거래 흐름");

        // Clean up
        return () => {
            // 툴팁 제거하지 않고 유지 - 여러 번 생성 방지
            d3.select("body").selectAll(".storyline-tooltip")
                .style("opacity", 0)
                .style("pointer-events", "none");
        };

    }, [transactions, selectedAddress]);

    return (
        <div className="storyline-chart-container">
            <svg ref={svgRef} className="storyline-chart"></svg>
        </div>
    );
};

export default StoryLineChart;
