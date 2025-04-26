// src/services/api.js
import { dummyTransactions } from '../data/dummyTransactions';
import { dummyAddressData } from '../data/dummyAddressData';
import { getTopKNodes } from '../utils/dataUtils';

// 트랜잭션 데이터 조회 API
export const fetchTransactions = async () => {
    // TODO: 실제 API 엔드포인트로 대체 필요
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(dummyTransactions);
        }, 500);
    });
};

// 주소 데이터 조회 API
export const fetchAddressData = async () => {
    // TODO: 실제 API 엔드포인트로 대체 필요
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(dummyAddressData);
        }, 500);
    });
};

// Top-K 노드 조회 API
export const fetchTopKNodes = async (batchWeight, txCountWeight, txAmountWeight, k = 20) => {
    // TODO: 실제 API 엔드포인트로 대체 필요
    return new Promise((resolve) => {
        setTimeout(() => {
            const topNodes = getTopKNodes(dummyAddressData, batchWeight, txCountWeight, txAmountWeight, k);
            resolve(topNodes);
        }, 500);
    });
};

// 단일 주소 상세 정보 조회 API
export const fetchAddressDetail = async (address) => {
    // TODO: 실제 API 엔드포인트로 대체 필요
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const addressInfo = dummyAddressData.find(item => item.address === address);
            if (addressInfo) {
                resolve(addressInfo);
            } else {
                reject(new Error('Address not found'));
            }
        }, 300);
    });
};

// 특정 주소와 관련된 트랜잭션 조회 API
export const fetchAddressTransactions = async (address) => {
    // TODO: 실제 API 엔드포인트로 대체 필요
    return new Promise((resolve) => {
        setTimeout(() => {
            const filteredTxs = dummyTransactions.filter(tx =>
                tx.fromAddress === address || tx.toAddress === address
            );
            resolve(filteredTxs);
        }, 300);
    });
};
