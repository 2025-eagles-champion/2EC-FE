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
                name: getAddressName(tx.fromAddress),
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
                name: getAddressName(tx.toAddress),
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

// 주소 이름 추출 함수 (체인 접두사와 처음 몇 자리)
export const getAddressName = (address) => {
    if (!address || typeof address !== 'string') return 'Unknown';

    try {
        // 체인 접두사와 일부 주소를 포함해 표시
        const shortenedAddr = shortenAddress(address, 8, 6);
        return shortenedAddr;
    } catch (e) {
        console.warn('Error extracting address name:', e);
        return 'Unknown';
    }
};

// Top-K 노드 선택 함수
export const getTopKNodes = (addressData, batchWeight, txCountWeight, txAmountWeight, k = 20) => {
    if (!addressData || addressData.length === 0) return [];

    // 가중치 정규화
    const totalWeight = batchWeight + txCountWeight + txAmountWeight;
    const normalizedBatchWeight = batchWeight / totalWeight;
    const normalizedTxCountWeight = txCountWeight / totalWeight;
    const normalizedTxAmountWeight = txAmountWeight / totalWeight;

    // 최대값 찾기 (정규화 위함)
    const maxPageRank = Math.max(...addressData.map(a => a.pagerank || 0));
    const maxTxCount = Math.max(...addressData.map(a => (a.sent_tx_count || 0) + (a.recv_tx_count || 0)));
    const maxTxAmount = Math.max(...addressData.map(a => (a.sent_tx_amount || 0) + (a.recv_tx_amount || 0)));

    // 각 주소별 점수 계산
    const scoredAddresses = addressData.map(address => {
        const pagerankScore = maxPageRank > 0 ? (address.pagerank || 0) / maxPageRank : 0;
        const txCountScore = maxTxCount > 0 ?
            ((address.sent_tx_count || 0) + (address.recv_tx_count || 0)) / maxTxCount : 0;
        const txAmountScore = maxTxAmount > 0 ?
            ((address.sent_tx_amount || 0) + (address.recv_tx_amount || 0)) / maxTxAmount : 0;

        const totalScore =
            (pagerankScore * normalizedBatchWeight) +
            (txCountScore * normalizedTxCountWeight) +
            (txAmountScore * normalizedTxAmountWeight);

        return {
            ...address,
            score: totalScore,
            name: getAddressName(address.address)
        };
    });

    // 내림차순 정렬 후 Top-K 반환
    return scoredAddresses
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
};

// PageRank 알고리즘 계산 함수
export const calculatePageRank = (graphData, damping = 0.85, iterations = 20) => {
    if (!graphData || !graphData.nodes || !graphData.links) {
        return [];
    }

    const nodes = graphData.nodes;
    const links = graphData.links;

    // 노드 ID -> 인덱스 맵핑
    const nodeMap = new Map();
    nodes.forEach((node, index) => {
        nodeMap.set(node.id, index);
    });

    // 초기 PageRank 값 설정
    const n = nodes.length;
    const initialRank = 1 / n;
    let ranks = new Array(n).fill(initialRank);

    // 링크 정보 구성
    const outLinks = new Array(n).fill(0);
    const incomingLinks = Array.from({ length: n }, () => []);

    links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

        const sourceIdx = nodeMap.get(sourceId);
        const targetIdx = nodeMap.get(targetId);

        if (sourceIdx !== undefined && targetIdx !== undefined) {
            outLinks[sourceIdx]++;
            incomingLinks[targetIdx].push({
                sourceIdx,
                weight: link.value || 1
            });
        }
    });

    // PageRank 계산 반복
    for (let i = 0; i < iterations; i++) {
        const newRanks = new Array(n).fill((1 - damping) / n);

        for (let j = 0; j < n; j++) {
            const incoming = incomingLinks[j];

            for (const { sourceIdx, weight } of incoming) {
                const sourceRank = ranks[sourceIdx];
                const sourceTotalOut = outLinks[sourceIdx];

                if (sourceTotalOut > 0) {
                    newRanks[j] += damping * sourceRank * weight / sourceTotalOut;
                }
            }
        }

        // 정규화
        let sum = 0;
        for (let j = 0; j < n; j++) {
            sum += newRanks[j];
        }

        for (let j = 0; j < n; j++) {
            newRanks[j] /= sum;
        }

        ranks = newRanks;
    }

    // 결과 매핑
    return nodes.map((node, index) => ({
        ...node,
        pagerank: ranks[index],
        tier: getTierFromPageRank(ranks[index])
    }));
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
                name: getAddressName(tx.fromAddress),
                chain: tx.fromChain
            });
        }

        if (!nodeMap.has(tx.toAddress)) {
            nodeMap.set(tx.toAddress, {
                id: tx.toAddress,
                name: getAddressName(tx.toAddress),
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
