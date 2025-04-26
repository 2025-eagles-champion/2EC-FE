import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './NetworkGraph.css';
import { getChainColor, getLinkColor, getNodeSize } from '../../utils/colorUtils';
import { transformTransactionsToGraphData } from '../../utils/dataUtils';

const NetworkGraph = ({ transactions, addressData, onNodeClick, selectedNode }) => {
    const svgRef = useRef(null);
    const [graphData, setGraphData] = useState(null);

    // 트랜잭션 데이터를 그래프 데이터로 변환
    useEffect(() => {
        if (transactions && addressData) {
            const data = transformTransactionsToGraphData(transactions, addressData);
            setGraphData(data);
        }
    }, [transactions, addressData]);

    // 그래프 렌더링
    useEffect(() => {
        if (!graphData || !svgRef.current) return;

        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;

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
                .distance(100)
            )
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("x", d3.forceX(width / 2).strength(0.1))
            .force("y", d3.forceY(height / 2).strength(0.1));

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
        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(graphData.nodes)
            .enter().append("circle")
            .attr("r", d => getNodeSize(d))
            .attr("fill", d => getChainColor(d.chain))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended)
            )
            .on("click", (event, d) => {
                event.stopPropagation();
                onNodeClick(d);
            });

        // 선택된 노드 강조 표시
        if (selectedNode) {
            node.attr("opacity", d => d.id === selectedNode.id ? 1 : 0.5);
            link.attr("opacity", d =>
                d.source.id === selectedNode.id || d.target.id === selectedNode.id ? 1 : 0.2
            );
        }

        // 노드에 툴팁 추가
        node.append("title")
            .text(d => `${d.id} (${d.chain})`);

        // 시뮬레이션 이벤트 핸들러
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
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
            d.fx = null;
            d.fy = null;
        }

        // 선택된 노드가 있으면 뷰를 해당 노드로 초점 맞추기
        if (selectedNode) {
            const nodeObj = graphData.nodes.find(n => n.id === selectedNode.id);
            if (nodeObj) {
                const scale = 2;
                const x = width / 2 - nodeObj.x * scale;
                const y = height / 2 - nodeObj.y * scale;

                svg.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
            }
        }

        // 컴포넌트 언마운트 시 정리
        return () => {
            simulation.stop();
        };
    }, [graphData, selectedNode, onNodeClick]);

    return (
        <div className="network-graph-container">
            <svg ref={svgRef} className="network-graph"></svg>
        </div>
    );
};

export default NetworkGraph;
