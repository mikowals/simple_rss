import React, { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import formatDistanceToNow  from 'date-fns/formatDistanceToNow';

export const TimeAgo = memo(({timeText}) => <span>{timeText}</span>);
TimeAgo.displayName = "TimeAgo";
// Hook version of date -> timeText.
export const useTimeAgoText = (date) => {
  const getTimeText = (date) => {
    return (date && formatDistanceToNow(date) + " ago") || "";
  };
  // Set time update frequency to be longer when time text will only change hourly.
  // Sync time updates with system clock so times render together for user.
  const msUntilUpdate = (timeText) => {
    const timeToUpdate = (timeText.includes("hour") ? 15 : 1) * 60 * 1000;
    const msSinceClockMinute = (Date.now() % (60 * 1000));
    return timeToUpdate - msSinceClockMinute;
  };

  const [timeText, setTimeText] = useState(getTimeText(date));
  useEffect(() => {
    // Each run sets a new timeout length based on current text.
    let intervalHandle;
    let intervalFn = () => {
      const newTimeText = getTimeText(date);
      setTimeText(newTimeText);
      intervalHandle = setTimeout(intervalFn, msUntilUpdate(newTimeText));
    }
    intervalFn();
    return () => intervalHandle && clearTimeout(intervalHandle);
  }, [date]);

  return timeText;
};

export const TimeAgoContainer = ({date}) => {
  const timeText = useTimeAgoText(date);
  return <TimeAgo timeText={timeText} />;
}

TimeAgoContainer.propTypes = {
  date: PropTypes.number.isRequired
};
