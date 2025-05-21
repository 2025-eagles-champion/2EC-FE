// src/components/NavigationBar/NodeList.jsx
import React from "react";
import "./NodeList.css";
import { shortenAddress } from "../../utils/dataUtils";
import { getChainColor } from "../../utils/colorUtils";

const NodeList = ({ topNodes, loading, onNodeSelect }) => {
    // 체인 이름 추출 함수 (주소에서 안전하게 체인 이름 추출)
    const extractChainName = (address) => {
        if (!address || typeof address !== "string") return "unknown";
        try {
            if (address.includes("1")) {
                return address.split("1")[0];
            }
            return "unknown";
        } catch (e) {
            console.warn("Error extracting chain name:", e);
            return "unknown";
        }
    };

    // 노드 목록 렌더링
    const renderNodes = () => {
        if (!topNodes || topNodes.length === 0) {
            return <div className="no-nodes">표시할 노드가 없습니다.</div>;
        }

        return topNodes.map((node, index) => {
            // 안전하게 node.address 또는 node.id 가져오기
            const nodeId = node.address || node.id || "";

            // 체인 이름 결정
            const chainName = node.chain || extractChainName(nodeId);

            // 거래 횟수와 거래량 계산
            const txCount = (node.sent_tx_count || 0) + (node.recv_tx_count || 0);
            const txAmount = (node.sent_tx_amount || 0) + (node.recv_tx_amount || 0);

            return (
                <div
                    key={nodeId}
                    className="node-item"
                    onClick={() => onNodeSelect(node)}
                >
                    <div className="node-rank">{index + 1}</div>
                    <div
                        className="node-color"
                        style={{
                            backgroundColor: getChainColor(chainName),
                        }}
                    ></div>
                    <div className="node-info">
                        <div className="node-address">
                            {node.name ||
                                shortenAddress(nodeId, 5, 4)}
                        </div>
                        <div className="node-details">
                            <span className="node-chain">{chainName}</span>
                            {/*<span className="node-tier">{node.tier || "bronze"}</span>*/}
                        </div>
                    </div>
                    <div className="node-stats">
                        <div className="stat">
                            <span className="stat-label">TX:</span>
                            <span className="stat-value">
                                {txCount}
                            </span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">Val:</span>
                            <span className="stat-value">
                                {txAmount.toFixed(1)}
                            </span>
                        </div>
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="node-list-container">
            <div className="node-list">
                {loading ? (
                    <div className="loading-indicator">
                        데이터를 불러오는 중...
                    </div>
                ) : (
                    renderNodes()
                )}
            </div>
        </div>
    );
};

export default NodeList;
