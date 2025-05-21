// src/components/BottomSheet/BottomSheet.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import "./BottomSheet.css";
import SankeyChart from "../SankeyChart/SankeyChart";
import StoryLineChart from "../StoryLineChart/StoryLineChart";
import TimeSeriesChart from "../TimeSeriesChart/TimeSeriesChart";
import { shortenAddress, getAddressName } from "../../utils/dataUtils";
import {
    fetchAddressDetail,
    fetchAddressTransactions,
} from "../../services/api";
import { tierConfig } from "../../constants/tierConfig";
import { getChainColor, getTierColor } from "../../utils/colorUtils";

const BottomSheet = ({
                         isOpen,
                         onClose,
                         selectedNode,
                         allTransactions,
                         addressData,
                     }) => {
    // 기본 상태
    const [nodeDetail, setNodeDetail] = useState(null);
    const [nodeTransactions, setNodeTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const sheetRef = useRef(null);

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // 현재 표시할 트랜잭션 목록을 계산하는 메모이제이션 훅
    const paginatedTransactions = useMemo(() => {
        // 전체 트랜잭션 중 최대 100개만 처리
        const limitedTransactions = nodeTransactions.slice(0, 100);

        // 현재 페이지에 표시할 트랜잭션 계산
        const indexOfLastTransaction = currentPage * itemsPerPage;
        const indexOfFirstTransaction = indexOfLastTransaction - itemsPerPage;

        return limitedTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
    }, [nodeTransactions, currentPage, itemsPerPage]);

    // 총 페이지 수 계산
    const totalPages = useMemo(() => {
        const totalItems = Math.min(nodeTransactions.length, 100);
        return Math.ceil(totalItems / itemsPerPage);
    }, [nodeTransactions.length, itemsPerPage]);

    // 선택된 노드가 변경될 때마다 상세 정보 조회
    useEffect(() => {
        if (selectedNode && isOpen) {
            setLoading(true);
            // 페이지네이션 초기화
            setCurrentPage(1);

            const nodeId = selectedNode.id || selectedNode.address;
            if (!nodeId) {
                console.error("Node has no identifier:", selectedNode);
                setLoading(false);
                return;
            }

            // 직접 데이터 찾기
            const directSearch = (id) => {
                const addrInfo = addressData.find(
                    (a) => a.address === id || a.id === id
                );
                const transactions = allTransactions.filter(
                    (tx) => tx.fromAddress === id || tx.toAddress === id
                );

                if (addrInfo) {
                    setNodeDetail(addrInfo);
                    // 트랜잭션을 시간 순으로 정렬 (최신 거래가 상단에 표시되도록)
                    const sortedTransactions = [...transactions].sort((a, b) =>
                        b.timestamp - a.timestamp
                    );
                    setNodeTransactions(sortedTransactions);
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
                        tier: "bronze",
                    };
                }),
                fetchAddressTransactions(nodeId).catch(() => []),
            ])
                .then(([detailData, transactionData]) => {
                    setNodeDetail(detailData);
                    // 트랜잭션을 시간 순으로 정렬 (최신 거래가 상단에 표시되도록)
                    const sortedTransactions = [...transactionData].sort((a, b) =>
                        b.timestamp - a.timestamp
                    );
                    setNodeTransactions(sortedTransactions);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [selectedNode, isOpen, addressData, allTransactions]);

    // 페이지 변경 시 테이블 스크롤 위치 초기화
    useEffect(() => {
        const tableWrapper = document.querySelector('.table-wrapper');
        if (tableWrapper) {
            tableWrapper.scrollTop = 0;
        }
    }, [currentPage, itemsPerPage]);

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

    // 페이지 변경 핸들러
    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages) {
            return;
        }
        setCurrentPage(newPage);
    };

    // 페이지 당 항목 수 변경 핸들러
    const handleItemsPerPageChange = (e) => {
        const newItemsPerPage = Number(e.target.value);

        // 현재 페이지 재계산 (현재 보고 있는 첫 항목이 새 페이지에도 포함되도록)
        const firstItemIndex = (currentPage - 1) * itemsPerPage;
        const newPage = Math.max(1, Math.floor(firstItemIndex / newItemsPerPage) + 1);

        setItemsPerPage(newItemsPerPage);
        setCurrentPage(newPage);
    };

    // 트랜잭션 목록 렌더링
    const renderTransactionsList = () => {
        if (!nodeTransactions || nodeTransactions.length === 0) {
            return <div className="no-transactions">거래 내역이 없습니다</div>;
        }

        // 표시할 아이템 범위 계산
        const totalItems = Math.min(nodeTransactions.length, 100);
        const indexOfFirstItem = (currentPage - 1) * itemsPerPage;

        return (
            <div className="transactions-list">
                <div className="transactions-header">
                    <h4>최근 거래 내역 ({totalItems}건)</h4>
                    <div className="transactions-controls">
                        <select
                            value={itemsPerPage}
                            onChange={handleItemsPerPageChange}
                            className="items-per-page-select"
                        >
                            <option value={5}>5개씩 보기</option>
                            <option value={10}>10개씩 보기</option>
                            <option value={20}>20개씩 보기</option>
                            <option value={50}>50개씩 보기</option>
                            <option value={100}>100개씩 보기</option>
                        </select>
                    </div>
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                        <tr>
                            <th>#</th>
                            <th>타입</th>
                            <th>발신지</th>
                            <th>수신지</th>
                            <th>금액</th>
                            <th>시간</th>
                        </tr>
                        </thead>
                        <tbody>
                        {paginatedTransactions.map((tx, index) => {
                            if (!tx || !tx.txhash) return null;

                            // 현재 페이지에 맞는 인덱스 계산 (1부터 시작)
                            const displayIndex = indexOfFirstItem + index + 1;

                            return (
                                <tr key={`tx-${tx.txhash}-idx-${displayIndex}`}>
                                    <td className="tx-index">{displayIndex}</td>
                                    <td>{tx.type || "전송"}</td>
                                    <td>
                                            <span
                                                className="address-chip"
                                                style={{
                                                    backgroundColor: getChainColor(
                                                        tx.fromChain || "unknown"
                                                    ),
                                                }}
                                            >
                                                {shortenAddress(
                                                    tx.fromAddress || "-"
                                                )}
                                            </span>
                                    </td>
                                    <td>
                                            <span
                                                className="address-chip"
                                                style={{
                                                    backgroundColor: getChainColor(
                                                        tx.toChain || "unknown"
                                                    ),
                                                }}
                                            >
                                                {shortenAddress(
                                                    tx.toAddress || "-"
                                                )}
                                            </span>
                                    </td>
                                    <td>
                                        {(tx.amount || 0).toFixed(4)}{" "}
                                        {tx.dpDenom || ""}
                                    </td>
                                    <td>
                                        {tx.timestamp
                                            ? new Date(
                                                tx.timestamp
                                            ).toLocaleString()
                                            : "-"}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>

                {/* 페이지네이션 UI */}
                {totalPages > 1 && (
                    <div className="pagination">
                        <button
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1}
                            className="pagination-button"
                            aria-label="첫 페이지"
                        >
                            &laquo;
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="pagination-button"
                            aria-label="이전 페이지"
                        >
                            &lt;
                        </button>

                        <div className="pagination-info">
                            <span className="current-page">{currentPage}</span>
                            <span className="page-separator"> / </span>
                            <span className="total-pages">{totalPages}</span>
                        </div>

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="pagination-button"
                            aria-label="다음 페이지"
                        >
                            &gt;
                        </button>
                        <button
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage === totalPages}
                            className="pagination-button"
                            aria-label="마지막 페이지"
                        >
                            &raquo;
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // 노드 상세 정보 렌더링
    const renderNodeDetailInfo = () => {
        if (!nodeDetail || !selectedNode) return null;

        const nodeId = selectedNode.id || selectedNode.address || "";

        // 주소로부터 체인 이름 추출 - 안전하게 처리
        let chainName = "unknown";
        try {
            if (selectedNode.chain) {
                // 노드에 체인 정보가 있으면 직접 사용
                chainName = selectedNode.chain;
            } else if (typeof nodeId === "string" && nodeId.includes("1")) {
                // 주소 형식에서 체인 이름 추출 시도
                chainName = nodeId.split("1")[0];
            }
        } catch (e) {
            console.warn("Error extracting chain name:", e);
        }

        // 페이지랭크가 없으면 0.1로 설정
        const pageRank =
            nodeDetail.pagerank !== undefined ? nodeDetail.pagerank : 0.1;
        // 티어가 없으면 기본값으로 bronze
        const tier = nodeDetail.tier || "bronze";

        // 페이지랭크가 NaN이 아닌지 확인
        const displayRank = isNaN(pageRank) ? 10 : (pageRank * 100).toFixed(1);

        return (
            <div className="node-detail-info">
                <div className="node-header">
                    <div className="node-title">
                        <div
                            className="node-icon"
                            style={{
                                backgroundColor: getChainColor(chainName),
                            }}
                        ></div>
                        <h3>{shortenAddress(nodeId, 8, 8)}</h3>
                    </div>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-title">총 전송량</div>
                        <div className="stat-value">
                            {(nodeDetail.sent_tx_amount || 0).toFixed(4)}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">총 수신량</div>
                        <div className="stat-value">
                            {(nodeDetail.recv_tx_amount || 0).toFixed(4)}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">전송 횟수</div>
                        <div className="stat-value">
                            {nodeDetail.sent_tx_count || 0}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">수신 횟수</div>
                        <div className="stat-value">
                            {nodeDetail.recv_tx_count || 0}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">활동 일수</div>
                        <div className="stat-value">
                            {nodeDetail.active_days_count || 0}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">거래 상대방 수</div>
                        <div className="stat-value">
                            {(nodeDetail.counterparty_count_sent || 0) +
                                (nodeDetail.counterparty_count_recv || 0)}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            className={`bottom-sheet-overlay ${isOpen ? "open" : ""}`}
            onClick={handleOutsideClick}
        >
            <div
                ref={sheetRef}
                className={`bottom-sheet ${isOpen ? "open" : ""}`}
            >
                <div className="bottom-sheet-header">
                    <div className="handle-bar"></div>
                    <button className="close-button" onClick={handleClose}>
                        ×
                    </button>
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
                                    selectedAddress={
                                        selectedNode?.id ||
                                        selectedNode?.address
                                    }
                                    addressData={addressData}
                                />
                            </div>

                            {/* StoryLineChart 컴포넌트 추가 */}
                            <div className="storyline-section">
                                <h4>시간에 따른 계정 간 거래 흐름</h4>
                                <StoryLineChart
                                    transactions={nodeTransactions}
                                    selectedAddress={
                                        selectedNode?.id ||
                                        selectedNode?.address
                                    }
                                />
                            </div>

                            {/* TimeSeriesChart.jsx */}
                            <div className="timeseries-section">
                                <h4>시간 축 기반 시각화</h4>
                                <TimeSeriesChart
                                    transactions={nodeTransactions}
                                    selectedAddress={
                                        selectedNode?.id ||
                                        selectedNode?.address
                                    }
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
