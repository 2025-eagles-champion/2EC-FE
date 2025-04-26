// 노드 포지셔닝 헬퍼
export const repositionNode = (nodeId, x, y, graphData, updateGraphData) => {
    const updatedNodes = graphData.nodes.map(node => {
        if (node.id === nodeId) {
            return { ...node, x, y, fx: x, fy: y };
        }
        return node;
    });

    updateGraphData({ ...graphData, nodes: updatedNodes });
};

// 그래프 중앙 포커싱
export const focusOnNode = (nodeId, graphData, svgRef, zoom) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (!node || !svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const scale = 2;
    const x = width / 2 - node.x * scale;
    const y = height / 2 - node.y * scale;

    d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
};
