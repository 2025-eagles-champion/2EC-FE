// src/components/BottomSheet/BottomSheet.jsx
import React, { useState, useEffect, useRef } from 'react';
import './BottomSheet.css';
import SankeyChart from '../SankeyChart/SankeyChart';
import { shortenAddress } from '../../utils/dataUtils';
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

            // 동시에 두 API 호출
            Promise.all([
                fetchAddressDetail(selectedNode.id),
                fetchAddressTransactions(selectedNode.id)
            ])
                .then(([detailData, transactionData]) => {
                    setNodeDetail(detailData);
                    setNodeTransactions(transactionData);
                })
                .catch(error => {
                    console.error("Error fetching node details:", error);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [selectedNode, isOpen]);

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
        if (nodeTransactions.length === 0) {
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
                        {nodeTransactions.slice(0, 5).map(tx => (
                            <tr key={tx.txhash}>
                                <td>{tx.type}</td>
                                <td>
                                    <span className="address-chip" style={{ backgroundColor: getChainColor(tx.fromChain) }}>
                                        {shortenAddress(tx.fromAddress)}
                                    </span>
                                </td>
                                <td>
                                    <span className="address-chip" style={{ backgroundColor: getChainColor(tx.toChain) }}>
                                        {shortenAddress(tx.toAddress)}
                                    </span>
                                </td>
                                <td>{tx.amount} {tx.dpDenom}</td>
                                <td>{new Date(tx.timestamp).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // 노드 상세 정보 렌더링
    const renderNodeDetailInfo = () => {
        if (!nodeDetail) return null;

        const chainName = selectedNode.id.split('1')[0];

        return (
            <div className="node-detail-info">
                <div className="node-header">
                    <div className="node-title">
                        <div
                            className="node-icon"
                            style={{ backgroundColor: getChainColor(chainName) }}
                        ></div>
                        <h3>{shortenAddress(selectedNode.id, 8, 8)}</h3>
                    </div>
                    <div
                        className="tier-badge"
                        style={{ backgroundColor: getTierColor(nodeDetail.tier) }}
                    >
                        {tierConfig[nodeDetail.tier]?.label || '티어 없음'}
                    </div>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-title">총 전송량</div>
                        <div className="stat-value">{nodeDetail.sent_tx_amount.toFixed(4)}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">총 수신량</div>
                        <div className="stat-value">{nodeDetail.recv_tx_amount.toFixed(4)}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">전송 횟수</div>
                        <div className="stat-value">{nodeDetail.sent_tx_count}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">수신 횟수</div>
                        <div className="stat-value">{nodeDetail.recv_tx_count}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">활동 일수</div>
                        <div className="stat-value">{nodeDetail.active_days_count}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">거래 상대방 수</div>
                        <div className="stat-value">{nodeDetail.counterparty_count_sent + nodeDetail.counterparty_count_recv}</div>
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
