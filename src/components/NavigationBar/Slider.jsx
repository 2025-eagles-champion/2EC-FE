
// src/components/NavigationBar/Slider.jsx
import React from 'react';
import './Slider.css';

const Slider = ({ value, onChange, min = 0, max = 100, step = 1 }) => {
    const handleChange = (e) => {
        onChange(parseInt(e.target.value, 10));
    };

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
                    style={{ width: `${((value - min) / (max - min)) * 100}%` }}
                ></div>
            </div>
        </div>
    );
};

export default Slider;
