// csvWorker.js
// Web Worker for handling large CSV file processing

// Import PapaParse via importScripts (Web Worker 방식)
importScripts('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js');

// 메인 스레드로부터 메시지 수신
self.onmessage = async function(e) {
    const { type, fileInfo, chunkSize, config } = e.data;

    try {
        if (type === 'parseCSV') {
            const { filePath, fileType } = fileInfo;

            // 파일 가져오기 (fetch API 사용)
            const response = await fetch(filePath);

            // 스트리밍 모드로 처리 (대용량 파일 처리를 위해)
            const reader = response.body.getReader();
            let chunks = [];
            let processedBytes = 0;
            let totalBytes = parseInt(response.headers.get('Content-Length') || '0');

            // 데이터 수집
            let rawData = '';
            let result = [];
            let headers = [];
            let isFirstChunk = true;

            // 파일 내용 청크 단위로 읽기
            while(true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                // 청크 데이터를 문자열로 변환
                const chunk = new TextDecoder().decode(value, { stream: true });
                rawData += chunk;

                // 충분한 데이터가 모이면 파싱
                if (rawData.length > chunkSize || done) {
                    // 완전한, 처리가능한 라인까지만 자르기
                    const lastNewlineIndex = rawData.lastIndexOf('\n');
                    const processablePart = rawData.substring(0, lastNewlineIndex);
                    rawData = rawData.substring(lastNewlineIndex + 1);

                    // PapaParse로 CSV 청크 파싱
                    const parseConfig = {
                        header: true,
                        dynamicTyping: true,
                        skipEmptyLines: true,
                        ...config
                    };

                    // 첫번째 청크라면 헤더 포함, 아니면 헤더 제외하고 파싱
                    if (isFirstChunk) {
                        Papa.parse(processablePart, {
                            ...parseConfig,
                            complete: function(results) {
                                headers = results.meta.fields;
                                result = result.concat(results.data);
                                isFirstChunk = false;

                                // 첫 번째 배치 데이터 진행 상황 보고
                                self.postMessage({
                                    type: 'progress',
                                    processedBytes: processedBytes += value.length,
                                    totalBytes,
                                    data: null
                                });
                            }
                        });
                    } else {
                        // 헤더 없이 데이터 파싱하여 추가
                        Papa.parse(processablePart, {
                            ...parseConfig,
                            header: false,
                            complete: function(results) {
                                // 헤더 배치
                                const formattedData = results.data.map(row => {
                                    const obj = {};
                                    headers.forEach((header, index) => {
                                        obj[header] = row[index];
                                    });
                                    return obj;
                                });

                                result = result.concat(formattedData);

                                // 진행 상황 보고
                                self.postMessage({
                                    type: 'progress',
                                    processedBytes: processedBytes += value.length,
                                    totalBytes,
                                    data: null
                                });
                            }
                        });
                    }

                    // 중간 결과를 메인 스레드로 보내고, result 배열 비우기 (메모리 관리)
                    if (result.length > 10000) {
                        self.postMessage({
                            type: 'data',
                            data: result,
                            fileType
                        });
                        result = [];
                    }
                }
            }

            // 남은 데이터 처리
            if (rawData.length > 0) {
                Papa.parse(rawData, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    ...config,
                    complete: function(results) {
                        result = result.concat(results.data);
                    }
                });
            }

            // 최종 결과 전송
            self.postMessage({
                type: 'complete',
                data: result,
                fileType
            });
        }
        else if (type === 'calculatePageRank') {
            // PageRank 계산 로직
            const { graph, dampingFactor, iterations } = e.data;
            const pageRanks = calculatePageRank(graph, dampingFactor, iterations);

            self.postMessage({
                type: 'pageRankComplete',
                data: pageRanks
            });
        }
        else if (type === 'selectTopKNodes') {
            // Top-K 노드 선택 로직
            const { nodes, batchWeight, txCountWeight, txAmountWeight, k } = e.data;
            const topNodes = selectTopKNodes(nodes, batchWeight, txCountWeight, txAmountWeight, k);

            self.postMessage({
                type: 'topKNodesComplete',
                data: topNodes
            });
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.toString()
        });
    }
};

// PageRank 알고리즘 구현
function calculatePageRank(graph, dampingFactor = 0.85, iterations = 100) {
    if (!graph || !graph.nodes || !graph.links) {
        throw new Error('Invalid graph structure');
    }

    const nodes = graph.nodes;
    const links = graph.links;

    // 노드 ID를 인덱스로 매핑
    const nodeMap = new Map();
    nodes.forEach((node, index) => {
        nodeMap.set(node.id, index);
    });

    // 각 노드의 초기 PageRank 값 설정 (1/n)
    const n = nodes.length;
    const initialRank = 1 / n;
    let ranks = new Array(n).fill(initialRank);

    // 각 노드별 아웃링크(나가는 링크) 수 계산
    const outLinks = new Array(n).fill(0);
    const incomingLinks = Array.from({ length: n }, () => []);

    // 링크 정보 구성
    links.forEach(link => {
        const sourceIdx = nodeMap.get(link.source);
        const targetIdx = nodeMap.get(link.target);

        if (sourceIdx !== undefined && targetIdx !== undefined) {
            outLinks[sourceIdx]++;
            incomingLinks[targetIdx].push({
                sourceIdx,
                weight: link.value || 1 // 링크 가중치, 없으면 1로 설정
            });
        }
    });

    // PageRank 반복 계산
    for (let iter = 0; iter < iterations; iter++) {
        const newRanks = new Array(n).fill((1 - dampingFactor) / n);

        // 각 노드에 대해 PageRank 계산
        for (let i = 0; i < n; i++) {
            const incoming = incomingLinks[i];

            // 들어오는 각 링크의 기여도 합산
            for (const { sourceIdx, weight } of incoming) {
                const sourceRank = ranks[sourceIdx];
                const sourceTotalOut = outLinks[sourceIdx];

                if (sourceTotalOut > 0) {
                    // (dampingFactor * sourceRank * weight / sourceTotalOut)
                    // 가중치를 고려한 계산
                    newRanks[i] += dampingFactor * sourceRank * weight / sourceTotalOut;
                }
            }
        }

        // 전체 랭크 정규화 (합이 1이 되도록)
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += newRanks[i];
        }

        for (let i = 0; i < n; i++) {
            newRanks[i] /= sum;
        }

        // 랭크 업데이트
        ranks = newRanks;
    }

    // 각 노드에 PageRank 값 할당
    const result = nodes.map((node, index) => ({
        ...node,
        pagerank: ranks[index]
    }));

    return result;
}

// 가중치 기반 Top-K 노드 선택 함수
function selectTopKNodes(nodes, batchWeight, txCountWeight, txAmountWeight, k = 10) {
    if (!nodes || nodes.length === 0) {
        return [];
    }

    // 정규화된 가중치 계산
    const totalWeight = batchWeight + txCountWeight + txAmountWeight;
    const normalizedBatchWeight = batchWeight / totalWeight;
    const normalizedTxCountWeight = txCountWeight / totalWeight;
    const normalizedTxAmountWeight = txAmountWeight / totalWeight;

    // 각 필드의 최댓값 찾기 (정규화를 위해)
    let maxPageRank = 0;
    let maxTxCount = 0;
    let maxTxAmount = 0;

    nodes.forEach(node => {
        maxPageRank = Math.max(maxPageRank, node.pagerank || 0);
        maxTxCount = Math.max(maxTxCount, (node.sent_tx_count || 0) + (node.recv_tx_count || 0));
        maxTxAmount = Math.max(maxTxAmount, (node.sent_tx_amount || 0) + (node.recv_tx_amount || 0));
    });

    // 점수 계산 및 정렬
    const scoredNodes = nodes.map(node => {
        const pagerankScore = maxPageRank > 0 ? (node.pagerank || 0) / maxPageRank : 0;
        const txCountScore = maxTxCount > 0 ?
            ((node.sent_tx_count || 0) + (node.recv_tx_count || 0)) / maxTxCount : 0;
        const txAmountScore = maxTxAmount > 0 ?
            ((node.sent_tx_amount || 0) + (node.recv_tx_amount || 0)) / maxTxAmount : 0;

        const totalScore =
            (pagerankScore * normalizedBatchWeight) +
            (txCountScore * normalizedTxCountWeight) +
            (txAmountScore * normalizedTxAmountWeight);

        return {
            ...node,
            score: totalScore
        };
    });

    // 점수 기준 내림차순 정렬 후 Top-K 반환
    return scoredNodes
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
}
