
// src/utils/colorUtils.js
import { chainColors } from '../constants/chainColors';
import { tierConfig } from '../constants/tierConfig';

// 체인 색상 가져오기
export const getChainColor = (chain) => {
    return chainColors[chain] || chainColors.default;
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
    return baseColor + (opacity !== 1 ? opacity * 100 : "");
};

// 노드 크기 결정 함수
export const getNodeSize = (node) => {
    const baseSize = 5;
    const txCount = (node.sent_tx_count || 0) + (node.recv_tx_count || 0);
    const txVolume = (node.sent_tx_amount || 0) + (node.recv_tx_amount || 0);

    // 거래 수와 거래량 기반으로 크기 조정
    return baseSize + Math.sqrt(txCount) + Math.sqrt(txVolume) / 5;
};

// 노드 티어별 색상 반환 함수
export const getTierColor = (tier) => {
    return tierConfig[tier]?.color || tierConfig.bronze.color;
};

// 링크 두께 결정 함수
export const getLinkWidth = (link) => {
    // 거래량 기준으로 링크 두께 결정 (1~10 사이 값)
    const minWidth = 1;
    const maxWidth = 10;
    const minValue = 0;
    const maxValue = 200; // 적절히 조정 필요

    return minWidth + ((link.value - minValue) / (maxValue - minValue)) * (maxWidth - minWidth);
};
