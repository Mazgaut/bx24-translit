'use strict';

const CYRILLIC_TO_LATIN = {
  А: 'A', а: 'a',
  Б: 'B', б: 'b',
  В: 'V', в: 'v',
  Г: 'G', г: 'g',
  Д: 'D', д: 'd',
  Е: 'E', е: 'e',
  Ё: 'Yo', ё: 'yo',
  Ж: 'Zh', ж: 'zh',
  З: 'Z', з: 'z',
  И: 'I', и: 'i',
  Й: 'Y', й: 'y',
  К: 'K', к: 'k',
  Л: 'L', л: 'l',
  М: 'M', м: 'm',
  Н: 'N', н: 'n',
  О: 'O', о: 'o',
  П: 'P', п: 'p',
  Р: 'R', р: 'r',
  С: 'S', с: 's',
  Т: 'T', т: 't',
  У: 'U', у: 'u',
  Ф: 'F', ф: 'f',
  Х: 'Kh', х: 'kh',
  Ц: 'Ts', ц: 'ts',
  Ч: 'Ch', ч: 'ch',
  Ш: 'Sh', ш: 'sh',
  Щ: 'Shch', щ: 'shch',
  Ъ: '', ъ: '',
  Ы: 'Y', ы: 'y',
  Ь: '', ь: '',
  Э: 'E', э: 'e',
  Ю: 'Yu', ю: 'yu',
  Я: 'Ya', я: 'ya',
};

function transliterate(value) {
  return String(value ?? '')
    .split('')
    .map((char) => Object.prototype.hasOwnProperty.call(CYRILLIC_TO_LATIN, char) ? CYRILLIC_TO_LATIN[char] : char)
    .join('');
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  };
}

function parseUrlEncoded(body) {
  const result = {};
  const params = new URLSearchParams(body);

  for (const [key, value] of params.entries()) {
    setNestedValue(result, key, value);
  }

  return result;
}

function setNestedValue(target, key, value) {
  const parts = String(key).replace(/\]/g, '').split('[');
  let current = target;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const isLast = index === parts.length - 1;

    if (isLast) {
      current[part] = value;
    } else {
      current[part] = current[part] || {};
      current = current[part];
    }
  }
}

function parseBody(event) {
  if (!event || !event.body) {
    return {};
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  if (!rawBody) {
    return {};
  }

  const contentType = getHeader(event.headers, 'content-type');

  if (contentType.includes('application/json')) {
    return JSON.parse(rawBody);
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return parseUrlEncoded(rawBody);
  }

  try {
    return JSON.parse(rawBody);
  } catch (_error) {
    return parseUrlEncoded(rawBody);
  }
}

function getHeader(headers = {}, name) {
  const lowerName = name.toLowerCase();
  const foundKey = Object.keys(headers || {}).find((key) => key.toLowerCase() === lowerName);
  return foundKey ? String(headers[foundKey] || '').toLowerCase() : '';
}

function getQuery(event) {
  return event?.queryStringParameters || {};
}

function getInputString(payload, query) {
  return (
    payload?.properties?.inputString ??
    payload?.PROPERTIES?.inputString ??
    payload?.inputString ??
    query?.inputString ??
    ''
  );
}

function getEventToken(payload) {
  return payload?.event_token || payload?.EVENT_TOKEN || payload?.eventToken || '';
}

function getAccessToken(payload) {
  return payload?.auth?.access_token || payload?.AUTH_ID || payload?.access_token || '';
}

function getRestEndpoint(payload) {
  const endpoint = payload?.auth?.client_endpoint || payload?.auth?.CLIENT_ENDPOINT;
  if (endpoint) {
    return String(endpoint).replace(/\/+$/, '');
  }

  const domain = payload?.auth?.domain || payload?.auth?.DOMAIN || payload?.domain;
  if (domain) {
    return `https://${String(domain).replace(/^https?:\/\//, '').replace(/\/+$/, '')}/rest`;
  }

  return '';
}

async function sendBizprocEvent(payload, outputString) {
  const eventToken = getEventToken(payload);
  const accessToken = getAccessToken(payload);
  const restEndpoint = getRestEndpoint(payload);

  if (!eventToken || !accessToken || !restEndpoint) {
    return {
      skipped: true,
      reason: 'Missing event token, access token, or REST endpoint. Treated as a direct test call.',
    };
  }

  const response = await fetch(`${restEndpoint}/bizproc.event.send`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      event_token: eventToken,
      return_values: {
        outputString,
      },
      log_message: 'Transliteration completed',
      auth: accessToken,
    }),
  });

  const text = await response.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch (_error) {
    body = text;
  }

  if (!response.ok || body?.error) {
    throw new Error(`bizproc.event.send failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return {
    skipped: false,
    status: response.status,
    body,
  };
}

function assertSecret(query) {
  const expected = process.env.HANDLER_SECRET;

  if (!expected) {
    return;
  }

  if (query?.key !== expected) {
    const error = new Error('Invalid handler key');
    error.statusCode = 403;
    throw error;
  }
}

exports.handler = async function handler(event) {
  try {
    const query = getQuery(event);
    assertSecret(query);

    const payload = parseBody(event);
    const inputString = getInputString(payload, query);
    const outputString = transliterate(inputString);
    const sendResult = await sendBizprocEvent(payload, outputString);

    if (sendResult.skipped) {
      return response(200, {
        ok: true,
        mode: 'test',
        input: inputString,
        output: outputString,
      });
    }

    return response(200, {
      ok: true,
      outputString,
    });
  } catch (error) {
    return response(error.statusCode || 500, {
      ok: false,
      error: error.message,
    });
  }
};

