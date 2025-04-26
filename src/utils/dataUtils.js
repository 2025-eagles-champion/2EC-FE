// src/utils/dataUtils.js
import { chainColors, getTierFromPageRank } from '../constants/tierConfig';

// 그래프용 데이터 변환 함수
export const transformTransactionsToGraphData = (transactions, addressData) => {
    if (!transactions || !Array.isArray(transactions) || !addressData || !Array.isArray(addressData)) {
        console.error('Invalid transactions or addressData:', { transactions, addressData });
        return { nodes: [], links: [] };
    }

    const nodes = new Map();
    const links = new Map();

    // 먼저 모든 고유 주소를 노드로 변환
    transactions.forEach(tx => {
        // tx 객체 검증
        if (!tx || !tx.fromAddress || !tx.toAddress) {
            console.warn('Invalid transaction:', tx);
            return; // 현재 트랜잭션 처리 건너뛰기
        }

        if (!nodes.has(tx.fromAddress)) {
            const addressInfo = addressData.find(a => a && a.address === tx.fromAddress) || {};
            nodes.set(tx.fromAddress, {
                id: tx.fromAddress,
                chain: tx.fromChain || 'unknown',
                chainId: tx.fromChainId || 'unknown',
                sent_tx_count: addressInfo.sent_tx_count || 0,
                recv_tx_count: addressInfo.recv_tx_count || 0,
                sent_tx_amount: addressInfo.sent_tx_amount || 0,
                recv_tx_amount: addressInfo.recv_tx_amount || 0,
                pagerank: addressInfo.pagerank || 0,
                tier: addressInfo.tier || getTierFromPageRank(addressInfo.pagerank || 0)
            });
        }

        if (!nodes.has(tx.toAddress)) {
            const addressInfo = addressData.find(a => a && a.address === tx.toAddress) || {};
            nodes.set(tx.toAddress, {
                id: tx.toAddress,
                chain: tx.toChain || 'unknown',
                chainId: tx.toChainId || 'unknown',
                sent_tx_count: addressInfo.sent_tx_count || 0,
                recv_tx_count: addressInfo.recv_tx_count || 0,
                sent_tx_amount: addressInfo.sent_tx_amount || 0,
                recv_tx_amount: addressInfo.recv_tx_amount || 0,
                pagerank: addressInfo.pagerank || 0,
                tier: addressInfo.tier || getTierFromPageRank(addressInfo.pagerank || 0)
            });
        }

        // 링크(간선) 처리
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

    return {
        nodes: Array.from(nodes.values()),
        links: Array.from(links.values())
    };
};

// Top-K 노드 선택 함수
export const getTopKNodes = (addressData, batchWeight, txCountWeight, txAmountWeight, k = 20) => {
    if (!addressData || addressData.length === 0) return [];

    // 가중치 계산
    const normalizedBatchWeight = batchWeight / 100;
    const normalizedTxCountWeight = txCountWeight / 100;
    const normalizedTxAmountWeight = txAmountWeight / 100;

    // 각 주소별 점수 계산
    const scoredAddresses = addressData.map(address => {
        const batchScore = address.pagerank || 0;
        const txCountScore = (address.sent_tx_count + address.recv_tx_count) /
            Math.max(...addressData.map(a => a.sent_tx_count + a.recv_tx_count));
        const txAmountScore = (address.sent_tx_amount + address.recv_tx_amount) /
            Math.max(...addressData.map(a => a.sent_tx_amount + a.recv_tx_amount));

        const totalScore =
            (batchScore * normalizedBatchWeight) +
            (txCountScore * normalizedTxCountWeight) +
            (txAmountScore * normalizedTxAmountWeight);

        return {
            ...address,
            score: totalScore
        };
    });

    // 내림차순 정렬 후 Top-K 반환
    return scoredAddresses.sort((a, b) => b.score - a.score).slice(0, k);
};

// 샌키 차트용 데이터 변환 함수
export const transformToSankeyData = (transactions, selectedAddress) => {
    // 먼저 관련된 거래만 필터링
    const relevantTxs = transactions.filter(tx =>
        tx.fromAddress === selectedAddress || tx.toAddress === selectedAddress
    );

    // 노드와 링크를 식별하기 위한 맵
    const nodeMap = new Map();
    const links = [];

    // 모든 노드와 링크 수집
    relevantTxs.forEach(tx => {
        // 송신자와 수신자 노드 추가
        if (!nodeMap.has(tx.fromAddress)) {
            nodeMap.set(tx.fromAddress, {
                id: tx.fromAddress,
                name: shortenAddress(tx.fromAddress),
                chain: tx.fromChain
            });
        }

        if (!nodeMap.has(tx.toAddress)) {
            nodeMap.set(tx.toAddress, {
                id: tx.toAddress,
                name: shortenAddress(tx.toAddress),
                chain: tx.toChain
            });
        }

        // 링크 추가
        links.push({
            source: tx.fromAddress,
            target: tx.toAddress,
            value: tx.amount,
            denom: tx.dpDenom
        });
    });

    return {
        nodes: Array.from(nodeMap.values()),
        links: links
    };
};

// 주소 축약 함수
export const shortenAddress = (address, prefixLength = 6, suffixLength = 4) => {
    if (!address || address.length <= prefixLength + suffixLength) return address;
    return `${address.substring(0, prefixLength)}...${address.substring(address.length - suffixLength)}`;
};
