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
        // 체인 접두사 추출 (첫 번째 '1' 앞까지)
        let chainPrefix = 'unknown';
        let uuid = '';

        if (address.includes('1')) {
            const parts = address.split('1');
            chainPrefix = parts[0];
            uuid = parts.length > 1 ? parts[1].substring(0, 4) : '';
        } else {
            // '1'이 없는 경우 앞 부분 사용
            chainPrefix = address.substring(0, 6);
        }

        // 체인명 + uuid 앞 네글자 형태로 구성
        return `${chainPrefix}${uuid ? `.${uuid}` : ''}`;
    } catch (e) {
        console.warn('Error extracting address name:', e);
        return 'Unknown';
    }
};

// Top-K 노드 선택 함수
export const getTopKNodes = (addressData, batchWeight, txCountWeight, txAmountWeight, k = 10) => {
    if (!addressData || addressData.length === 0) {
        console.log("No address data available for Top-K calculation");
        return [];
    }

    // 가중치 정규화
    const totalWeight = batchWeight + txCountWeight + txAmountWeight;
    const normalizedBatchWeight = batchWeight / totalWeight;
    const normalizedTxCountWeight = txCountWeight / totalWeight;
    const normalizedTxAmountWeight = txAmountWeight / totalWeight;

    // 최대값 찾기 (정규화 위함)
    let maxPageRank = 0;
    let maxTxCount = 0;
    let maxTxAmount = 0;

    addressData.forEach(a => {
        if (a) {
            maxPageRank = Math.max(maxPageRank, a.pagerank || 0);
            maxTxCount = Math.max(maxTxCount, (a.sent_tx_count || 0) + (a.recv_tx_count || 0));
            maxTxAmount = Math.max(maxTxAmount, (a.sent_tx_amount || 0) + (a.recv_tx_amount || 0));
        }
    });

    // 모든 0이면 방어 코드
    maxPageRank = maxPageRank || 1;
    maxTxCount = maxTxCount || 1;
    maxTxAmount = maxTxAmount || 1;

    console.log("Calculating Top-K with weights:",
        { batch: normalizedBatchWeight, count: normalizedTxCountWeight, amount: normalizedTxAmountWeight });

    // 각 주소별 점수 계산
    const scoredAddresses = addressData
        .filter(addr => addr && (addr.address || addr.id)) // 유효한 주소만 필터링
        .map(address => {
            const nodeId = address.address || address.id;
            const pagerankScore = (address.pagerank || 0.1) / maxPageRank;
            const txCountScore =
                ((address.sent_tx_count || 0) + (address.recv_tx_count || 0)) / maxTxCount;
            const txAmountScore =
                ((address.sent_tx_amount || 0) + (address.recv_tx_amount || 0)) / maxTxAmount;

            const totalScore =
                (pagerankScore * normalizedBatchWeight) +
                (txCountScore * normalizedTxCountWeight) +
                (txAmountScore * normalizedTxAmountWeight);

            return {
                ...address,
                id: nodeId, // id 필드 추가
                score: totalScore,
                name: getAddressName(nodeId)
            };
        });

    // 내림차순 정렬 후 Top-K 반환
    const result = scoredAddresses
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

    console.log(`Finished Top-K calculation: found ${result.length} nodes`);
    return result;
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
