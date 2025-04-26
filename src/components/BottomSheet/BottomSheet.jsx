// src/components/BottomSheet/BottomSheet.jsx
import React, { useState, useEffect, useRef } from 'react';
import './BottomSheet.css';
import SankeyChart from '../SankeyChart/SankeyChart';
import { shortenAddress, getAddressName } from '../../utils/dataUtils';
import { fetchAddressDetail, fetchAddressTransactions } from '../../services/api';
import { tierConfig } from '../../constants/tierConfig';
import { getChainColor, getTierColor } from '../../utils/colorUtils';

const BottomSheet = ({ isOpen, onClose, selectedNode, allTransactions, addressData }) => {
    const [nodeDetail, setNodeDetail] = useState(null);
    const [nodeTransactions, setNodeTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const sheetRef = useRef(null);

    // 선택된 노드가 변경될 때마다 상세 정보 조회
    useEffect(() => {
        if (selectedNode && isOpen) {
            setLoading(true);

            const nodeId = selectedNode.id || selectedNode.address;
            if (!nodeId) {
                console.error("Node has no identifier:", selectedNode);
                setLoading(false);
                return;
            }

            // 직접 데이터 찾기
            const directSearch = (id) => {
                const addrInfo = addressData.find(a => a.address === id || a.id === id);
                const transactions = allTransactions.filter(tx =>
                    tx.fromAddress === id || tx.toAddress === id
                );

                if (addrInfo) {
                    setNodeDetail(addrInfo);
                    setNodeTransactions(transactions);
                    setLoading(false);
                    return true;
                }
                return false;
            };

            // 직접 검색 시도
            if (directSearch(nodeId)) {
                return;
            }

            // API 호출로 시도
            Promise.all([
                fetchAddressDetail(nodeId).catch(() => {
                    // API 호출 실패 시 기본값 제공
                    console.log("API fetch failed, using fallback data");
                    return {
                        address: nodeId,
                        sent_tx_count: 0,
                        recv_tx_count: 0,
                        sent_tx_amount: 0,
                        recv_tx_amount: 0,
                        pagerank: 0.1,
                        tier: "bronze"
                    };
                }),
                fetchAddressTransactions(nodeId).catch(() => [])
            ])
                .then(([detailData, transactionData]) => {
                    setNodeDetail(detailData);
                    setNodeTransactions(transactionData);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [selectedNode, isOpen, addressData, allTransactions]);

    // 바텀 시트 닫기
    const handleClose = () => {
        onClose();
    };

    // 바깥 영역 클릭 시 닫기
    const handleOutsideClick = (e) => {
        if (sheetRef.current && !sheetRef.current.contains(e.target)) {
            onClose();
        }
    };

    // 트랜잭션 목록 렌더링
    const renderTransactionsList = () => {
        if (!nodeTransactions || nodeTransactions.length === 0) {
            return <div className="no-transactions">거래 내역이 없습니다</div>;
        }

        return (
            <div className="transactions-list">
                <h4>최근 거래 내역</h4>
                <table>
                    <thead>
                        <tr>
                            <th>타입</th>
                            <th>발신지</th>
                            <th>수신지</th>
                            <th>금액</th>
                            <th>시간</th>
                        </tr>
                    </thead>
                    <tbody>
                        {nodeTransactions.slice(0, 5).map(tx => {
                            if (!tx || !tx.txhash) return null;

                            return (
                                <tr key={tx.txhash}>
                                    <td>{tx.type || '전송'}</td>
                                    <td>
                                        <span className="address-chip" style={{ backgroundColor: getChainColor(tx.fromChain || 'unknown') }}>
                                            {shortenAddress(tx.fromAddress || '-')}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="address-chip" style={{ backgroundColor: getChainColor(tx.toChain || 'unknown') }}>
                                            {shortenAddress(tx.toAddress || '-')}
                                        </span>
                                    </td>
                                    <td>{(tx.amount || 0).toFixed(4)} {tx.dpDenom || ''}</td>
                                    <td>{tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // 노드 상세 정보 렌더링
    const renderNodeDetailInfo = () => {
        if (!nodeDetail || !selectedNode) return null;

        const nodeId = selectedNode.id || selectedNode.address || '';

        // 주소로부터 체인 이름 추출 - 안전하게 처리
        let chainName = 'unknown';
        try {
            if (selectedNode.chain) {
                // 노드에 체인 정보가 있으면 직접 사용
                chainName = selectedNode.chain;
            } else if (typeof nodeId === 'string' && nodeId.includes('1')) {
                // 주소 형식에서 체인 이름 추출 시도
                chainName = nodeId.split('1')[0];
            }
        } catch (e) {
            console.warn('Error extracting chain name:', e);
        }

        // 페이지랭크가 없으면 0.1로 설정
        const pageRank = nodeDetail.pagerank !== undefined ? nodeDetail.pagerank : 0.1;
        // 티어가 없으면 기본값으로 bronze
        const tier = nodeDetail.tier || 'bronze';

        // 페이지랭크가 NaN이 아닌지 확인
        const displayRank = isNaN(pageRank) ? 10 : (pageRank * 100).toFixed(1);

        return (
            <div className="node-detail-info">
                <div className="node-header">
                    <div className="node-title">
                        <div
                            className="node-icon"
                            style={{ backgroundColor: getChainColor(chainName) }}
                        ></div>
                        <h3>{shortenAddress(nodeId, 8, 8)}</h3>
                    </div>
                    <div
                        className="tier-badge"
                        style={{ backgroundColor: getTierColor(tier) }}
                    >
                        {tierConfig[tier]?.label || '브론즈'}
                    </div>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-title">총 전송량</div>
                        <div className="stat-value">{(nodeDetail.sent_tx_amount || 0).toFixed(4)}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">총 수신량</div>
                        <div className="stat-value">{(nodeDetail.recv_tx_amount || 0).toFixed(4)}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">전송 횟수</div>
                        <div className="stat-value">{nodeDetail.sent_tx_count || 0}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">수신 횟수</div>
                        <div className="stat-value">{nodeDetail.recv_tx_count || 0}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">활동 일수</div>
                        <div className="stat-value">{nodeDetail.active_days_count || 0}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">거래 상대방 수</div>
                        <div className="stat-value">{(nodeDetail.counterparty_count_sent || 0) + (nodeDetail.counterparty_count_recv || 0)}</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            className={`bottom-sheet-overlay ${isOpen ? 'open' : ''}`}
            onClick={handleOutsideClick}
        >
            <div
                ref={sheetRef}
                className={`bottom-sheet ${isOpen ? 'open' : ''}`}
            >
                <div className="bottom-sheet-header">
                    <div className="handle-bar"></div>
                    <button className="close-button" onClick={handleClose}>×</button>
                </div>

                <div className="bottom-sheet-content">
                    {loading ? (
                        <div className="loading-spinner">로딩 중...</div>
                    ) : (
                        <>
                            {renderNodeDetailInfo()}

                            <div className="sankey-section">
                                <h4>거래 흐름 다이어그램</h4>
                                <SankeyChart
                                    transactions={allTransactions}
                                    selectedAddress={selectedNode?.id}
                                    addressData={addressData}
                                />
                            </div>

                            {renderTransactionsList()}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BottomSheet;
