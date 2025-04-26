// src/components/NavigationBar/NodeList.jsx
import React, { useEffect } from 'react';
import './NodeList.css';
import { shortenAddress } from '../../utils/dataUtils';
import { getChainColor, getTierColor } from '../../utils/colorUtils';
import { tierConfig } from '../../constants/tierConfig';

const NodeList = ({ nodes, onNodeSelect }) => {
    // 체인 이름 추출 함수 (주소에서 안전하게 체인 이름 추출)
    const extractChainName = (address) => {
        if (!address || typeof address !== 'string') return 'unknown';

        try {
            if (address.includes('1')) {
                return address.split('1')[0];
            }
            return 'unknown';
        } catch (e) {
            console.warn('Error extracting chain name:', e);
            return 'unknown';
        }
    };

    // 디버깅용 로그
    useEffect(() => {
        console.log("NodeList received nodes:", nodes);
    }, [nodes]);

    // 노드가 없거나 빈 배열인 경우 확인
    if (!nodes) {
        console.log("Nodes is undefined or null");
        return <div className="no-nodes">노드가 없습니다</div>;
    }

    if (!Array.isArray(nodes)) {
        console.log("Nodes is not an array:", nodes);
        return <div className="no-nodes">노드 타입 오류</div>;
    }

    if (nodes.length === 0) {
        console.log("Nodes array is empty");
        return <div className="no-nodes">노드가 없습니다</div>;
    }

    console.log("Rendering NodeList with", nodes.length, "nodes");

    return (
        <div className="node-list">
            <ul>
                {nodes.map((node, index) => {
                    if (!node) {
                        console.warn("Null or undefined node at index", index);
                        return null;
                    }

                    if (!node.address) {
                        console.warn("Node has no address:", node);
                        return null;
                    }

                    const chainName = node.chain || extractChainName(node.address);

                    return (
                        <li key={node.address} onClick={() => onNodeSelect(node)}>
                            <div className="node-rank">{index + 1}</div>
                            <div className="node-color" style={{ backgroundColor: getChainColor(chainName) }}></div>
                            <div className="node-info">
                                <div className="node-address">{shortenAddress(node.address)}</div>
                                <div className="node-details">
                                    <span className="node-chain">{chainName}</span>
                                    <span className="node-tier" style={{ color: getTierColor(node.tier) }}>
                                        {tierConfig[node.tier]?.label || '브론즈'}
                                    </span>
                                </div>
                            </div>
                            <div className="node-stats">
                                <div className="stat">
                                    <span className="stat-label">전송:</span>
                                    <span className="stat-value">{node.sent_tx_count || 0}</span>
                                </div>
                                <div className="stat">
                                    <span className="stat-label">수신:</span>
                                    <span className="stat-value">{node.recv_tx_count || 0}</span>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default NodeList;
