const parseTimeout = (timeoutStr) => {
  if (!timeoutStr || typeof timeoutStr !== "string") {
    return null;
  }

  const trimmed = timeoutStr.trim();
  if (!trimmed) {
    return null;
  }

  // Match patterns like "4h", "30m", "60s", "100ms", "1.5h", etc.
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(ms|[smhd]?)$/i);

  if (!match) {
    throw new Error(
      `Invalid timeout format: ${timeoutStr}. Expected format: number + unit (ms/s/m/h/d), e.g. '4h', '30m', '60s', '500ms'`
    );
  }

  const [, numberStr, unit] = match;
  const number = parseFloat(numberStr);

  if (number <= 0) {
    throw new Error(`Timeout must be a positive number, got: ${number}`);
  }

  // Convert to milliseconds
  const unitLower = unit.toLowerCase();
  switch (unitLower) {
    case "ms": // milliseconds
      return number;
    case "s": // seconds
    case "": // default to seconds if no unit
      return number * 1000;
    case "m": // minutes
      return number * 60 * 1000;
    case "h": // hours
      return number * 60 * 60 * 1000;
    case "d": // days
      return number * 24 * 60 * 60 * 1000;
    default:
      throw new Error(
        `Invalid timeout unit: ${unit}. Supported units: ms (milliseconds), s (seconds), m (minutes), h (hours), d (days)`
      );
  }
};

const formatTimeout = (timeoutMs) => {
  if (!timeoutMs || timeoutMs <= 0) {
    return "no timeout";
  }

  const seconds = timeoutMs / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  if (days >= 1) {
    return `${days.toFixed(1)}d`;
  } else if (hours >= 1) {
    return `${hours.toFixed(1)}h`;
  } else if (minutes >= 1) {
    return `${minutes.toFixed(1)}m`;
  } else if (seconds >= 1) {
    return `${seconds.toFixed(1)}s`;
  } else {
    return `${timeoutMs.toFixed(1)}ms`;
  }
};

module.exports = { parseTimeout, formatTimeout };
