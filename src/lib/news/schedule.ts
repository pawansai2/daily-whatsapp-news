export type LocalClock = {
  localDate: string;
  minutes: number;
};

export function parseDeliveryMinutes(
  deliveryTime: string,
): number {
  const match =
    /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
      deliveryTime,
    );

  if (!match) {
    throw new Error(
      "Invalid delivery time.",
    );
  }

  return (
    Number(match[1]) * 60 +
    Number(match[2])
  );
}

export function getLocalClock(
  timezone: string,
  now: Date = new Date(),
): LocalClock {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      },
    );

  const parts =
    formatter.formatToParts(now);

  const getPart = (
    type: string,
  ) =>
    parts.find(
      (part) =>
        part.type === type,
    )?.value ?? "";

  const year =
    getPart("year");

  const month =
    getPart("month");

  const day =
    getPart("day");

  const hour =
    Number(
      getPart("hour"),
    );

  const minute =
    Number(
      getPart("minute"),
    );

  if (
    !year ||
    !month ||
    !day ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    throw new Error(
      "Unable to calculate local time.",
    );
  }

  return {
    localDate:
      `${year}-${month}-${day}`,
    minutes:
      hour * 60 + minute,
  };
}

export function buildNewsOccurrenceKey(
  localDate: string,
  deliveryTime: string,
): string {
  return `news-digest:${localDate}:${deliveryTime}`;
}

function getTimezoneOffsetMilliseconds(
  date: Date,
  timezone: string,
): number {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      },
    );

  const parts =
    formatter.formatToParts(date);

  const getNumber = (
    type: string,
  ) => {
    const value =
      parts.find(
        (part) =>
          part.type === type,
      )?.value;

    if (!value) {
      throw new Error(
        "Unable to calculate timezone offset.",
      );
    }

    return Number(value);
  };

  const asUtc =
    Date.UTC(
      getNumber("year"),
      getNumber("month") - 1,
      getNumber("day"),
      getNumber("hour"),
      getNumber("minute"),
      getNumber("second"),
    );

  const sourceTime =
    Math.trunc(
      date.getTime() / 1000,
    ) * 1000;

  return asUtc - sourceTime;
}

export function getScheduledForIso(
  localDate: string,
  deliveryTime: string,
  timezone: string,
): string {
  const dateMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      localDate,
    );

  if (!dateMatch) {
    throw new Error(
      "Invalid local delivery date.",
    );
  }

  const minutes =
    parseDeliveryMinutes(
      deliveryTime,
    );

  const hour =
    Math.floor(
      minutes / 60,
    );

  const minute =
    minutes % 60;

  const utcGuess =
    Date.UTC(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      hour,
      minute,
      0,
    );

  const firstOffset =
    getTimezoneOffsetMilliseconds(
      new Date(utcGuess),
      timezone,
    );

  let scheduledTime =
    utcGuess - firstOffset;

  const secondOffset =
    getTimezoneOffsetMilliseconds(
      new Date(scheduledTime),
      timezone,
    );

  if (
    secondOffset !== firstOffset
  ) {
    scheduledTime =
      utcGuess - secondOffset;
  }

  return new Date(
    scheduledTime,
  ).toISOString();
}
