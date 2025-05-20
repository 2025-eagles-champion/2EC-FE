// src/components/NetworkGraph/NetworkGraph.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import './NetworkGraph.css';
import { getChainColor, getLinkColor, getNodeSize } from '../../utils/colorUtils';
import { shortenAddress } from '../../utils/dataUtils';

const NetworkGraph = ({ transactions, addressData, onNodeClick, selectedNode }) => {
    const svgRef = useRef(null);
    const [graphData, setGraphData] = useState(null);
    const [viewportWidth, setViewportWidth] = useState(window.innerWidth * 0.7);
    const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

    // 트랜잭션 데이터를 그래프 데이터로 변환하는 로직 최적화
    const transformedGraphData = useMemo(() => {
        if (!transactions || !addressData || transactions.length === 0 || addressData.length === 0) {
            return { nodes: [], links: [] };
        }

        console.log('그래프 데이터 변환 시작:', transactions.length, '트랜잭션,', addressData.length, '주소 데이터');

        // 주소 인덱스 맵 생성
        const addressMap = new Map();
        addressData.forEach(addr => {
            if (addr && addr.address) {
                addressMap.set(addr.address, addr);
            }
        });

        // 노드 및 링크 생성
        const nodes = new Map();
        const links = new Map();

        // 먼저 Top-K 노드들을 추가 (중요도 순서로 정렬)
        const sortedAddressData = [...addressData].sort((a, b) => {
            // final_score 또는 pagerank로 정렬
            const scoreA = a.final_score !== undefined ? a.final_score : (a.pagerank || 0);
            const scoreB = b.final_score !== undefined ? b.final_score : (b.pagerank || 0);
            return scoreB - scoreA;
        });

        // 노드 추가
        sortedAddressData.forEach(addr => {
            if (addr && addr.address && !nodes.has(addr.address)) {
                nodes.set(addr.address, {
                    id: addr.address,
                    name: shortenAddress(addr.address, 5, 4),
                    chain: addr.chain || addr.address.split('1')[0] || 'unknown',
                    sent_tx_count: addr.sent_tx_count || 0,
                    recv_tx_count: addr.recv_tx_count || 0,
                    sent_tx_amount: addr.sent_tx_amount || 0,
                    recv_tx_amount: addr.recv_tx_amount || 0,
                    pagerank: addr.pagerank || addr.final_score || 0.1,
                    tier: addr.tier || 'bronze',
                    isTopNode: sortedAddressData.slice(0, 10).some(top => top.address === addr.address)
                });
            }
        });

        // 트랜잭션으로부터 링크 생성
        transactions.forEach(tx => {
            if (!tx || !tx.fromAddress || !tx.toAddress) {
                return;
            }

            // fromAddress 및 toAddress가 주소 목록에 있는지 확인 (2-depth 제한을 위함)
            if (!nodes.has(tx.fromAddress) && !nodes.has(tx.toAddress)) {
                return; // 둘 다 주요 노드 집합에 없으면 링크 생성 안 함
            }

            // 아직 없는 노드라면 추가
            if (!nodes.has(tx.fromAddress)) {
                const addrInfo = addressMap.get(tx.fromAddress) || {};
                nodes.set(tx.fromAddress, {
                    id: tx.fromAddress,
                    name: shortenAddress(tx.fromAddress, 5, 4),
                    chain: tx.fromChain || 'unknown',
                    sent_tx_count: addrInfo.sent_tx_count || 0,
                    recv_tx_count: addrInfo.recv_tx_count || 0,
                    sent_tx_amount: addrInfo.sent_tx_amount || 0,
                    recv_tx_amount: addrInfo.recv_tx_amount || 0,
                    pagerank: addrInfo.pagerank || 0.1,
                    tier: addrInfo.tier || 'bronze',
                    isTopNode: false
                });
            }

            if (!nodes.has(tx.toAddress)) {
                const addrInfo = addressMap.get(tx.toAddress) || {};
                nodes.set(tx.toAddress, {
                    id: tx.toAddress,
                    name: shortenAddress(tx.toAddress, 5, 4),
                    chain: tx.toChain || 'unknown',
                    sent_tx_count: addrInfo.sent_tx_count || 0,
                    recv_tx_count: addrInfo.recv_tx_count || 0,
                    sent_tx_amount: addrInfo.sent_tx_amount || 0,
                    recv_tx_amount: addrInfo.recv_tx_amount || 0,
                    pagerank: addrInfo.pagerank || 0.1,
                    tier: addrInfo.tier || 'bronze',
                    isTopNode: false
                });
            }

            // 링크 생성 또는 업데이트
            const linkId = `${tx.fromAddress}-${tx.toAddress}`;
            if (!links.has(linkId)) {
                links.set(linkId, {
                    source: tx.fromAddress,
                    target: tx.toAddress,
                    value: tx.amount || 0,
                    count: 1,
                    transactions: [tx],
                    isCrossChain: tx.fromChain !== tx.toChain
                });
            } else {
                const link = links.get(linkId);
                link.value += (tx.amount || 0);
                link.count += 1;
                link.transactions.push(tx);
            }
        });

        console.log('그래프 데이터 변환 완료:', nodes.size, '노드,', links.size, '링크');

        return {
            nodes: Array.from(nodes.values()),
            links: Array.from(links.values())
        };
    }, [transactions, addressData]);

    // 뷰포트 크기 변경 감지
    useEffect(() => {
        const handleResize = () => {
            setViewportWidth(window.innerWidth * 0.7);
            setViewportHeight(window.innerHeight);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 변환된 그래프 데이터 설정
    useEffect(() => {
        setGraphData(transformedGraphData);
    }, [transformedGraphData]);

    // 그래프 렌더링
    useEffect(() => {
        if (!graphData || !svgRef.current) return;

        const width = viewportWidth;
        const height = viewportHeight;

        // 기존 SVG 요소 초기화
        d3.select(svgRef.current).selectAll("*").remove();

        // SVG 요소 생성
        const svg = d3.select(svgRef.current)
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height]);

        // 줌 설정
        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

        // 노드와 링크를 포함할 컨테이너 그룹
        const g = svg.append("g");

        // 시뮬레이션 설정
        const simulation = d3.forceSimulation(graphData.nodes)
            .force("link", d3.forceLink(graphData.links)
                .id(d => d.id)
                .distance(d => {
                    // Top 노드라면 더 멀리 배치
                    const source = typeof d.source === 'object' ? d.source : graphData.nodes.find(n => n.id === d.source);
                    const target = typeof d.target === 'object' ? d.target : graphData.nodes.find(n => n.id === d.target);

                    if (source.isTopNode && target.isTopNode) {
                        return 200; // Top 노드끼리는 더 멀리
                    } else if (source.isTopNode || target.isTopNode) {
                        return 150; // Top 노드와 일반 노드
                    }
                    return 100; // 일반 노드끼리
                })
            )
            .force("charge", d3.forceManyBody()
                .strength(d => d.isTopNode ? -800 : -400)
            )
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("x", d3.forceX(width / 2).strength(0.1))
            .force("y", d3.forceY(height / 2).strength(0.1))
            .force("collision", d3.forceCollide().radius(d => getNodeSize(d) * 1.5));

        // 링크 생성
        const link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graphData.links)
            .enter().append("line")
            .attr("stroke-width", d => Math.sqrt(d.value) * 0.5)
            .attr("stroke", d => {
                // 객체 참조 또는 문자열 ID일 수 있으므로 안전하게 처리
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;

                const source = graphData.nodes.find(node => node.id === sourceId);
                const target = graphData.nodes.find(node => node.id === targetId);

                return getLinkColor(source, target);
            })
            .attr("stroke-opacity", 0.6);

        // 노드 생성
        const nodeGroup = g.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(graphData.nodes)
            .enter().append("g")
            .attr("class", d => `node ${d.isTopNode ? 'top-node' : ''}`)
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended)
            )
            .on("click", (event, d) => {
                event.stopPropagation();
                onNodeClick(d);
            });

        // 노드 원형 생성
        nodeGroup.append("circle")
            .attr("r", d => getNodeSize(d))
            .attr("fill", d => getChainColor(d.chain))
            .attr("stroke", d => d.isTopNode ? "#fff" : "rgba(255,255,255,0.5)")
            .attr("stroke-width", d => d.isTopNode ? 2 : 1.5);

        // 중요도 있는 노드는 테두리 추가
        nodeGroup.filter(d => d.isTopNode)
            .append("circle")
            .attr("r", d => getNodeSize(d) + 4)
            .attr("fill", "none")
            .attr("stroke", d => getChainColor(d.chain))
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.5)
            .attr("stroke-dasharray", "3,2");

        // 노드 라벨 추가
        nodeGroup.append("text")
            .attr("dy", d => getNodeSize(d) + 15)
            .attr("text-anchor", "middle")
            .attr("class", "node-label")
            .text(d => d.name || shortenAddress(d.id, 5, 4))
            .attr("opacity", d => d.isTopNode ? 1 : 0.7);

        // 선택된 노드 강조 표시
        if (selectedNode) {
            nodeGroup.attr("opacity", d => d.id === selectedNode.id ? 1 : 0.5);
            link.attr("opacity", d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return sourceId === selectedNode.id || targetId === selectedNode.id ? 1 : 0.2;
            });
        }

        // 노드에 툴팁 추가
        nodeGroup.append("title")
            .text(d => `${d.id} (${d.chain})\n거래 횟수: ${d.sent_tx_count + d.recv_tx_count}\n거래량: ${(d.sent_tx_amount + d.recv_tx_amount).toFixed(2)}`);

        // 시뮬레이션 이벤트 핸들러
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            nodeGroup
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // 드래그 함수
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            // Top 노드가 아니면 고정 해제
            if (!d.isTopNode) {
                d.fx = null;
                d.fy = null;
            }
        }

        // 선택된 노드가 있으면 뷰를 해당 노드로 초점 맞추기
        if (selectedNode) {
            const nodeObj = graphData.nodes.find(n => n.id === selectedNode.id);
            if (nodeObj) {
                const scale = 2;
                const x = width / 2 - (nodeObj.x || 0) * scale;
                const y = height / 2 - (nodeObj.y || 0) * scale;

                svg.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
            }
        }

        // 컴포넌트 언마운트 시 정리
        return () => {
            simulation.stop();
        };
    }, [graphData, selectedNode, onNodeClick, viewportWidth, viewportHeight]);

    return (
        <div className="network-graph-container">
            <svg ref={svgRef} className="network-graph"></svg>
        </div>
    );
};

export default NetworkGraph;
