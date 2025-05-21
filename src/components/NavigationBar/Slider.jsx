// src/components/NavigationBar/Slider.jsx
import React from 'react';
import './Slider.css';

const Slider = ({ value, onChange, min = 0, max = 100, step = 1 }) => {
    const handleChange = (e) => {
        onChange(parseInt(e.target.value, 10));
    };

    // 퍼센트 계산 - min, max 값이 변경되어도 정확하게 작동하도록 함
    const fillPercentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="custom-slider">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleChange}
                className="slider"
            />
            <div className="slider-track">
                <div
                    className="slider-fill"
                    style={{ width: `${fillPercentage}%` }}
                ></div>
            </div>
        </div>
    );
};

export default Slider;
