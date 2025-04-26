// src/components/SankeyChart/SankeyChartUtils.js
// 샌키 차트 데이터 계산을 위한 보조 함수
export const calculateFlowValue = (links, selectedNode) => {
    const incomingFlow = links
        .filter(l => l.target === selectedNode)
        .reduce((sum, l) => sum + l.value, 0);

    const outgoingFlow = links
        .filter(l => l.source === selectedNode)
        .reduce((sum, l) => sum + l.value, 0);

    return {
        incomingFlow,
        outgoingFlow,
        netFlow: incomingFlow - outgoingFlow
    };
};
