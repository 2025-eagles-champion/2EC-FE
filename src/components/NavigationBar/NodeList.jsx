// src/components/NavigationBar/NodeList.jsx
import React, { useEffect } from 'react';
import './NodeList.css';
import { shortenAddress, getAddressName } from '../../utils/dataUtils';
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

    // 렌더링 로직 분리 - 안전하게 처리
    const renderNodes = () => {
        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
            return <div className="no-nodes">노드가 없습니다</div>;
        }

        console.log("Rendering NodeList with", nodes.length, "nodes");

        const validNodes = nodes.filter(node => node && (node.address || node.id));

        if (validNodes.length === 0) {
            return <div className="no-nodes">유효한 노드가 없습니다</div>;
        }

        return (
            <ul>
                {validNodes.map((node, index) => {
                    // 주소 확인 (address 또는 id 필드 사용)
                    const nodeId = node.address || node.id;
                    if (!nodeId) {
                        console.warn("Node has no identifier:", node);
                        return null;
                    }

                    const chainName = node.chain || extractChainName(nodeId);

                    // 노드 이름 계산 - 체인명 + UUID 앞 4자리 형식
                    const displayName = node.name || getAddressName(nodeId);

                    return (
                        <li key={nodeId} onClick={() => onNodeSelect(node)}>
                            <div className="node-rank">{index + 1}</div>
                            <div className="node-color" style={{ backgroundColor: getChainColor(chainName) }}></div>
                            <div className="node-info">
                                <div className="node-address">{displayName}</div>
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
        );
    };

    // 메인 렌더링
    return (
        <div className="node-list" data-testid="node-list">
            {renderNodes()}
        </div>
    );
};

export default NodeList;
