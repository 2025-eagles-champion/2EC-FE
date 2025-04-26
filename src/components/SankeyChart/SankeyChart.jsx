// src/components/SankeyChart/SankeyChart.jsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import './SankeyChart.css';
import { getChainColor, getTierColor } from '../../utils/colorUtils';
import { transformToSankeyData } from '../../utils/dataUtils';
import { tierConfig } from '../../constants/tierConfig';

const SankeyChart = ({ transactions, selectedAddress, addressData }) => {
    const svgRef = useRef(null);

    useEffect(() => {
        if (!transactions || !selectedAddress || !svgRef.current) return;

        // 선택된 주소에 대한 정보 가져오기
        const addressInfo = addressData.find(a => a.address === selectedAddress || a.id === selectedAddress) || {};

        // 샌키 차트용 데이터 변환
        const sankeyData = transformToSankeyData(transactions, selectedAddress);

        // SVG 크기 설정
        const margin = { top: 20, right: 10, bottom: 20, left: 10 };
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

        // 샌키 레이아웃 설정
        const sankeyGenerator = sankey()
            .nodeWidth(15)
            .nodePadding(10)
            .extent([[0, 0], [width, height]]);

        // 데이터가 정상적으로 준비되었는지 확인
        if (sankeyData.nodes.length === 0 || sankeyData.links.length === 0) {
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .attr("fill", "#e9ecef")
                .text("No data available for Sankey chart");
            return;
        }

        // 노드 및 링크 매핑 (d3-sankey 요구사항에 맞춤)
        const nodeMap = {};
        sankeyData.nodes.forEach((node, i) => {
            nodeMap[node.id] = i;
        });

        const sankeyLinks = sankeyData.links.map(link => ({
            source: nodeMap[link.source],
            target: nodeMap[link.target],
            value: link.value
        }));

        // 최종 데이터 준비
        const graph = {
            nodes: sankeyData.nodes,
            links: sankeyLinks
        };

        // 샌키 레이아웃 적용
        const { nodes, links } = sankeyGenerator(graph);

        // 페이지랭크 및 티어 안전하게 가져오기
        const pageRank = addressInfo.pagerank !== undefined ? addressInfo.pagerank : 0.1;
        const tier = addressInfo.tier || 'bronze';

        // 페이지랭크가 NaN이 아닌지 확인
        const displayRank = isNaN(pageRank) ? 10 : (pageRank * 100).toFixed(1);

        // 티어 정보 표시
        svg.append("text")
            .attr("class", "tier-info")
            .attr("x", width / 2)
            .attr("y", -5)
            .attr("text-anchor", "middle")
            .attr("fill", getTierColor(tier))
            .text(`${tierConfig[tier]?.label || '브론즈'} 티어 (신뢰도: ${displayRank}%)`);

        // 링크 그리기
        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("path")
            .data(links)
            .enter().append("path")
            .attr("d", sankeyLinkHorizontal())
            .attr("stroke", d => {
                const sourceNode = sankeyData.nodes[d.source.index];
                const targetNode = sankeyData.nodes[d.target.index];
                return d3.interpolateRgb(
                    getChainColor(sourceNode.chain || 'unknown'),
                    getChainColor(targetNode.chain || 'unknown')
                )(0.5);
            })
            .attr("stroke-width", d => Math.max(1, d.width))
            .attr("opacity", 0.7)
            .style("fill", "none")
            .sort((a, b) => b.width - a.width);

        // 링크 호버 툴팁
        link.append("title")
            .text(d => {
                const sourceNode = sankeyData.nodes[d.source.index];
                const targetNode = sankeyData.nodes[d.target.index];
                return `${sourceNode.name} → ${targetNode.name}\n${d.value.toFixed(4)}`;
            });

        // 노드 그리기
        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("rect")
            .data(nodes)
            .enter().append("rect")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", d => d.x1 - d.x0)
            .attr("fill", d => getChainColor(d.chain || 'unknown'))
            .attr("stroke", "#333")
            .attr("stroke-opacity", 0.2);

        // 노드 호버 툴팁
        node.append("title")
            .text(d => `${d.name} (${d.chain || 'unknown'})`);

        // 노드 레이블
        svg.append("g")
            .attr("class", "node-labels")
            .selectAll("text")
            .data(nodes)
            .enter().append("text")
            .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
            .text(d => d.name)
            .attr("font-size", "10px");

        // 선택된 노드 강조
        node.filter(d => d.id === selectedAddress)
            .attr("stroke", "#ff0000")
            .attr("stroke-width", 2)
            .attr("stroke-opacity", 1);

    }, [transactions, selectedAddress, addressData]);

    return (
        <div className="sankey-chart-container">
            <svg ref={svgRef} className="sankey-chart"></svg>
        </div>
    );
};

export default SankeyChart;
