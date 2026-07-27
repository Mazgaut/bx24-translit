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
    .join('')
    .replace(/\s+/g, '_');
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

function getAction(payload, query) {
  if (query?.action) {
    return query.action;
  }

  if (payload?.action) {
    return payload.action;
  }

  if (getEventToken(payload)) {
    return 'handler';
  }

  if (getAccessToken(payload)) {
    return 'install';
  }

  return 'test';
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

function getAuthUserId(payload) {
  const userId = payload?.auth?.user_id || payload?.auth?.USER_ID || payload?.user_id || 1;
  const parsed = Number(userId);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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

function getPublicFunctionUrl(event) {
  if (process.env.PUBLIC_FUNCTION_URL) {
    return process.env.PUBLIC_FUNCTION_URL;
  }

  const host = getHeaderRaw(event?.headers, 'host');
  const proto = getHeaderRaw(event?.headers, 'x-forwarded-proto') || 'https';
  const path = event?.path || event?.requestContext?.http?.path || event?.requestContext?.path || '';

  if (host && path) {
    return `${proto}://${host}${path}`;
  }

  throw new Error('Cannot determine public function URL. Set PUBLIC_FUNCTION_URL env variable.');
}

function getHeaderRaw(headers = {}, name) {
  const lowerName = name.toLowerCase();
  const foundKey = Object.keys(headers || {}).find((key) => key.toLowerCase() === lowerName);
  return foundKey ? String(headers[foundKey] || '') : '';
}

function buildHandlerUrl(event, query) {
  const url = new URL(getPublicFunctionUrl(event));

  url.searchParams.set('action', 'handler');

  if (process.env.HANDLER_SECRET) {
    url.searchParams.set('key', query?.key || process.env.HANDLER_SECRET);
  }

  return url.toString();
}

async function callBitrixMethod(payload, method, params) {
  const accessToken = getAccessToken(payload);
  const restEndpoint = getRestEndpoint(payload);

  if (!accessToken || !restEndpoint) {
    throw new Error('Missing Bitrix24 access token or REST endpoint');
  }

  const bitrixResponse = await fetch(`${restEndpoint}/${method}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      ...params,
      auth: accessToken,
    }),
  });

  const text = await bitrixResponse.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch (_error) {
    body = text;
  }

  if (!bitrixResponse.ok || body?.error) {
    const bitrixError = new Error(`${method} failed: ${bitrixResponse.status} ${JSON.stringify(body)}`);
    bitrixError.bitrixBody = body;
    throw bitrixError;
  }

  return body;
}

function buildTranslitRegistrationPayload(payload, handlerUrl, code, ruName) {
  return {
    CODE: code,
    HANDLER: handlerUrl,
    AUTH_USER_ID: getAuthUserId(payload),
    USE_SUBSCRIPTION: 'Y',
    NAME: {
      ru: ruName,
      en: 'RU to EN transliteration',
    },
    DESCRIPTION: {
      ru: 'Переводит строку с русского на латиницу по фонетическому правилу',
      en: 'Transliterates Russian text to Latin characters',
    },
    PROPERTIES: {
      inputString: {
        Name: {
          ru: 'Строка',
          en: 'Input string',
        },
        Description: {
          ru: 'Поле документа или конкатенация полей',
          en: 'Document field or field concatenation',
        },
        Type: 'string',
        Required: 'Y',
        Multiple: 'N',
        Default: '{=Document:TITLE}',
      },
    },
    RETURN_PROPERTIES: {
      outputString: {
        Name: {
          ru: 'Транслит',
          en: 'Transliteration',
        },
        Type: 'string',
        Multiple: 'N',
        Default: null,
      },
    },
    FILTER: {
      INCLUDE: ['b24'],
    },
  };
}

async function registerBizprocItem(payload, method, itemType, event, query) {
  const handlerUrl = buildHandlerUrl(event, query);

  try {
    const code = itemType === 'robot' ? 'ru_to_latin_translit_robot' : 'ru_to_latin_translit_activity';
    const ruName = itemType === 'robot' ? 'Транслитерация RU в EN' : 'Транслитерация RU -> EN';
    const result = await callBitrixMethod(
      payload,
      method,
      buildTranslitRegistrationPayload(payload, handlerUrl, code, ruName),
    );

    return {
      installed: true,
      type: itemType,
      alreadyInstalled: false,
      handlerUrl,
      result,
    };
  } catch (error) {
    if (String(error.bitrixBody?.error || '') === 'ERROR_ACTIVITY_ALREADY_INSTALLED') {
      return {
        installed: true,
        type: itemType,
        alreadyInstalled: true,
        handlerUrl,
      };
    }

    throw error;
  }
}

async function registerBitrix24Extensions(payload, event, query) {
  const [activity, robot] = await Promise.all([
    registerBizprocItem(payload, 'bizproc.activity.add', 'activity', event, query),
    registerBizprocItem(payload, 'bizproc.robot.add', 'robot', event, query),
  ]);

  return {
    installed: true,
    activity,
    robot,
    handlerUrl: robot.handlerUrl,
  };
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

  const bitrixResponse = await fetch(`${restEndpoint}/bizproc.event.send`, {
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

  const text = await bitrixResponse.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch (_error) {
    body = text;
  }

  if (!bitrixResponse.ok || body?.error) {
    throw new Error(`bizproc.event.send failed: ${bitrixResponse.status} ${JSON.stringify(body)}`);
  }

  return {
    skipped: false,
    status: bitrixResponse.status,
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
    const action = getAction(payload, query);

    if (action === 'install') {
      const installResult = await registerBitrix24Extensions(payload, event, query);

      return response(200, {
        ok: true,
        mode: 'install',
        ...installResult,
      });
    }

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
