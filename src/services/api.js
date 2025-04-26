// src/services/api.js
import { dummyTransactions } from '../data/dummyTransactions';
import { dummyAddressData } from '../data/dummyAddressData';
import { transformTransactionsToGraphData } from '../utils/dataUtils';

// Web Worker 인스턴스 생성 및 관리
let csvWorker = null;
let dataCache = {
    transactions: [],
    addressData: [],
    graphData: null,
    pageRankCalculated: false,
    dataLoaded: false,
    loadingProgress: 0
};

// Worker 초기화
const initWorker = () => {
    if (csvWorker) {
        terminateWorker();
    }

    csvWorker = new Worker('/csvWorker.js');

    // Worker 메시지 핸들러
    csvWorker.onmessage = (e) => {
        const { type, data, fileType, processedBytes, totalBytes, error } = e.data;

        if (type === 'error') {
            console.error('Worker error:', error);
            return;
        }

        if (type === 'progress') {
            // 진행률 업데이트
            if (totalBytes) {
                dataCache.loadingProgress = Math.floor((processedBytes / totalBytes) * 100);
            }
        }

        if (type === 'data' || type === 'complete') {
            // 데이터 누적
            if (fileType === 'transactions') {
                dataCache.transactions = dataCache.transactions.concat(data);
            } else if (fileType === 'addressData') {
                dataCache.addressData = dataCache.addressData.concat(data);
            }

            if (type === 'complete') {
                console.log(`${fileType} 데이터 로딩 완료:`, data.length);
                checkDataLoad();
            }
        }

        if (type === 'pageRankComplete') {
            dataCache.addressData = data;
            dataCache.pageRankCalculated = true;
            console.log('PageRank 계산 완료');
        }

        if (type === 'topKNodesComplete') {
            // Top-K 노드 계산 완료 이벤트를 발생시킴
            const event = new CustomEvent('topKNodesUpdated', { detail: data });
            window.dispatchEvent(event);
        }
    };

    return csvWorker;
};

// 데이터 로드 상태 확인
const checkDataLoad = () => {
    if (dataCache.transactions.length > 0 && dataCache.addressData.length > 0) {
        dataCache.dataLoaded = true;

        // 그래프 데이터 생성
        dataCache.graphData = transformTransactionsToGraphData(
            dataCache.transactions,
            dataCache.addressData
        );

        // 데이터 로딩 완료 이벤트 발생
        const event = new CustomEvent('dataLoaded', {
            detail: {
                transactions: dataCache.transactions,
                addressData: dataCache.addressData,
                graphData: dataCache.graphData
            }
        });
        window.dispatchEvent(event);

        // PageRank 계산 요청
        calculatePageRank();
    }
};

// Worker 종료
const terminateWorker = () => {
    if (csvWorker) {
        csvWorker.terminate();
        csvWorker = null;
    }
};

// CSV 파일 로드
const loadCSVFiles = () => {
    if (!csvWorker) {
        initWorker();
    }

    // 캐시 초기화
    dataCache.transactions = [];
    dataCache.addressData = [];
    dataCache.graphData = null;
    dataCache.pageRankCalculated = false;
    dataCache.dataLoaded = false;
    dataCache.loadingProgress = 0;

    // 개발 환경이나 데이터가 작은 경우는 더미 데이터 사용
    const useDummyData = process.env.NODE_ENV === 'development' || process.env.REACT_APP_USE_DUMMY_DATA === 'true';

    if (useDummyData) {
        // 더미 데이터 사용 (개발 편의성)
        setTimeout(() => {
            dataCache.transactions = dummyTransactions;
            dataCache.addressData = dummyAddressData;
            dataCache.dataLoaded = true;

            dataCache.graphData = transformTransactionsToGraphData(
                dataCache.transactions,
                dataCache.addressData
            );

            const event = new CustomEvent('dataLoaded', {
                detail: {
                    transactions: dataCache.transactions,
                    addressData: dataCache.addressData,
                    graphData: dataCache.graphData
                }
            });
            window.dispatchEvent(event);

            // 더미 데이터에서도 PageRank 계산
            calculatePageRank();
        }, 500);

        return;
    }

    // 트랜잭션 데이터 로드
    csvWorker.postMessage({
        type: 'parseCSV',
        fileInfo: {
            filePath: '/data/original.csv',
            fileType: 'transactions'
        },
        chunkSize: 5 * 1024 * 1024, // 5MB 청크
        config: {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        }
    });

    // 주소 데이터 로드
    csvWorker.postMessage({
        type: 'parseCSV',
        fileInfo: {
            filePath: '/data/derived.csv',
            fileType: 'addressData'
        },
        chunkSize: 5 * 1024 * 1024, // 5MB 청크
        config: {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        }
    });
};

// PageRank 계산
const calculatePageRank = () => {
    if (!csvWorker || !dataCache.graphData) {
        console.error('Worker 또는 그래프 데이터가 준비되지 않았습니다.');
        return;
    }

    csvWorker.postMessage({
        type: 'calculatePageRank',
        graph: dataCache.graphData,
        dampingFactor: 0.85,
        iterations: 50
    });
};

// Top-K 노드 선택
const fetchTopKNodes = async (batchWeight, txCountWeight, txAmountWeight, k = 20) => {
    if (!csvWorker || !dataCache.dataLoaded) {
        console.error('Worker 또는 데이터가 준비되지 않았습니다.');
        return [];
    }

    return new Promise((resolve) => {
        // 이벤트 리스너 등록
        const handleTopKNodesUpdated = (event) => {
            window.removeEventListener('topKNodesUpdated', handleTopKNodesUpdated);
            resolve(event.detail);
        };

        window.addEventListener('topKNodesUpdated', handleTopKNodesUpdated);

        // Worker에 계산 요청
        csvWorker.postMessage({
            type: 'selectTopKNodes',
            nodes: dataCache.addressData,
            batchWeight,
            txCountWeight,
            txAmountWeight,
            k
        });
    });
};

// 트랜잭션 데이터 조회 API
const fetchTransactions = async () => {
    if (!dataCache.dataLoaded) {
        await new Promise(resolve => {
            const handleDataLoaded = () => {
                window.removeEventListener('dataLoaded', handleDataLoaded);
                resolve();
            };
            window.addEventListener('dataLoaded', handleDataLoaded);

            loadCSVFiles();
        });
    }

    return dataCache.transactions;
};

// 주소 데이터 조회 API
const fetchAddressData = async () => {
    if (!dataCache.dataLoaded) {
        await new Promise(resolve => {
            const handleDataLoaded = () => {
                window.removeEventListener('dataLoaded', handleDataLoaded);
                resolve();
            };
            window.addEventListener('dataLoaded', handleDataLoaded);

            loadCSVFiles();
        });
    }

    return dataCache.addressData;
};

// 로딩 진행률 조회
const getDataLoadingProgress = () => {
    return dataCache.loadingProgress;
};

// 데이터 로드 상태 조회
const isDataLoaded = () => {
    return dataCache.dataLoaded;
};

// 단일 주소 상세 정보 조회 API
const fetchAddressDetail = async (address) => {
    if (!dataCache.dataLoaded) {
        await fetchAddressData();
    }

    return new Promise((resolve, reject) => {
        const addressInfo = dataCache.addressData.find(item => item.address === address);
        if (addressInfo) {
            resolve(addressInfo);
        } else {
            reject(new Error('Address not found'));
        }
    });
};

// 특정 주소와 관련된 트랜잭션 조회 API
const fetchAddressTransactions = async (address) => {
    if (!dataCache.dataLoaded) {
        await fetchTransactions();
    }

    return new Promise((resolve) => {
        const filteredTxs = dataCache.transactions.filter(tx =>
            tx.fromAddress === address || tx.toAddress === address
        );
        resolve(filteredTxs);
    });
};

// 그래프 데이터 얻기
const getGraphData = async () => {
    if (!dataCache.dataLoaded) {
        await fetchTransactions();
    }

    return dataCache.graphData;
};

// 전체 데이터 정리 (앱 종료 시 호출)
const cleanupData = () => {
    terminateWorker();
    dataCache = {
        transactions: [],
        addressData: [],
        graphData: null,
        pageRankCalculated: false,
        dataLoaded: false,
        loadingProgress: 0
    };
};

// 데이터 파일 로딩 시작
const initDataLoading = () => {
    return loadCSVFiles();
};

export {
    fetchTransactions,
    fetchAddressData,
    fetchTopKNodes,
    fetchAddressDetail,
    fetchAddressTransactions,
    getDataLoadingProgress,
    isDataLoaded,
    getGraphData,
    cleanupData,
    initDataLoading
};
