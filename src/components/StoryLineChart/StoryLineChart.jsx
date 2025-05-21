// src/components/StoryLineChart/StoryLineChart.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import "./StoryLineChart.css";
import { getChainColor } from "../../utils/colorUtils";
import { shortenAddress } from "../../utils/dataUtils";

/**
 * StoryLineChart - 선택된 노드와 거래량이 가장 많은 최대 8개 노드와의 거래 흐름을 시각화
 * @param {Array} transactions - 모든 트랜잭션 데이터 배열
 * @param {String} selectedAddress - 선택된 노드 주소
 */
const StoryLineChart = ({ transactions, selectedAddress }) => {
    const svgRef = useRef(null);
    
    // 선택된 노드와 거래량이 가장 많은 최대 8개 노드를 찾아내는 로직
    const topNodeData = useMemo(() => {
        if (!transactions || !selectedAddress || transactions.length === 0) {
            return { topNodes: [], relevantTxs: [] };
        }

        // 선택된 노드와 관련된 트랜잭션 필터링
        const relevantTxs = transactions.filter(tx =>
            tx.fromAddress === selectedAddress || tx.toAddress === selectedAddress
        ).sort((a, b) => a.timestamp - b.timestamp);

        if (relevantTxs.length === 0) {
            return { topNodes: [], relevantTxs: [] };
        }

        // 거래 상대방별 거래량 집계
        const counterpartyVolumes = new Map();
        
        relevantTxs.forEach(tx => {
            const counterparty = tx.fromAddress === selectedAddress ? tx.toAddress : tx.fromAddress;
            const amount = tx.amount || 0;
            
            counterpartyVolumes.set(
                counterparty, 
                (counterpartyVolumes.get(counterparty) || 0) + amount
            );
        });

        // 거래량 기준 내림차순 정렬 후 상위 8개 추출
        const topCounterparties = [...counterpartyVolumes.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([address]) => address);

        // 선택된 노드와 상위 노드들 간의 트랜잭션만 필터링
        const filteredTxs = relevantTxs.filter(tx => {
            const counterparty = tx.fromAddress === selectedAddress ? tx.toAddress : tx.fromAddress;
            return topCounterparties.includes(counterparty);
        });

        return { 
            topNodes: topCounterparties,
            relevantTxs: filteredTxs 
        };
    }, [transactions, selectedAddress]);

    useEffect(() => {
        if (!selectedAddress || !svgRef.current) return;

        const { topNodes, relevantTxs } = topNodeData;

        if (topNodes.length === 0 || relevantTxs.length === 0) {
            // 데이터가 없을 때 메시지 표시
            d3.select(svgRef.current).selectAll("*").remove();
            d3.select(svgRef.current)
                .append("text")
                .attr("x", svgRef.current.clientWidth / 2)
                .attr("y", 150)
                .attr("text-anchor", "middle")
                .attr("fill", "#6c757d")
                .text("거래량 기준으로 연결된 노드가 없습니다");
            return;
        }

        // 거래 참여 노드들의 집합 생성 (선택된 노드 + 상위 거래량 노드들)
        const participatingNodes = new Set([selectedAddress, ...topNodes]);

        // SVG 크기 설정
        const margin = { top: 40, right: 30, bottom: 50, left: 100 };
        const width = svgRef.current.clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        // 기존 SVG 내용 초기화
        d3.select(svgRef.current).selectAll("*").remove();

        // SVG 생성
        const svg = d3.select(svgRef.current)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);
            
        // 마우스 휠 이벤트 메시지 추가
        svg.append("text")
            .attr("x", width / 2 + margin.left)
            .attr("y", margin.top - 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("fill", "#6c757d")
            .text("마우스 휠: 확대/축소  |  드래그: 좌우 이동");
        
        // 메인 그룹 생성
        const g = svg.append("g")
            .attr("class", "main-chart-group")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        // 클리핑 패스 추가
        svg.append("defs").append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", width)
            .attr("height", height);
        
        // 클리핑 패스 적용할 그룹
        const chartArea = g.append("g")
            .attr("clip-path", "url(#clip)");

        // 시간 범위 계산
        const minTime = d3.min(relevantTxs, d => d.timestamp);
        const maxTime = d3.max(relevantTxs, d => d.timestamp);

        // 시간 범위가 너무 작으면 확장
        const timeRange = maxTime - minTime;
        const minTimeAdjusted = minTime - timeRange * 0.1;
        const maxTimeAdjusted = maxTime + timeRange * 0.1;

        // X축 (시간) 스케일 정의
        const xScale = d3.scaleTime()
            .domain([new Date(minTimeAdjusted), new Date(maxTimeAdjusted)])
            .range([0, width]);

        // 노드 위치 계산을 위한 Y 스케일 설정 (노드별 레인)
        const nodeArray = Array.from(participatingNodes);
        const nodeScale = d3.scaleBand()
            .domain(nodeArray)
            .range([0, height])
            .padding(0.3);

        // X축 생성
        const xAxis = g.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat("%m/%d %H:%M")));
        
        // X축 레이블 회전
        xAxis.selectAll("text")
            .attr("y", 10)
            .attr("transform", "rotate(0)")
            .style("text-anchor", "middle");

        // X축 레이블
        g.append("text")
            .attr("class", "x-label")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .attr("text-anchor", "middle")
            .text("시간");

        // 각 노드별 레인 및 노드 주소 라벨 추가
        nodeArray.forEach(nodeAddress => {
            // 노드의 체인 결정
            const nodeChain = relevantTxs.find(tx => 
                tx.fromAddress === nodeAddress ? tx.fromChain : 
                tx.toAddress === nodeAddress ? tx.toChain : null
            );
            
            const chainName = nodeChain ? 
                (nodeAddress === nodeChain.fromAddress ? nodeChain.fromChain : nodeChain.toChain) :
                nodeAddress.split('1')[0];

            // 레인 배경
            chartArea.append("rect")
                .attr("class", "lane-background")
                .attr("x", 0)
                .attr("y", nodeScale(nodeAddress))
                .attr("width", width)
                .attr("height", nodeScale.bandwidth())
                .attr("fill", getChainColor(chainName))
                .attr("fill-opacity", 0.05);

            // 레인 중심선
            chartArea.append("line")
                .attr("class", "lane-center-line")
                .attr("x1", 0)
                .attr("y1", nodeScale(nodeAddress) + nodeScale.bandwidth() / 2)
                .attr("x2", width)
                .attr("y2", nodeScale(nodeAddress) + nodeScale.bandwidth() / 2)
                .attr("stroke", getChainColor(chainName))
                .attr("stroke-width", 1)
                .attr("stroke-opacity", 0.5)
                .attr("stroke-dasharray", "3,3");

            // 선택된 노드인 경우 강조
            if (nodeAddress === selectedAddress) {
                g.append("rect")
                    .attr("class", "selected-node-marker")
                    .attr("x", -margin.left)
                    .attr("y", nodeScale(nodeAddress))
                    .attr("width", 3)
                    .attr("height", nodeScale.bandwidth())
                    .attr("fill", "#2196F3");
            }

            // 노드 주소 라벨
            svg.append("text")
                .attr("class", "node-label")
                .attr("x", margin.left - 10)
                .attr("y", margin.top + nodeScale(nodeAddress) + nodeScale.bandwidth() / 2)
                .attr("dy", "0.32em")
                .attr("text-anchor", "end")
                .attr("fill", "black")
                .attr("font-weight", nodeAddress === selectedAddress ? "bold" : "normal")
                .style("font-family", "Arial, Helvetica, sans-serif")
                .text(shortenAddress(nodeAddress, 6, 4));
        });

        // 툴팁 생성
        let tooltip = d3.select("body").select(".storyline-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body").append("div")
                .attr("class", "storyline-tooltip")
                .style("position", "absolute")
                .style("opacity", 0)
                .style("pointer-events", "none")
                .style("background-color", "white")
                .style("border", "1px solid #ddd")
                .style("border-radius", "4px")
                .style("padding", "8px")
                .style("font-size", "12px")
                .style("box-shadow", "0 1px 3px rgba(0,0,0,0.2)")
                .style("z-index", "10000");
        }

        // 거래 노드 그룹
        const txNodeGroup = chartArea.append("g")
            .attr("class", "tx-nodes");

        // 노드 간 곡선 생성 함수 정의
        const curve = d3.line()
            .x(d => d.x)
            .y(d => d.y);

        // 트랜잭션 시각화 (노드 간 연결 및 이벤트)
        relevantTxs.forEach(tx => {
            // 노드 크기 계산 (거래량에 따라)
            const nodeRadius = Math.max(3, Math.min(8, Math.log(tx.amount || 1) + 2));
            const strokeWidth = Math.max(1, Math.min(4, Math.log(tx.amount || 1) + 1));

            // 발신자와 수신자 위치 계산
            const txTime = new Date(tx.timestamp);
            const fromY = nodeScale(tx.fromAddress) + nodeScale.bandwidth() / 2;
            const toY = nodeScale(tx.toAddress) + nodeScale.bandwidth() / 2;
            const x = xScale(txTime);

            // 발신 노드가 선택된 노드인지
            const isFromSelected = tx.fromAddress === selectedAddress;
            
            // 중간 제어점 정의 (곡선을 위한)
            const controlPoints = [
                { x: x, y: fromY },
                { x: x, y: toY }
            ];

            // 연결선 그리기
            txNodeGroup.append("path")
                .attr("class", "tx-path")
                .datum(controlPoints)
                .attr("d", curve)
                .attr("stroke", d3.interpolateRgb(
                    getChainColor(tx.fromChain || "unknown"),
                    getChainColor(tx.toChain || "unknown")
                )(0.5))
                .attr("stroke-width", strokeWidth)
                .attr("stroke-opacity", 0.7)
                .attr("fill", "none");

            // 발신 노드 그리기
            const fromNodeGroup = txNodeGroup.append("g")
                .datum({            // 원본 좌표를 datum으로 넣어 둔다
                        x: x,         // = xScale(time)
                        y: fromY
                })
                .attr("class", "tx-node-group")
                .attr("transform", d => `translate(${d.x},${d.y})`);

            // 노드 스타일 설정
            let fromStrokeColor = isFromSelected ? "#FF5722" : "#4CAF50";
            
            // 선택된 노드인 경우 추가 강조
            if (tx.fromAddress === selectedAddress) {
                fromNodeGroup.append("circle")
                    .attr("r", nodeRadius + 5)
                    .attr("fill", "none")
                    .attr("stroke", "#2196F3")
                    .attr("stroke-width", 2)
                    .attr("stroke-dasharray", "2,1");
            }

            // 노드 외곽선
            fromNodeGroup.append("circle")
                .attr("r", nodeRadius + 2)
                .attr("fill", "none")
                .attr("stroke", fromStrokeColor)
                .attr("stroke-width", 1.5);

            // 실제 노드
            fromNodeGroup.append("circle")
                .attr("class", "tx-node")
                .attr("r", nodeRadius)
                .attr("fill", getChainColor(tx.fromChain || "unknown"))
                .attr("stroke", "#fff")
                .attr("stroke-width", 0.5)
                .attr("opacity", tx.fromAddress === selectedAddress ? 1 : 0.8);

            // 발신 노드 이벤트 (툴팁)
            fromNodeGroup
                .on("mouseover", function(event) {
                    // 노드 강조
                    d3.select(this).select(".tx-node").attr("opacity", 1);

                    // 툴팁 내용 업데이트
                    tooltip.html(`
                        <div><strong>발신 노드:</strong> ${shortenAddress(tx.fromAddress)}</div>
                        <div><strong>수신 노드:</strong> ${shortenAddress(tx.toAddress)}</div>
                        <div><strong>거래량:</strong> ${(tx.amount || 0).toFixed(4)} ${tx.dpDenom || ''}</div>
                        <div><strong>시간:</strong> ${new Date(tx.timestamp).toLocaleString()}</div>
                        <div><strong>TX Hash:</strong> ${tx.txhash.substring(0, 10)}...</div>
                    `);

                    // 툴팁 표시
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", 1);

                    // 툴팁 위치
                    tooltip.style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 35) + "px");
                })
                .on("mouseout", function() {
                    // 노드 원래 상태로
                    d3.select(this).select(".tx-node")
                        .attr("opacity", tx.fromAddress === selectedAddress ? 1 : 0.8);

                    // 툴팁 숨기기
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });

            // 수신 노드 그리기
            const toNodeGroup = txNodeGroup.append("g")
                .datum({x,y : toY}) 
                .attr("class", "tx-node-group")
                .attr("transform", `translate(${x},${toY})`);

            // 수신 노드 스타일 설정
            let toStrokeColor = isFromSelected ? "#4CAF50" : "#FF5722";

            // 선택된 노드인 경우 추가 강조
            if (tx.toAddress === selectedAddress) {
                toNodeGroup.append("circle")
                    .attr("r", nodeRadius + 5)
                    .attr("fill", "none")
                    .attr("stroke", "#2196F3")
                    .attr("stroke-width", 2)
                    .attr("stroke-dasharray", "2,1");
            }

            // 노드 외곽선
            toNodeGroup.append("circle")
                .attr("r", nodeRadius + 2)
                .attr("fill", "none")
                .attr("stroke", toStrokeColor)
                .attr("stroke-width", 1.5);

            // 실제 노드
            toNodeGroup.append("circle")
                .attr("class", "tx-node")
                .attr("r", nodeRadius)
                .attr("fill", getChainColor(tx.toChain || "unknown"))
                .attr("stroke", "#fff")
                .attr("stroke-width", 0.5)
                .attr("opacity", tx.toAddress === selectedAddress ? 1 : 0.8);

            // 수신 노드 이벤트 (툴팁)
            toNodeGroup
                .on("mouseover", function(event) {
                    // 노드 강조
                    d3.select(this).select(".tx-node").attr("opacity", 1);

                    // 툴팁 내용 업데이트
                    tooltip.html(`
                        <div><strong>발신 노드:</strong> ${shortenAddress(tx.fromAddress)}</div>
                        <div><strong>수신 노드:</strong> ${shortenAddress(tx.toAddress)}</div>
                        <div><strong>거래량:</strong> ${(tx.amount || 0).toFixed(4)} ${tx.dpDenom || ''}</div>
                        <div><strong>시간:</strong> ${new Date(tx.timestamp).toLocaleString()}</div>
                        <div><strong>TX Hash:</strong> ${tx.txhash.substring(0, 10)}...</div>
                    `);

                    // 툴팁 표시
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", 1);

                    // 툴팁 위치
                    tooltip.style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 35) + "px");
                })
                .on("mouseout", function() {
                    // 노드 원래 상태로
                    d3.select(this).select(".tx-node")
                        .attr("opacity", tx.toAddress === selectedAddress ? 1 : 0.8);

                    // 툴팁 숨기기
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });
        });

        // 제목
        svg.append("text")
            .attr("x", margin.left + width / 2)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text("거래량 상위 노드와의 거래 흐름");

        // 정보 텍스트
        if (topNodes.length > 0) {
            svg.append("text")
                .attr("x", margin.left + width / 2)
                .attr("y", 35)
                .attr("text-anchor", "middle")
                .attr("font-size", "11px")
                .attr("fill", "#666")
                .text(`선택된 노드와 거래량이 가장 많은 ${topNodes.length}개 노드 표시`);
        }

        // 범례 추가
        const legendGroup = svg.append("g")
            .attr("transform", `translate(${margin.left + width - 240}, ${margin.top - 35})`);

        // 노드 유형 범례
        const legendData = [
            { label: "발신 노드", color: "#FF5722", dash: null, x: 0 },
            { label: "수신 노드", color: "#4CAF50", dash: null, x: 60 },
            { label: "선택 노드", color: "#2196F3", dash: "2,1", x: 120 }
        ];

        legendData.forEach(item => {
            const legendItem = legendGroup.append("g")
                .attr("transform", `translate(${item.x}, 0)`);

            // 외부 원 (선택 노드 표시용)
            if (item.label === "선택 노드") {
                legendItem.append("circle")
                    .attr("r", 6)
                    .attr("fill", "none")
                    .attr("stroke", item.color)
                    .attr("stroke-width", 2)
                    .attr("stroke-dasharray", item.dash);
            }

            // 노드 외곽선
            legendItem.append("circle")
                .attr("r", item.label === "선택 노드" ? 4 : 5)
                .attr("fill", "none")
                .attr("stroke", item.color)
                .attr("stroke-width", 1.5);

            // 내부 원
            legendItem.append("circle")
                .attr("r", item.label === "선택 노드" ? 2.5 : 3.5)
                .attr("fill", item.color);

            // 라벨
            legendItem.append("text")
                .attr("x", 8)
                .attr("y", 4)
                .attr("fill", "#555")
                .style("font-size", "9px")
                .text(item.label);
        });
        
        // 확대/축소 및 패닝을 위한 줌 설정
        const zoom = d3.zoom()
            .scaleExtent([0.5, 100]) // 확대배율 설정
            .extent([[0, 0], [width, height]])
            .on("zoom", function(event) {
                // 현재 변환 값 가져오기
                const transform = event.transform;
                
                // 새로운 x축 스케일 생성
                const newXScale = transform.rescaleX(xScale);
                
                // x축 업데이트
                xAxis.call(
                    d3.axisBottom(newXScale)
                        .tickFormat(d3.timeFormat("%m/%d %H:%M"))
                );
                
                // 모든 트랜잭션 노드와 경로 업데이트
                txNodeGroup.selectAll(".tx-node-group")
                    .attr("transform", d => `translate(${event.transform.applyX(d.x)},${d.y})`);
                
                // 경로 업데이트
                txNodeGroup.selectAll(".tx-path")
                    .attr("d", function(d) {
                        // 기존 컨트롤 포인트 가져오기
                        const points = d3.select(this).datum();
                        
                        // x좌표만 변환한 새 포인트 생성
                        const newPoints = points.map(point => ({
                            x: event.transform.applyX(point.x),
                            y: point.y
                        }));
                        
                        return curve(newPoints);
                    });
                
                const xOnlyTransformString = `translate(${transform.x}, 0) scale(${transform.k}, 1)`;

                chartArea.selectAll(".lane-background")
                    .attr("transform", xOnlyTransformString);
                
                chartArea.selectAll(".lane-center-line")
                    .attr("transform", xOnlyTransformString);
            });
        
        // SVG 요소에 줌 적용
        svg.call(zoom)
            .on("wheel.zoom", function(event) {
                // 휠 이벤트가 있을 때 확대/축소하고 기본 동작 방지
                event.preventDefault();
                zoom.scaleBy(svg, event.deltaY > 0 ? 0.9 : 1.1);
            })
            .on("dblclick.zoom", null); // 더블 클릭 확대/축소 비활성화
        
        // 드래그 시작할 때 커서 변경
        svg.on("mousedown", function() {
            d3.select(this).style("cursor", "grabbing");
        });
        
        // 드래그 종료할 때 커서 복원
        svg.on("mouseup", function() {
            d3.select(this).style("cursor", "grab");
        });
            
        // Clean up
        return () => {
            // 툴팁 제거하지 않고 유지 - 여러 번 생성 방지
            d3.select("body").selectAll(".storyline-tooltip")
                .style("opacity", 0)
                .style("pointer-events", "none");
        };

    }, [topNodeData, selectedAddress]);

    return (
        <div className="storyline-chart-container">
            <svg ref={svgRef} className="storyline-chart"></svg>
        </div>
    );
};

export default StoryLineChart;