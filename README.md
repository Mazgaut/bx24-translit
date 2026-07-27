# Bitrix24 Bizproc Translit Function

Minimal Yandex Cloud Function for a Bitrix24 workflow activity that transliterates Russian text to Latin characters.

## Files

- `index.js` - function handler for Yandex Cloud Functions.
- `register-activity.example.js` - example payload for registering the workflow activity with `bizproc.activity.add`.

## Yandex Cloud Function

Create a Node.js function and paste `index.js`.

Recommended settings:

- Runtime: Node.js 18 or newer.
- Entry point: `index.handler`.
- Public function: enabled.
- Timeout: 5 seconds is enough.
- Memory: 128 MB is enough.

Set environment variables:

```text
HANDLER_SECRET=some-long-random-string
```

Your handler URL will look like this:

```text
https://functions.yandexcloud.net/d4e9c419gj4u8645govi?key=some-long-random-string
```

Use that URL as `HANDLER` when registering the Bitrix24 action.

## Bitrix24 Workflow Action

The action should have:

- one input property: `inputString`
- one return property: `outputString`
- `USE_SUBSCRIPTION: Y`

In the workflow designer, pass a document field or a concatenation of fields into `inputString`.

Example:

```text
{=Document:TITLE} {=Document:UF_CRM_CUSTOM_FIELD}
```

The function returns the result through `bizproc.event.send`, using the `event_token` received from Bitrix24.

## Quick HTTP Test

After deployment, this should return transliteration without calling Bitrix24:

```text
https://functions.yandexcloud.net/d4e9c419gj4u8645govi?key=some-long-random-string&inputString=Привет мир
```

Expected body:

```json
{"ok":true,"mode":"test","input":"Привет мир","output":"Privet mir"}
```

