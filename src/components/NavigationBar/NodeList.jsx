import React from 'react';
import './NodeList.css';
import { shortenAddress } from '../../utils/dataUtils';
import { getChainColor, getTierColor } from '../../utils/colorUtils';
import { tierConfig } from '../../constants/tierConfig';

const NodeList = ({ nodes, onNodeSelect }) => {
    return (
        <div className="node-list">
            {nodes.length === 0 ? (
                <div className="no-nodes">노드가 없습니다</div>
            ) : (
                <ul>
                    {nodes.map((node, index) => (
                        <li key={node.address} onClick={() => onNodeSelect(node)}>
                            <div className="node-rank">{index + 1}</div>
                            <div className="node-color" style={{ backgroundColor: getChainColor(node.address.split('1')[0]) }}></div>
                            <div className="node-info">
                                <div className="node-address">{shortenAddress(node.address)}</div>
                                <div className="node-details">
                                    <span className="node-chain">{node.address.split('1')[0]}</span>
                                    <span className="node-tier" style={{ color: getTierColor(node.tier) }}>
                                        {tierConfig[node.tier]?.label || '티어 없음'}
                                    </span>
                                </div>
                            </div>
                            <div className="node-stats">
                                <div className="stat">
                                    <span className="stat-label">전송:</span>
                                    <span className="stat-value">{node.sent_tx_count}</span>
                                </div>
                                <div className="stat">
                                    <span className="stat-label">수신:</span>
                                    <span className="stat-value">{node.recv_tx_count}</span>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default NodeList;
