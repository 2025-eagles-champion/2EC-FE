// src/components/TimeSeriesChart/TimeSeriesChart.jsx
// 4-space indentation – 단일 지표 + 체인별 라인+점(툴팁) 완전판
// --------------------------------------------------------------

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import "./TimeSeriesChart.css";
import { getChainColor } from "../../utils/colorUtils";

/* --------------------------- 상수 --------------------------- */
const METRIC_INFO = {
    volume:  { label: "거래량",           accessor: (d) => d.amount || 0 },
    txCount: { label: "거래 횟수",        accessor: () => 1 },
    vpt:     { label: "거래량/거래횟수",  accessor: null },
};

/* ------------------------ 컴포넌트 ------------------------- */
function TimeSeriesChart({ transactions = [], selectedAddress = "" }) {
    const svgRef = useRef(null);

    /* 상태 -------------------------------------------------- */
    const [series, setSeries] = useState([]);          // [{ chain, values:[{ts,val}] }]
    const [activeMetric, setActiveMetric] = useState("volume");

    /* ------------------------- 집계 ------------------------- */
    useEffect(() => {
        if (!transactions.length) {
            setSeries([]);
            return;
        }

        // 주소 필터
        const filtered = selectedAddress
            ? transactions.filter(
                (tx) =>
                    tx.fromAddress === selectedAddress ||
                        tx.toAddress === selectedAddress,
            )
            : transactions;

        // 체인×일자 집계
        const roll = d3.rollups(
            filtered,
            (v) => {
                const vol = d3.sum(v, (d) => d.amount ?? 0); // amount 없으면 0
                const cnt = v.length;
                return { volume: vol, txCount: cnt };
            },
            (d) => d.fromChain || "unknown",
            (d) => d3.timeDay.floor(new Date(d.timestamp)),
        );

        const newSeries = roll.map(([chain, byDate]) => {
            const arr = Array.from(byDate, ([ts, agg]) => ({
                ts,
                volume: agg.volume,
                txCount: agg.txCount,
            })).sort((a, b) => a.ts - b.ts);

            arr.forEach((d) => (d.vpt = d.txCount ? d.volume / d.txCount : 0));
            return { chain, values: arr };
        });

        setSeries(newSeries);
    }, [transactions, selectedAddress]);

    /* ---------------------- 차트 렌더링 ---------------------- */
    useEffect(() => {
        if (!svgRef.current) return;

        const margin = { top: 80, right: 20, bottom: 60, left: 65 };
        const width = svgRef.current.clientWidth - margin.left - margin.right;
        const height = 360 - margin.top - margin.bottom;

        // SVG 초기화
        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3
            .select(svgRef.current)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        if (!series.length) {
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .attr("fill", "#777")
                .text("표시할 데이터가 없습니다");
            return;
        }

        /* --------------------- x축 --------------------- */
        const allDates = series.flatMap((s) => s.values.map((d) => d.ts));
        const xScale = d3
            .scaleTime()
            .domain(d3.extent(allDates))
            .range([0, width]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(
                d3.axisBottom(xScale)
                    .ticks(6)
                    .tickFormat(d3.timeFormat("%m/%d")),
            )
            .selectAll("text")
            .attr("transform", "rotate(-40)")
            .attr("dy", "0.4em")
            .style("text-anchor", "end");

        /* ------------------- y축 ---------------------- */
        let maxVal = d3.max(series, (s) =>
            d3.max(s.values, (d) => d[activeMetric]),
        );
        if (!maxVal || !isFinite(maxVal)) maxVal = 1; // 0 방지

        const yScale = d3
            .scaleLinear()
            .domain([0, maxVal])
            .nice()
            .range([height, 0]);

        svg.append("g").call(d3.axisLeft(yScale).ticks(5));

        // 가로 그리드
        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(""))
            .selectAll("line")
            .attr("stroke", "#eee");

        /* -------------- 라인 + 점 ---------------------- */
        const lineGen = d3
            .line()
            .x((d) => xScale(d.ts))
            .y((d) => yScale(d[activeMetric]))
            .curve(d3.curveMonotoneX);

        const gSeries = svg
            .append("g")
            .selectAll("g")
            .data(series)
            .join("g");

        // path: 데이터가 2점 이상일 때만
        gSeries
            .filter((d) => d.values.length > 1)
            .append("path")
            .attr("fill", "none")
            .attr("stroke", (d) => getChainColor(d.chain))
            .attr("stroke-width", 2)
            .attr("d", (d) => lineGen(d.values));

        // 점은 항상
        gSeries
            .selectAll("circle")
            .data((d) => d.values)
            .join("circle")
            .attr("cx", (d) => xScale(d.ts))
            .attr("cy", (d) => yScale(d[activeMetric]))
            .attr("r", 3)
            .attr("fill", function (d, i, nodes) {
                const chain = nodes[i].parentNode.__data__.chain;
                return getChainColor(chain);
            });

        /* --------------- 범례 (체인) ------------------ */
        const legend = svg
            .append("g")
            .attr("class", "chain-legend")
            .attr("transform", `translate(0,${-50})`)
            .selectAll("g")
            .data(series)
            .join("g")
            .attr("transform", (d, i) => `translate(${i * 120},0)`);

        legend
            .append("rect")
            .attr("width", 18)
            .attr("height", 6)
            .attr("rx", 3)
            .attr("fill", (d) => getChainColor(d.chain));

        legend
            .append("text")
            .attr("x", 24)
            .attr("y", 6)
            .style("font-size", "11px")
            .attr("fill", "#555")
            .text((d) => d.chain);

        /* --------------- 제목 ------------------------- */
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -60)
            .attr("text-anchor", "middle")
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .text(`지표: ${METRIC_INFO[activeMetric].label}`);

        /* ---------------- 툴팁 ----------------------- */
        const tooltip = d3
            .select("body")
            .selectAll(".ts-tooltip")
            .data([null])
            .join("div")
            .attr("class", "ts-tooltip")
            .style("position", "absolute")
            .style("opacity", 0)
            .style("pointer-events", "none")
            .style("background", "white")
            .style("border", "1px solid #ddd")
            .style("border-radius", "4px")
            .style("padding", "6px")
            .style("font-size", "12px")
            .style("box-shadow", "0 1px 3px rgba(0,0,0,0.15)");

        // 점 hover
        gSeries
            .selectAll("circle")
            .on("mouseover", (event, d) => {
                tooltip
                    .html(
                        `<div><strong>${d3.timeFormat("%Y-%m-%d")(d.ts)}</strong></div>` +
                            `<div>${METRIC_INFO[activeMetric].label}: ${d[
                                activeMetric
                            ].toLocaleString()}</div>`,
                    )
                    .style("left", `${event.pageX + 15}px`)
                    .style("top", `${event.pageY - 35}px`)
                    .transition()
                    .duration(200)
                    .style("opacity", 0.95);
            })
            .on("mouseout", () =>
                tooltip.transition().duration(300).style("opacity", 0),
            );
    }, [series, activeMetric]);

    /* ------------------------ UI ------------------------ */
    return (
        <div className="ts-container">
            <div className="ts-toggle-bar">
                {Object.keys(METRIC_INFO).map((key) => (
                    <button
                        key={key}
                        className={`ts-toggle-btn ${
                            activeMetric === key ? "active" : ""
                        }`}
                        onClick={() => setActiveMetric(key)}
                        aria-pressed={activeMetric === key}
                    >
                        {METRIC_INFO[key].label}
                    </button>
                ))}
            </div>
            <svg ref={svgRef} className="ts-chart-svg"></svg>
        </div>
    );
}

export default TimeSeriesChart;
