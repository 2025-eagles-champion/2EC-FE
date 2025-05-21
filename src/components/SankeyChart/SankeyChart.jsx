// src/components/SankeyChart/SankeyChart.jsx
import React, { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import "./SankeyChart.css";
import { getChainColor, getTierColor } from "../../utils/colorUtils";
import { shortenAddress } from "../../utils/dataUtils";

const SankeyChart = ({ transactions, selectedAddress, addressData }) => {
    const svgRef = useRef(null);

    const sankeyData = useMemo(() => {
        if (!transactions || !selectedAddress || transactions.length === 0) {
            return { nodes: [], links: [] };
        }

        const nodeMap = new Map();
        const newLinks = [];

        // 1. 중심 노드 (selectedAddress) - depth: 1
        const selectedNodeInfo = addressData.find(
            (addr) =>
                addr.address === selectedAddress || addr.id === selectedAddress
        );
        nodeMap.set(selectedAddress, {
            id: selectedAddress,
            name: shortenAddress(selectedAddress, 5, 4), //
            chain:
                selectedNodeInfo?.chain ||
                selectedAddress.split("1")[0] ||
                "unknown", //
            tier: selectedNodeInfo?.tier || "bronze", //
            depth: 1, // 중심 노드는 depth 1로 명시
        });

        // 2. 관련 트랜잭션 필터링하여 입력(depth 0) 및 출력(depth 2) 노드와 링크 구성
        transactions.forEach((tx) => {
            // 선택된 노드로 들어오는 거래 (입력 노드)
            if (tx.toAddress === selectedAddress) {
                if (!nodeMap.has(tx.fromAddress)) {
                    const sourceNodeInfo = addressData.find(
                        (addr) =>
                            addr.address === tx.fromAddress ||
                            addr.id === tx.fromAddress
                    );
                    nodeMap.set(tx.fromAddress, {
                        id: tx.fromAddress,
                        name: shortenAddress(tx.fromAddress, 5, 4), //
                        chain:
                            sourceNodeInfo?.chain ||
                            tx.fromChain ||
                            tx.fromAddress.split("1")[0] ||
                            "unknown", //
                        tier: sourceNodeInfo?.tier || "bronze", //
                        depth: 0, // 입력 노드는 depth 0으로 명시
                    });
                }
                newLinks.push({
                    source: tx.fromAddress,
                    target: selectedAddress,
                    value: tx.amount || 1, //
                    denom: tx.dpDenom || tx.denom || "", //
                });
            }
            // 선택된 노드에서 나가는 거래 (출력 노드)
            else if (tx.fromAddress === selectedAddress) {
                if (!nodeMap.has(tx.toAddress)) {
                    const targetNodeInfo = addressData.find(
                        (addr) =>
                            addr.address === tx.toAddress ||
                            addr.id === tx.toAddress
                    );
                    nodeMap.set(tx.toAddress, {
                        id: tx.toAddress,
                        name: shortenAddress(tx.toAddress, 5, 4), //
                        chain:
                            targetNodeInfo?.chain ||
                            tx.toChain ||
                            tx.toAddress.split("1")[0] ||
                            "unknown", //
                        tier: targetNodeInfo?.tier || "bronze", //
                        depth: 2, // 출력 노드는 depth 2로 명시
                    });
                }
                newLinks.push({
                    source: selectedAddress,
                    target: tx.toAddress,
                    value: tx.amount || 1, //
                    denom: tx.dpDenom || tx.denom || "", //
                });
            }
        });

        // 링크 집계 (동일 소스-타겟 간 링크 합산)
        const aggregatedLinks = [];
        const linkAggMap = new Map();

        newLinks.forEach((link) => {
            const linkId = `${link.source}-${link.target}`;
            if (linkAggMap.has(linkId)) {
                linkAggMap.get(linkId).value += link.value;
            } else {
                linkAggMap.set(linkId, { ...link });
            }
        });
        aggregatedLinks.push(...linkAggMap.values());

        // depth 값에 따라 노드를 필터링하여 반환 (선택 사항, 현재는 모든 노드 반환)
        // 만약 정확히 3단계만 표시하고 싶다면, depth가 0, 1, 2인 노드만 필터링할 수 있습니다.
        const finalNodes = Array.from(nodeMap.values()).filter(
            (node) => node.depth === 0 || node.depth === 1 || node.depth === 2
        );

        // 필터링된 노드에 해당하는 링크만 남기기
        const finalNodeIds = new Set(finalNodes.map((n) => n.id));
        const finalLinks = aggregatedLinks.filter(
            (link) =>
                finalNodeIds.has(link.source) && finalNodeIds.has(link.target)
        );

        console.log(
            "Generated nodes by strict depth:",
            finalNodes.reduce((acc, node) => {
                acc[node.depth] = (acc[node.depth] || 0) + 1;
                return acc;
            }, {})
        );

        return {
            nodes: finalNodes,
            links: finalLinks,
        };
    }, [transactions, selectedAddress, addressData]);

    // 순환 참조 링크 감지 및 제거 함수
    const removeCyclicLinks = (data) => {
        if (!data || !data.nodes || !data.links) {
            return { nodes: [], links: [] };
        }

        const { nodes, links } = data;
        const nodeMap = new Map();

        // 노드 맵 생성
        nodes.forEach((node) => {
            nodeMap.set(node.id, {
                ...node,
                level: null,
                visited: false,
                visiting: false,
            });
        });

        // 각 노드의 깊이 수준 계산 (DFS로 사이클 감지)
        const detectCycles = (
            nodeId,
            visited = new Set(),
            path = new Set()
        ) => {
            if (path.has(nodeId)) {
                return true; // 사이클 감지
            }

            if (visited.has(nodeId)) {
                return false; // 이미 방문한 노드, 사이클 없음
            }

            visited.add(nodeId);
            path.add(nodeId);

            // 이 노드에서 출발하는 모든 링크 확인
            const outgoingLinks = links.filter(
                (link) => link.source === nodeId
            );
            for (const link of outgoingLinks) {
                if (detectCycles(link.target, visited, path)) {
                    return true;
                }
            }

            path.delete(nodeId);
            return false;
        };

        // 사이클이 포함된 링크 제거
        const nonCyclicLinks = links.filter((link) => {
            const sourceId = link.source;
            const targetId = link.target;

            // 자기 자신으로 돌아가는 링크 제거
            if (sourceId === targetId) {
                return false;
            }

            // 임시로 이 링크를 제거하고 사이클 감지
            const tempLinks = links.filter((l) => l !== link);
            const hasCycle = detectCycles(targetId, new Set(), new Set());

            return !hasCycle;
        });

        return {
            nodes: nodes,
            links: nonCyclicLinks,
        };
    };

    // 샌키 차트 렌더링
    useEffect(() => {
        if (!transactions || !selectedAddress || !svgRef.current) return;

        // 선택된 주소에 대한 정보 가져오기
        const addressInfo =
            addressData.find(
                (a) => a.address === selectedAddress || a.id === selectedAddress
            ) || {};

        try {
            // 순환 참조 감지 및 제거
            const { nodes, links } = removeCyclicLinks(sankeyData);

            // 데이터가 없는 경우 처리
            if (nodes.length === 0 || links.length === 0) {
                d3.select(svgRef.current).selectAll("*").remove();
                d3.select(svgRef.current)
                    .append("text")
                    .attr("x", svgRef.current.clientWidth / 2)
                    .attr("y", 150)
                    .attr("text-anchor", "middle")
                    .attr("fill", "#212529")
                    .text("이 노드의 거래 데이터가 없습니다");
                return;
            }

            // SVG 크기 설정
            const margin = { top: 20, right: 10, bottom: 20, left: 10 };
            const width =
                svgRef.current.clientWidth - margin.left - margin.right;
            const height = 400 - margin.top - margin.bottom;

            // 기존 SVG 내용 초기화
            d3.select(svgRef.current).selectAll("*").remove();

            // SVG 생성
            const svg = d3
                .select(svgRef.current)
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom);

            // 메인 그룹 생성
            const g = svg
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // 마우스 휠 이벤트 메시지는 g에 추가 (고정 위치)
            g.append("text")
                .attr("x", width / 2)
                .attr("y", -5)
                .attr("text-anchor", "middle")
                .attr("font-size", "11px")
                .attr("fill", "#6c757d")
                .text("마우스 휠: 확대/축소 | 드래그: 좌우 이동");

            // 클리핑 패스 추가
            svg.append("defs")
                .append("clipPath")
                .attr("id", "sankey-clip")
                .append("rect")
                .attr("width", width)
                .attr("height", height);

            // 클리핑 패스 적용할 그룹
            const chartArea = g
                .append("g")
                .attr("clip-path", "url(#sankey-clip)")
                .attr("class", "chart-area");

            // 줌 동작 정의
            const zoom = d3
                .zoom()
                .scaleExtent([0.5, 5])
                .on("zoom", (event) => {
                    chartArea.attr("transform", event.transform);
                });

            // SVG에 줌 동작 적용
            svg.call(zoom);

            // 노드 및 링크 매핑 (d3-sankey 요구사항에 맞춤)
            const nodeMap = {};
            nodes.forEach((node, i) => {
                nodeMap[node.id] = i;
            });

            const sankeyLinks = links.map((link) => ({
                source: nodeMap[link.source],
                target: nodeMap[link.target],
                value: Math.log(Math.max(1, link.value) + 1), // 최소값 설정
            }));

            // 최종 데이터 준비
            const graph = {
                nodes: nodes,
                links: sankeyLinks,
            };

            // 샌키 레이아웃 적용
            try {
                const sankeyGenerator = sankey()
                    .nodeWidth(12)
                    .nodePadding(8)
                    .extent([
                        [0, 0],
                        [width, height],
                    ]);

                const { nodes: layoutNodes, links: layoutLinks } =
                    sankeyGenerator(graph);

                // 페이지랭크 및 티어 안전하게 가져오기
                const pageRank =
                    addressInfo.pagerank !== undefined
                        ? addressInfo.pagerank
                        : addressInfo.final_score !== undefined
                        ? addressInfo.final_score
                        : 0.1;
                const tier = addressInfo.tier || "bronze";

                // 페이지랭크가 NaN이 아닌지 확인
                const displayRank = isNaN(pageRank)
                    ? 10
                    : (pageRank * 100).toFixed(1);

                // 링크 그리기
                const link = chartArea
                    .append("g")
                    .attr("class", "links")
                    .selectAll("path")
                    .data(layoutLinks)
                    .enter()
                    .append("path")
                    .attr("d", sankeyLinkHorizontal())
                    .attr("stroke", (d) => {
                        const sourceNode = nodes[d.source.index];
                        const targetNode = nodes[d.target.index];
                        return d3.interpolateRgb(
                            getChainColor(sourceNode.chain || "unknown"),
                            getChainColor(targetNode.chain || "unknown")
                        )(0.5);
                    })
                    .attr("stroke-width", (d) => Math.max(1, d.width))
                    .attr("opacity", 0.7)
                    .style("fill", "none")
                    .sort((a, b) => b.width - a.width);

                // 링크 호버 툴팁
                link.append("title").text((d) => {
                    const sourceNode = nodes[d.source.index];
                    const targetNode = nodes[d.target.index];
                    return `${sourceNode.name} → ${
                        targetNode.name
                    }\n${d.value.toFixed(4)}`;
                });

                // 노드 그리기
                const node = chartArea
                    .append("g")
                    .attr("class", "nodes")
                    .selectAll("rect")
                    .data(layoutNodes)
                    .enter()
                    .append("rect")
                    .attr("x", (d) => d.x0)
                    .attr("y", (d) => d.y0)
                    .attr("height", (d) => Math.max(1, d.y1 - d.y0))
                    .attr("width", (d) => d.x1 - d.x0)
                    .attr("fill", (d) => getChainColor(d.chain || "unknown"))
                    .attr("stroke", "#333")
                    .attr("stroke-opacity", 0.2);

                // 노드 호버 툴팁
                node.append("title").text(
                    (d) => `${d.name} (${d.chain || "unknown"})`
                );

                // 노드 레이블
                chartArea
                    .append("g")
                    .attr("class", "node-labels")
                    .selectAll("text")
                    .data(layoutNodes)
                    .enter()
                    .append("text")
                    .attr("x", (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
                    .attr("y", (d) => (d.y1 + d.y0) / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", (d) =>
                        d.x0 < width / 2 ? "start" : "end"
                    )
                    .text((d) => d.name)
                    .attr("font-size", "9px");

                // 선택된 노드 강조
                node.filter((d) => d.id === selectedAddress)
                    .attr("stroke", "#ff0000")
                    .attr("stroke-width", 2)
                    .attr("stroke-opacity", 1);

                // 깊이에 따른 배경 구분
                const depthColors = [
                    "rgba(0,0,0,0.07)",
                    "rgba(0,0,0,0.05)",
                    "rgba(0,0,0,0.03)",
                    "rgba(0,0,0,0.01)",
                ];

                // 깊이별 배경 영역 추가
                const maxDepth = Math.max(...nodes.map((d) => d.depth));
                for (let i = 0; i <= maxDepth; i++) {
                    // 각 깊이별 노드 그룹 찾기
                    const depthNodes = layoutNodes.filter((d) => d.depth === i);
                    if (depthNodes.length === 0) continue;

                    // 영역 계산
                    const minX = d3.min(depthNodes, (d) => d.x0);
                    const maxX = d3.max(depthNodes, (d) => d.x1);

                    // 배경 영역 추가
                    chartArea
                        .insert("rect", ":first-child")
                        .attr("class", "depth-background")
                        .attr("x", minX - 10)
                        .attr("y", 0)
                        .attr("width", maxX - minX + 20)
                        .attr("height", height)
                        .attr("fill", depthColors[i % depthColors.length])
                        .attr("rx", 5)
                        .attr("ry", 5);
                }

                // 깊이 레이블 추가
                const depthLabels = [
                    "중심 노드",
                    "1단계 연결 노드",
                    "2단계 연결 노드",
                    "3단계 연결 노드",
                ];
                for (let i = 0; i <= maxDepth; i++) {
                    // 각 깊이별 노드 그룹 찾기
                    const depthNodes = layoutNodes.filter((d) => d.depth === i);
                    if (depthNodes.length === 0) continue;

                    // 위치 계산
                    const minX = d3.min(depthNodes, (d) => d.x0);
                    const maxX = d3.max(depthNodes, (d) => d.x1);
                    const centerX = (minX + maxX) / 2;

                    // 깊이 레이블 추가
                    g.append("text")
                        .attr("class", "depth-label")
                        .attr("x", centerX)
                        .attr("y", height + 15)
                        .attr("text-anchor", "middle")
                        .attr("font-size", "9px")
                        .attr("fill", "#555")
                        .text(depthLabels[i] || `${i}단계 노드`);
                }

                svg.call(
                    zoom.transform,
                    d3.zoomIdentity.translate(0, 0).scale(1)
                );
            } catch (error) {
                console.error("Error rendering sankey chart:", error);
                svg.append("text")
                    .attr("x", width / 2)
                    .attr("y", height / 2)
                    .attr("text-anchor", "middle")
                    .attr("fill", "#212529")
                    .text("샌키 차트를 렌더링할 수 없습니다");
            }
        } catch (error) {
            console.error("Error in SankeyChart:", error);
            // 오류 메시지 표시
            d3.select(svgRef.current).selectAll("*").remove();
            d3.select(svgRef.current)
                .append("text")
                .attr("x", svgRef.current.clientWidth / 2)
                .attr("y", 150)
                .attr("text-anchor", "middle")
                .attr("fill", "#212529")
                .text("데이터 처리 중 오류가 발생했습니다");
        }
    }, [sankeyData, transactions, selectedAddress, addressData]);

    return (
        <div className="sankey-chart-container">
            <svg ref={svgRef} className="sankey-chart"></svg>
        </div>
    );
};

export default SankeyChart;
