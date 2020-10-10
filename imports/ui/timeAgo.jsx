import React, { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import formatDistanceToNow  from 'date-fns/formatDistanceToNow';

export const TimeAgo = React.memo((props) => <span>{props.timeText}</span>);

TimeAgo.propTypes = {
  timeText: PropTypes.string.isRequired
}

TimeAgo.displayName = "TimeAgo";

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

// Transform date property into time ago text that updates automatically.
// Only past times in minues require frequent text changes.
export const withTimeText = (WrappedComponent) => {
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

  // Memo because given the same props a rerender should produce the same
  // output as is currently displayed.
  const NewComponent = memo((props) => {
    const {date, ...passThroughProps} = props;
    const [timeText, setTimeText] = useState(getTimeText(props.date));
    useEffect(() => {
      let innerTimeout = null;
      // Each run sets a new timeout length based on current text.
      let intervalFn = () => {
        newTimeText = getTimeText(props.date);
        setTimeText(newTimeText);
        innerTimeout = setTimeout(intervalFn, msUntilUpdate(newTimeText));
      }
      const timeout = setTimeout(intervalFn, msUntilUpdate(timeText));
      return () => {
        timeout && clearTimeout(timeout);
        innerTimeout && clearTimeout(innerTimeout);
      };
    }, [props.date]);

    return <WrappedComponent {...passThroughProps} timeText={timeText} />;
  });

  NewComponent.displayName = "withTimeText(" + getDisplayName(WrappedComponent) + ")";
  return NewComponent;
}

export const TimeAgoContainer = withTimeText(TimeAgo);

TimeAgoContainer.propTypes = {
  date: PropTypes.number.isRequired
};
