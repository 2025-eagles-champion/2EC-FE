import React, { useState } from 'react';
import './DateRangePicker.css';

const DateRangePicker = ({ dateRange, onDateRangeChange }) => {
    const [startDate, setStartDate] = useState(dateRange.startDate);
    const [endDate, setEndDate] = useState(dateRange.endDate);

    // 시작 날짜 변경 핸들러
    const handleStartDateChange = (e) => {
        const newStartDate = e.target.value;
        setStartDate(newStartDate);
        // 종료 날짜가 시작 날짜보다 빠르면 종료 날짜도 같이 변경
        if (new Date(newStartDate) > new Date(endDate)) {
            setEndDate(newStartDate);
            onDateRangeChange({
                startDate: newStartDate,
                endDate: newStartDate
            });
        } else {
            onDateRangeChange({
                startDate: newStartDate,
                endDate
            });
        }
    };

    // 종료 날짜 변경 핸들러
    const handleEndDateChange = (e) => {
        const newEndDate = e.target.value;
        setEndDate(newEndDate);

        // 종료 날짜가 시작 날짜보다 빠르면 시작 날짜도 같이 변경
        if (new Date(newEndDate) < new Date(startDate)) {
            setStartDate(newEndDate);
            onDateRangeChange({
                startDate: newEndDate,
                endDate: newEndDate
            });
        } else {
            onDateRangeChange({
                startDate,
                endDate: newEndDate
            });
        }
    };

    return (
        <div className="date-range-picker">
            <div className="date-input-group">
                <label htmlFor="start-date">시작 날짜</label>
                <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    min="2020-01-01"
                    max="2025-12-31"
                />
            </div>
            <div className="date-input-group">
                <label htmlFor="end-date">종료 날짜</label>
                <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={handleEndDateChange}
                    min="2020-01-01"
                    max="2025-12-31"
                />
            </div>
        </div>
    );
};

export default DateRangePicker;
