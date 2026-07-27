# Bitrix24 RU -> EN Translit

Yandex Cloud Function for Bitrix24 cloud local application.

The app registers:

- automation robot: `Транслитерация RU в EN`
- workflow activity: `Транслитерация RU -> EN`

Both take an input string and return transliterated text. Whitespace is converted to `_`.

Example:

```text
Привет мир -> Privet_mir
```

## Yandex Cloud Function

Create or update a Yandex Cloud Function with:

- Runtime: Node.js 18 or newer
- Entry point: `index.handler`
- Public function: enabled
- Timeout: 5 seconds is enough
- Memory: 128 MB is enough

Paste or deploy `index.js`.

Set environment variables:

```text
HANDLER_SECRET=some-long-random-string
PUBLIC_FUNCTION_URL=https://functions.yandexcloud.net/d4e9c419gj4u8645govi
```

`HANDLER_SECRET` is your own simple shared secret. Use the same value in the Bitrix24 install URL.

`PUBLIC_FUNCTION_URL` must be the public Yandex Function URL without query parameters.

## Quick Function Test

Open this URL in a browser:

```text
https://functions.yandexcloud.net/d4e9c419gj4u8645govi?key=some-long-random-string&inputString=Привет мир
```

Expected response:

```json
{"ok":true,"mode":"test","input":"Привет мир","output":"Privet_mir"}
```

## Bitrix24 Local App Installation

Open Bitrix24:

```text
Приложения -> Разработчикам -> Другое -> Локальное приложение
```

Create a local app with these settings:

```text
Название: Транслитерация
Тип: Серверное приложение
Использует только API: Да
Права: Бизнес-процессы / bizproc
```

Set the initial installation path:

```text
https://functions.yandexcloud.net/d4e9c419gj4u8645govi?key=some-long-random-string&action=install
```

Save the app.

Bitrix24 will call the installation URL and pass temporary OAuth auth data. The function will register both the automation robot and the workflow activity.

You do not need to copy Bitrix24 `client_id`, `client_secret`, or `application_token` into Yandex Cloud for the current implementation.

## Registered Items

Automation robot:

```text
Name: Транслитерация RU в EN
Code: ru_to_latin_translit_robot
Method: bizproc.robot.add
```

Workflow activity:

```text
Name: Транслитерация RU -> EN
Code: ru_to_latin_translit_activity
Method: bizproc.activity.add
```

Both items use the same execution handler:

```text
https://functions.yandexcloud.net/d4e9c419gj4u8645govi?action=handler&key=some-long-random-string
```

## How To Use

In robot or workflow settings, fill `Строка` with a document field or a concatenation of fields.

Example:

```text
{=Document:TITLE} {=Document:UF_CRM_CUSTOM_FIELD}
```

Read the result from:

```text
Транслит / outputString
```

## Installation Check

Open Yandex Cloud Function logs after saving the Bitrix24 app.

Successful install log contains:

```json
{"message":"Bitrix24 install completed"}
```

If you open `action=install` directly in a browser, installation will not work because browser GET requests do not contain Bitrix24 OAuth auth data. The install URL must be called by Bitrix24 during local app installation.

## Troubleshooting

If install returns:

```text
Cannot determine public function URL. Set PUBLIC_FUNCTION_URL env variable.
```

Add `PUBLIC_FUNCTION_URL` in Yandex Cloud Function environment variables.

If install returns:

```text
Install must be called by Bitrix24 installation callback with OAuth auth data
```

The URL was opened directly in a browser. Save or reinstall the local app in Bitrix24 instead.

If robot or workflow activity is not visible, save or reinstall the local app again and check Yandex Cloud Function logs for errors from `bizproc.robot.add`, `bizproc.robot.update`, `bizproc.activity.add`, or `bizproc.activity.update`.

