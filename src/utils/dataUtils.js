// src/utils/dataUtils.js
// 주소 축약 함수
export const shortenAddress = (address, prefixLength = 6, suffixLength = 4) => {
    if (!address || address.length <= prefixLength + suffixLength) return address;
    return `${address.substring(0, prefixLength)}...${address.substring(address.length - suffixLength)}`;
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

// 그래프용 데이터 변환 함수
export const transformTransactionsToGraphData = (transactions, addressData) => {
    if (!transactions || !Array.isArray(transactions) || !addressData || !Array.isArray(addressData)) {
        console.error('Invalid transactions or addressData:', { transactions, addressData });
        return { nodes: [], links: [] };
    }

    const nodes = new Map();
    const links = new Map();

    // 주소 인덱스 맵 생성
    const addressMap = new Map();
    addressData.forEach(addr => {
        if (addr && addr.address) {
            addressMap.set(addr.address, addr);
        }
    });

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
                name: shortenAddress(tx.fromAddress),
                chain: tx.fromChain || 'unknown',
                chainId: tx.fromChainId || 'unknown',
                sent_tx_count: addressInfo.sent_tx_count || 0,
                recv_tx_count: addressInfo.recv_tx_count || 0,
                sent_tx_amount: addressInfo.sent_tx_amount || 0,
                recv_tx_amount: addressInfo.recv_tx_amount || 0,
                pagerank: addressInfo.pagerank || addressInfo.final_score || 0,
                tier: addressInfo.tier || getTierFromPageRank(addressInfo.pagerank || addressInfo.final_score || 0)
            });
        }

        if (!nodes.has(tx.toAddress)) {
            const addressInfo = addressData.find(a => a && a.address === tx.toAddress) || {};
            nodes.set(tx.toAddress, {
                id: tx.toAddress,
                name: shortenAddress(tx.toAddress),
                chain: tx.toChain || 'unknown',
                chainId: tx.toChainId || 'unknown',
                sent_tx_count: addressInfo.sent_tx_count || 0,
                recv_tx_count: addressInfo.recv_tx_count || 0,
                sent_tx_amount: addressInfo.sent_tx_amount || 0,
                recv_tx_amount: addressInfo.recv_tx_amount || 0,
                pagerank: addressInfo.pagerank || addressInfo.final_score || 0,
                tier: addressInfo.tier || getTierFromPageRank(addressInfo.pagerank || addressInfo.final_score || 0)
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

// 티어 기반 페이지랭크 계산
export const getTierFromPageRank = (pageRank) => {
    if (pageRank >= 0.8) return "diamond";
    if (pageRank >= 0.7) return "platinum";
    if (pageRank >= 0.5) return "gold";
    if (pageRank >= 0.3) return "silver";
    return "bronze";
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
            maxPageRank = Math.max(maxPageRank, a.pagerank || a.final_score || 0);
            maxTxCount = Math.max(maxTxCount, (a.sent_tx_count || 0) + (a.recv_tx_count || 0));
            maxTxAmount = Math.max(maxTxAmount, (a.sent_tx_amount || 0) + (a.recv_tx_amount || 0));
        }
    });

    // 모든 0이면 방어 코드
    maxPageRank = maxPageRank || 1;
    maxTxCount = maxTxCount || 1;
    maxTxAmount = maxTxAmount || 1;

    // 각 주소별 점수 계산
    const scoredAddresses = addressData
        .filter(addr => addr && (addr.address || addr.id)) // 유효한 주소만 필터링
        .map(address => {
            const nodeId = address.address || address.id;
            const pagerankScore = (address.pagerank || address.final_score || 0.1) / maxPageRank;
            const txCountScore =
                ((address.sent_tx_count || 0) + (address.recv_tx_count || 0)) / maxTxCount;
            const txAmountScore =
                ((address.sent_tx_amount || 0) + (address.recv_tx_amount || 0)) / maxTxAmount;

            // 배치/퀀트 점수 계산 (시간 엔트로피 기반)
            let batchScore = 0;
            if (address.hour_entropy !== undefined) {
                // 낮은 엔트로피 = 높은 규칙성 = 높은 배치/퀀트 특성
                batchScore = 1 - (address.hour_entropy / 4.32); // 최대 엔트로피 4.32 (log2(24))
            } else {
                batchScore = pagerankScore; // 시간 엔트로피가 없으면 페이지랭크 사용
            }

            const totalScore =
                (batchScore * normalizedBatchWeight) +
                (txCountScore * normalizedTxCountWeight) +
                (txAmountScore * normalizedTxAmountWeight);

            return {
                ...address,
                id: nodeId, // id 필드 추가
                score: totalScore,
                name: shortenAddress(nodeId, 5, 4) // 주소 축약 형태로 표시
            };
        });

    // 내림차순 정렬 후 Top-K 반환
    return scoredAddresses
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
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
                chain: tx.fromChain || 'unknown'
            });
        }

        if (!nodeMap.has(tx.toAddress)) {
            nodeMap.set(tx.toAddress, {
                id: tx.toAddress,
                name: shortenAddress(tx.toAddress),
                chain: tx.toChain || 'unknown'
            });
        }

        // 링크 추가
        links.push({
            source: tx.fromAddress,
            target: tx.toAddress,
            value: tx.amount || 1,  // 최소값 1 설정
            denom: tx.dpDenom || tx.denom || ''
        });
    });

    return {
        nodes: Array.from(nodeMap.values()),
        links: links
    };
};

// 데이터 형식 변환 함수
export const normalizeTransactionData = (apiData) => {
    if (!apiData) return { transactions: [], addressData: [] };

    const transactions = [...apiData.top_nodes_json, ...apiData.related_nodes_json].map(tx => {
        // 일관된 형식으로 변환
        return {
            txhash: tx.txhash || tx.hash || `tx-${Math.random().toString(36).substr(2, 9)}`,
            fromAddress: tx.fromAddress || tx.from || '',
            toAddress: tx.toAddress || tx.to || '',
            amount: tx.amount || tx.value || 0,
            timestamp: tx.timestamp || Date.now(),
            fromChain: tx.fromChain || getChainFromAddress(tx.fromAddress || tx.from || ''),
            toChain: tx.toChain || getChainFromAddress(tx.toAddress || tx.to || ''),
            denom: tx.denom || tx.dpDenom || '',
            dpDenom: tx.dpDenom || tx.denom || ''
        };
    });

    const addressData = [...apiData.top_nodes_derived_json, ...apiData.related_nodes_derived_json].map(addr => {
        // 일관된 형식으로 변환
        return {
            address: addr.address || addr.id || '',
            id: addr.address || addr.id || '',
            sent_tx_count: addr.sent_tx_count || 0,
            recv_tx_count: addr.recv_tx_count || 0,
            sent_tx_amount: addr.sent_tx_amount || addr.total_sent || 0,
            recv_tx_amount: addr.recv_tx_amount || addr.total_received || 0,
            pagerank: addr.pagerank || addr.final_score || 0.1,
            final_score: addr.final_score || addr.pagerank || 0.1,
            tier: addr.tier || getTierFromPageRank(addr.pagerank || addr.final_score || 0.1),
            chain: addr.chain || getChainFromAddress(addr.address || addr.id || ''),
            hour_entropy: addr.hour_entropy || 0,
            active_days_count: addr.active_days_count || 0,
            counterparty_count_sent: addr.counterparty_count_sent || 0,
            counterparty_count_recv: addr.counterparty_count_recv || 0
        };
    });

    return { transactions, addressData };
};

// 주소에서 체인 추출
export const getChainFromAddress = (address) => {
    if (!address || typeof address !== 'string') return 'unknown';

    try {
        // 첫 번째 '1' 또는 '.' 이전의 텍스트를 체인으로 간주
        const dotIndex = address.indexOf('.');
        const oneIndex = address.indexOf('1');

        if (dotIndex > 0 && (oneIndex < 0 || dotIndex < oneIndex)) {
            return address.substring(0, dotIndex);
        } else if (oneIndex > 0) {
            return address.substring(0, oneIndex);
        }

        // 그 외 경우, 첫 6자를 반환하거나 'unknown'
        return address.length > 6 ? address.substring(0, 6) : 'unknown';
    } catch (e) {
        console.warn('Error extracting chain name:', e);
        return 'unknown';
    }
};
