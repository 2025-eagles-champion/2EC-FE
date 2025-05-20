// src/components/SankeyChart/SankeyChart.jsx
import React, { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import "./SankeyChart.css";
import { getChainColor, getTierColor } from "../../utils/colorUtils";
import { shortenAddress } from "../../utils/dataUtils";

const SankeyChart = ({ transactions, selectedAddress, addressData }) => {
    const svgRef = useRef(null);

    // 샌키 차트용 데이터 변환 (2-depth 제한)
    const sankeyData = useMemo(() => {
        if (!transactions || !selectedAddress || transactions.length === 0) {
            return { nodes: [], links: [] };
        }

        // 관련 트랜잭션 필터링 및 깊이 계산
        const relevantTxs = transactions.filter((tx) => {
            // 선택된 노드와 직접 관련된 거래만 포함
            return (
                tx.fromAddress === selectedAddress ||
                tx.toAddress === selectedAddress
            );
        });

        // 주소 맵 생성 (고유한 노드 구성)
        const nodeMap = new Map();

        // 선택된 노드를 중심으로 2-depth 노드들 식별
        const selectedNode = addressData.find(
            (addr) =>
                addr.address === selectedAddress || addr.id === selectedAddress
        );

        // 먼저 중심 노드 추가
        if (selectedNode) {
            nodeMap.set(selectedAddress, {
                id: selectedAddress,
                name: shortenAddress(selectedAddress, 5, 4),
                chain:
                    selectedNode.chain ||
                    selectedAddress.split("1")[0] ||
                    "unknown",
                depth: 0, // 중심 노드
                tier: selectedNode.tier || "bronze",
            });
        } else {
            // 중심 노드 정보가 없을 경우 기본값으로 설정
            nodeMap.set(selectedAddress, {
                id: selectedAddress,
                name: shortenAddress(selectedAddress, 5, 4),
                chain: selectedAddress.split("1")[0] || "unknown",
                depth: 0,
                tier: "bronze",
            });
        }

        // 1-depth 수신/발신 노드 추가
        relevantTxs.forEach((tx) => {
            if (tx.fromAddress === selectedAddress) {
                // 발신 노드인 경우 수신자를 1-depth로 추가
                if (!nodeMap.has(tx.toAddress)) {
                    const node = addressData.find(
                        (addr) =>
                            addr.address === tx.toAddress ||
                            addr.id === tx.toAddress
                    );
                    nodeMap.set(tx.toAddress, {
                        id: tx.toAddress,
                        name: shortenAddress(tx.toAddress, 5, 4),
                        chain:
                            tx.toChain ||
                            tx.toAddress.split("1")[0] ||
                            "unknown",
                        depth: 1, // 1-depth
                        tier: node?.tier || "bronze",
                        direction: "out", // 중심 노드에서 나가는 방향
                    });
                }
            } else if (tx.toAddress === selectedAddress) {
                // 수신 노드인 경우 발신자를 1-depth로 추가
                if (!nodeMap.has(tx.fromAddress)) {
                    const node = addressData.find(
                        (addr) =>
                            addr.address === tx.fromAddress ||
                            addr.id === tx.fromAddress
                    );
                    nodeMap.set(tx.fromAddress, {
                        id: tx.fromAddress,
                        name: shortenAddress(tx.fromAddress, 5, 4),
                        chain:
                            tx.fromChain ||
                            tx.fromAddress.split("1")[0] ||
                            "unknown",
                        depth: 1, // 1-depth
                        tier: node?.tier || "bronze",
                        direction: "in", // 중심 노드로 들어오는 방향
                    });
                }
            }
        });

        // 2-depth 노드 추가
        // 1-depth 노드들의 관련 거래 확인
        const depth1Addresses = Array.from(nodeMap.values())
            .filter((node) => node.depth === 1)
            .map((node) => node.id);

        // 2-depth 노드 추가를 위한 추가 트랜잭션 필터링
        const depth2Txs = transactions.filter(
            (tx) =>
                (depth1Addresses.includes(tx.fromAddress) &&
                    tx.toAddress !== selectedAddress) ||
                (depth1Addresses.includes(tx.toAddress) &&
                    tx.fromAddress !== selectedAddress)
        );

        // 2-depth 노드 추가 (상위 20개만 추가)
        const depth2Counter = new Map(); // 거래량 집계

        depth2Txs.forEach((tx) => {
            // 1-depth 노드에서 발신하는 거래
            if (
                depth1Addresses.includes(tx.fromAddress) &&
                tx.toAddress !== selectedAddress
            ) {
                if (!nodeMap.has(tx.toAddress)) {
                    const amount = tx.amount || 0;
                    depth2Counter.set(
                        tx.toAddress,
                        (depth2Counter.get(tx.toAddress) || 0) + amount
                    );
                }
            }
            // 1-depth 노드로 수신되는 거래
            else if (
                depth1Addresses.includes(tx.toAddress) &&
                tx.fromAddress !== selectedAddress
            ) {
                if (!nodeMap.has(tx.fromAddress)) {
                    const amount = tx.amount || 0;
                    depth2Counter.set(
                        tx.fromAddress,
                        (depth2Counter.get(tx.fromAddress) || 0) + amount
                    );
                }
            }
        });

        // 상위 거래량 2-depth 노드 추가 (상위 10개)
        const top2DepthNodes = Array.from(depth2Counter.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        top2DepthNodes.forEach(([address, amount]) => {
            // 해당 주소 관련 거래 찾기
            const relatedTx = depth2Txs.find(
                (tx) => tx.fromAddress === address || tx.toAddress === address
            );

            if (relatedTx) {
                const isSource = relatedTx.fromAddress === address;
                const node = addressData.find(
                    (addr) => addr.address === address || addr.id === address
                );

                nodeMap.set(address, {
                    id: address,
                    name: shortenAddress(address, 4, 3),
                    chain: isSource
                        ? relatedTx.fromChain
                        : relatedTx.toChain ||
                          address.split("1")[0] ||
                          "unknown",
                    depth: 2, // 2-depth
                    tier: node?.tier || "bronze",
                    direction: isSource ? "in" : "out", // 중심 노드 기준 방향
                    amount: amount, // 집계된 거래량
                });
            }
        });

        // 링크 생성
        const links = [];

        // 중심 노드와 1-depth 노드 간 링크
        relevantTxs.forEach((tx) => {
            if (
                tx.fromAddress === selectedAddress &&
                nodeMap.has(tx.toAddress)
            ) {
                links.push({
                    source: tx.fromAddress,
                    target: tx.toAddress,
                    value: tx.amount || 1,
                    denom: tx.dpDenom || tx.denom || "",
                });
            } else if (
                tx.toAddress === selectedAddress &&
                nodeMap.has(tx.fromAddress)
            ) {
                links.push({
                    source: tx.fromAddress,
                    target: tx.toAddress,
                    value: tx.amount || 1,
                    denom: tx.dpDenom || tx.denom || "",
                });
            }
        });

        // 1-depth와 2-depth 노드 간 링크
        depth2Txs.forEach((tx) => {
            if (nodeMap.has(tx.fromAddress) && nodeMap.has(tx.toAddress)) {
                // 이미 추가된 노드들 간의 링크만 추가
                links.push({
                    source: tx.fromAddress,
                    target: tx.toAddress,
                    value: tx.amount || 1,
                    denom: tx.dpDenom || tx.denom || "",
                });
            }
        });

        // 링크 집계 (동일 소스-타겟 간 링크 합산)
        const aggregatedLinks = [];
        const linkMap = new Map();

        links.forEach((link) => {
            const linkId = `${link.source}-${link.target}`;
            if (linkMap.has(linkId)) {
                linkMap.get(linkId).value += link.value;
            } else {
                linkMap.set(linkId, { ...link });
            }
        });

        // 최종 집계된 링크
        aggregatedLinks.push(...linkMap.values());

        return {
            nodes: Array.from(nodeMap.values()),
            links: aggregatedLinks,
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
            const height = 300 - margin.top - margin.bottom;

            // 기존 SVG 내용 초기화
            d3.select(svgRef.current).selectAll("*").remove();

            // SVG 생성
            const svg = d3
                .select(svgRef.current)
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // 노드 및 링크 매핑 (d3-sankey 요구사항에 맞춤)
            const nodeMap = {};
            nodes.forEach((node, i) => {
                nodeMap[node.id] = i;
            });

            const sankeyLinks = links.map((link) => ({
                source: nodeMap[link.source],
                target: nodeMap[link.target],
                value: Math.max(0.1, link.value), // 최소값 설정
            }));

            // 최종 데이터 준비
            const graph = {
                nodes: nodes,
                links: sankeyLinks,
            };

            // 샌키 레이아웃 적용
            try {
                const sankeyGenerator = sankey()
                    .nodeWidth(15)
                    .nodePadding(10)
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

                // // 티어 정보 표시
                // svg.append("text")
                //     .attr("class", "tier-info")
                //     .attr("x", width / 2)
                //     .attr("y", -5)
                //     .attr("text-anchor", "middle")
                //     .attr("fill", getTierColor(tier))
                //     .text(
                //         `${
                //             tier.charAt(0).toUpperCase() + tier.slice(1)
                //         } 티어 (신뢰도: ${displayRank}%)`
                //     );

                // 링크 그리기
                const link = svg
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
                const node = svg
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
                svg.append("g")
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
                    .attr("font-size", "10px");

                // 선택된 노드 강조
                node.filter((d) => d.id === selectedAddress)
                    .attr("stroke", "#ff0000")
                    .attr("stroke-width", 2)
                    .attr("stroke-opacity", 1);

                // 깊이에 따른 배경 구분
                const depthColors = [
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
                    svg.insert("rect", ":first-child")
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
                    svg.append("text")
                        .attr("class", "depth-label")
                        .attr("x", centerX)
                        .attr("y", height + 15)
                        .attr("text-anchor", "middle")
                        .attr("font-size", "9px")
                        .attr("fill", "#555")
                        .text(depthLabels[i] || `${i}단계 노드`);
                }
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
