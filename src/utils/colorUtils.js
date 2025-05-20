// src/utils/colorUtils.js
import { chainColors } from '../constants/chainColors';
import { tierConfig } from '../constants/tierConfig';

// 체인 색상 가져오기
export const getChainColor = (chain) => {
    if (!chain) return chainColors.default;

    // 체인이 소문자여야 하는 경우 변환
    const normalizedChain = typeof chain === 'string' ? chain.toLowerCase() : chain;

    return chainColors[normalizedChain] || chainColors.default;
};

// 링크(간선) 색상 결정 함수
export const getLinkColor = (source, target, opacity = 0.6) => {
    // source나 target이 undefined인 경우 기본 색상 반환
    if (!source || !target || source.chain === undefined || target.chain === undefined) {
        return `rgba(200, 200, 200, ${opacity})`;
    }

    // 다른 체인 간 거래인 경우
    if (source.chain !== target.chain) {
        return `rgba(255, 165, 0, ${opacity})`; // 오렌지 계열 색상
    }

    // 같은 체인 내 거래
    const baseColor = getChainColor(source.chain);

    // rgba 형식 색상 처리
    if (baseColor.startsWith('rgba') || baseColor.startsWith('rgb')) {
        return baseColor;
    }

    // 헥스 색상을 rgba로 변환
    return hexToRgba(baseColor, opacity);
};

// 노드 크기 결정 함수
export const getNodeSize = (node) => {
    if (!node) return 5;

    const baseSize = 5;
    const txCount = (node.sent_tx_count || 0) + (node.recv_tx_count || 0);
    const txVolume = (node.sent_tx_amount || 0) + (node.recv_tx_amount || 0);

    // Top 노드는 더 크게 표시
    const topNodeBonus = node.isTopNode ? 2 : 0;

    // 거래 수와 거래량 기반으로 크기 조정
    return baseSize + Math.min(10, Math.sqrt(txCount) * 0.5 + Math.sqrt(txVolume) / 10) + topNodeBonus;
};

// 노드 티어별 색상 반환 함수
export const getTierColor = (tier) => {
    if (!tier) return tierConfig.bronze.color;

    return tierConfig[tier.toLowerCase()]?.color || tierConfig.bronze.color;
};

// 링크 두께 결정 함수
export const getLinkWidth = (link) => {
    if (!link) return 1;

    // 거래량 기준으로 링크 두께 결정 (1~10 사이 값)
    const minWidth = 1;
    const maxWidth = 10;
    const minValue = 0;
    const maxValue = 200; // 적절히 조정 필요

    return minWidth + ((link.value - minValue) / (maxValue - minValue)) * (maxWidth - minWidth);
};

// 헥스 색상을 rgba로 변환하는 헬퍼 함수
const hexToRgba = (hex, opacity) => {
    if (!hex) return `rgba(200, 200, 200, ${opacity})`;

    // #을 제거
    let h = hex.replace('#', '');

    // 3자리 헥스 코드인 경우 6자리로 변환
    if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }

    // 16진수를 10진수로 변환
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
