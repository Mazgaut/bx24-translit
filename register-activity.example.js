'use strict';

/*
 * Run this in an installed Bitrix24 local application context.
 * Replace HANDLER_URL and DOCUMENT_TYPE before use.
 */

const HANDLER_URL = 'https://functions.yandexcloud.net/d4e9c419gj4u8645govi?key=some-long-random-string';

BX24.callMethod(
  'bizproc.activity.add',
  {
    CODE: 'ru_to_latin_translit',
    HANDLER: HANDLER_URL,
    AUTH_USER_ID: 1,
    USE_SUBSCRIPTION: 'Y',
    NAME: {
      ru: 'Транслитерация RU -> EN',
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
  },
  (result) => {
    if (result.error()) {
      console.error(result.error(), result.error_description());
      return;
    }

    console.log('Activity registered:', result.data());
  },
);

