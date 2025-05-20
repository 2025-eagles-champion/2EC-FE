// src/components/NavigationBar/NodeList.jsx
import React from "react";
import "./NodeList.css";
import { shortenAddress } from "../../utils/dataUtils";
import { getChainColor, getTierColor } from "../../utils/colorUtils";

const NodeList = ({ addressData, topNodes, loading, onNodeSelect }) => {
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
        // topNodes가 있으면 그것을 사용하고, 없으면 addressData에서 상위 노드 추출
        const nodesToRender =
            topNodes && topNodes.length > 0
                ? topNodes
                : addressData && addressData.length > 0
                ? [...addressData]
                      .sort((a, b) => {
                          const scoreA =
                              a.final_score !== undefined
                                  ? a.final_score
                                  : a.pagerank || 0;
                          const scoreB =
                              b.final_score !== undefined
                                  ? b.final_score
                                  : b.pagerank || 0;
                          return scoreB - scoreA;
                      })
                      .slice(0, 20)
                : [];

        if (nodesToRender.length === 0) {
            return <div className="no-nodes">표시할 노드가 없습니다.</div>;
        }

        return nodesToRender.map((node) => (
            <div
                key={node.id || node.address}
                className="node-item"
                onClick={() => onNodeSelect(node)}
            >
                <div
                    className="node-icon"
                    style={{
                        backgroundColor: getChainColor(
                            node.chain ||
                                extractChainName(node.address || node.id)
                        ),
                    }}
                ></div>
                <div className="node-info">
                    <div className="node-name">
                        {node.name ||
                            shortenAddress(node.address || node.id, 5, 4)}
                    </div>
                </div>
                <div className="node-stats">
                    <div>
                        거래 횟수:{" "}
                        {(node.sent_tx_count || 0) + (node.recv_tx_count || 0)}
                    </div>
                    <div>
                        거래량:{" "}
                        {(
                            (node.sent_tx_amount || 0) +
                            (node.recv_tx_amount || 0)
                        ).toFixed(2)}
                    </div>
                </div>
            </div>
        ));
    };

    return (
        <div className="node-list-container">
            <h3>주요 노드 목록</h3>
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
