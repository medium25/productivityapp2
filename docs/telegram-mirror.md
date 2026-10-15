# Зеркалирование чатов в Telegram (двусторонее)

Любой чат-раздел приложения (Data/Insights/Analysis, все на
`createChatStore.js`) можно привязать к своему Telegram-каналу прямо в
**Настройках** приложения — выбрать раздел, вставить `chat_id`, сохранить.
Дальше работает в обе стороны:

- **Приложение → Telegram**: новое текстовое сообщение и фото в чате сразу
  появляется в привязанном канале. Удаление сообщения в приложении удаляет
  его и из канала.
- **Telegram → приложение**: сообщение, написанное человеком прямо в
  канале, подхватывается приложением (опрос раз в ~15 сек, пока открыт
  этот чат) и появляется как обычное сообщение.

Текст и фото дублируются в Telegram; войс/файлы — нет (хранятся только
локально в IndexedDB, никогда не попадают в Firestore/сеть). Фото тоже
хранится только локально — в Telegram уходит копия байтов, не ссылка.

Один бот, один Apps Script веб-апп на всё. Апдейты от самого бота (его же
мирорнутые сообщения) игнорируются — иначе было бы бесконечное эхо
(приложение → канал → приложение → канал → ...).

## Как это работает

1. **Настройки → [раздел] → Канал Telegram** → вставить `chat_id` →
   "Привязать". Привязка хранится в Firestore
   (`useTelegramLinksStore`, `{ [storageName]: chatId }`) и **сразу**
   отправляется в Apps Script — тот держит зеркальную reverse-карту
   `chat_id → storageName` в своих Script Properties, чтобы уметь понять,
   в какой чат приложения относится новый пост из канала.
2. Отправка сообщения (`createChatStore.js`, `notifyTelegram`) — POST
   `{ action: 'send', chatId, text }`, в ответ Apps Script возвращает
   `{ ok: true, messageId }`, который сохраняется в самом сообщении
   (`telegramMessageId` + `chatId`).
3. Удаление сообщения (`deleteMessage`) — если у него есть
   `telegramMessageId`, летит `{ action: 'delete', chatId, messageId }`.
4. Telegram присылает боту апдейты о новых постах в канале через
   **webhook** (см. настройку ниже) — прямо на тот же Apps Script URL.
   Apps Script складывает такие посты в очередь (отдельная Google Sheet,
   создаётся сама при первом сообщении).
5. Пока чат открыт в приложении, `useTelegramPoll.js` раз в ~15 сек дёргает
   Apps Script (`GET ?action=poll&storageName=...`), забирает новые
   сообщения из очереди и добавляет их в чат — без повторной отправки в
   Telegram (`addIncomingTelegramMessage`, не `addTextMessage`).

## 1. Создать бота

1. Открыть [@BotFather](https://t.me/BotFather) в Telegram.
2. `/newbot`, задать имя — получить токен вида `123456:ABC-...`.
3. Для каждого канала, который хочешь привязывать — добавить бота туда
   **администратором** с правами "Post messages" и "Delete messages".
4. Узнать `chat_id` канала:
   - публичный канал — `chat_id` это `@username_канала`;
   - приватный — переслать любое сообщение из канала боту
     [@userinfobot](https://t.me/userinfobot), либо дернуть
     `https://api.telegram.org/bot<TOKEN>/getUpdates` после того как в
     канале что-то напишут, и взять `chat.id` из ответа (вида
     `-100xxxxxxxxxx`).

## 2. Apps Script веб-апп

1. [script.google.com](https://script.google.com) → New project.
2. Вставить код ниже в `Code.gs`, заменив всё содержимое файла.
3. Project Settings → Script Properties → добавить `BOT_TOKEN` = токен
   бота. (`CHAT_TO_STORAGE` и `QUEUE_SHEET_ID` появятся сами — их
   создаёт и обновляет сам код, руками трогать не надо.)
4. Deploy → New deployment → тип **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Скопировать URL веб-аппа (`https://script.google.com/macros/s/.../exec`).
6. Включить webhook (один раз, в адресной строке браузера):
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEBAPP_URL>
   ```
   Ответ должен быть `{"ok":true,"result":true,...}`.

При каждой последующей правке кода — Deploy → **Manage deployments** →
карандаш у текущего деплоя → Version: **New version** → Deploy. Через
"New deployment" получится новый URL, тогда придётся заново прописывать
его в `.env.local`, пересобирать приложение и переустанавливать webhook.

```javascript
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  var data = JSON.parse(e.postData.contents);

  // Telegram webhook updates always carry update_id — app calls never do.
  if (data.update_id) {
    return handleTelegramUpdate(data);
  }
  if (data.action === 'delete') return handleDelete(token, data);
  if (data.action === 'link') return handleLinkChange(data, true);
  if (data.action === 'unlink') return handleLinkChange(data, false);
  if (data.action === 'sendPhoto') return handleSendPhoto(token, data);
  return handleSend(token, data);
}

function doGet(e) {
  if (!e || e.parameter.action !== 'poll' || !e.parameter.storageName) {
    return jsonOutput({ ok: false });
  }
  return jsonOutput({ ok: true, messages: drainQueue(e.parameter.storageName) });
}

// ---- app -> Telegram ----

function handleSend(token, data) {
  var text = (data.text || '').toString().slice(0, 4000);
  var chatId = (data.chatId || '').toString();
  if (!text || !chatId) return jsonOutput({ ok: false });

  var resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: { chat_id: chatId, text: text },
    muteHttpExceptions: true,
  });

  var result = JSON.parse(resp.getContentText());
  if (!result.ok) return jsonOutput({ ok: false });
  return jsonOutput({ ok: true, messageId: result.result.message_id });
}

// Photo messages have no public URL (media lives in the app's local
// IndexedDB, never uploaded anywhere) — the client base64-encodes the
// actual file and sends the bytes here instead (see notifyTelegramPhoto in
// createChatStore.js). Decoded back into a Blob and handed to Telegram's
// sendPhoto as a multipart field — UrlFetchApp encodes the request as
// multipart/form-data automatically whenever a payload value is a Blob.
function handleSendPhoto(token, data) {
  var chatId = (data.chatId || '').toString();
  var b64 = (data.photoBase64 || '').toString();
  if (!chatId || !b64) return jsonOutput({ ok: false });

  var bytes = Utilities.base64Decode(b64);
  var blob = Utilities.newBlob(bytes, data.mimeType || 'image/jpeg', 'photo');

  var resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendPhoto', {
    method: 'post',
    payload: { chat_id: chatId, photo: blob },
    muteHttpExceptions: true,
  });

  var result = JSON.parse(resp.getContentText());
  if (!result.ok) return jsonOutput({ ok: false });
  return jsonOutput({ ok: true, messageId: result.result.message_id });
}

function handleDelete(token, data) {
  var chatId = (data.chatId || '').toString();
  var messageId = data.messageId;
  if (!chatId || !messageId) return jsonOutput({ ok: false });

  UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/deleteMessage', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: { chat_id: chatId, message_id: messageId },
    muteHttpExceptions: true,
  });
  return jsonOutput({ ok: true });
}

// ---- link/unlink (keeps CHAT_TO_STORAGE in sync with the app's Settings) ----

function handleLinkChange(data, isLink) {
  var chatId = (data.chatId || '').toString();
  if (!chatId) return jsonOutput({ ok: false });

  var props = PropertiesService.getScriptProperties();
  var map = JSON.parse(props.getProperty('CHAT_TO_STORAGE') || '{}');
  if (isLink) map[chatId] = data.storageName;
  else delete map[chatId];
  props.setProperty('CHAT_TO_STORAGE', JSON.stringify(map));
  return jsonOutput({ ok: true });
}

// ---- Telegram -> app ----

function handleTelegramUpdate(update) {
  var post = update.channel_post;
  // Not a channel post (e.g. bot got added/removed, or a DM to the bot),
  // or no text (photo/sticker/etc — out of scope, see file header) — skip.
  if (!post || !post.text) return jsonOutput({ ok: true });
  // The bot's own mirrored sendMessage calls also arrive here as
  // channel_post updates — without this check every app message would
  // loop back in as a new "incoming" one forever.
  if (post.from && post.from.is_bot) return jsonOutput({ ok: true });

  var props = PropertiesService.getScriptProperties();
  var map = JSON.parse(props.getProperty('CHAT_TO_STORAGE') || '{}');
  var storageName = map[String(post.chat.id)];
  if (!storageName) return jsonOutput({ ok: true }); // channel not linked to anything right now

  getQueueSheet().appendRow([new Date().toISOString(), storageName, post.message_id, post.text]);
  return jsonOutput({ ok: true });
}

// Returns and removes every queued message for storageName — each poll
// consumes what it reads, so a message is delivered to the app at most
// once (if the app's fetch fails after this runs, that message is lost;
// acceptable for a personal low-volume mirror, not a guaranteed-delivery
// queue).
function drainQueue(storageName) {
  var sheet = getQueueSheet();
  var values = sheet.getDataRange().getValues();
  var messages = [];
  var rowsToDelete = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i][1] === storageName) {
      messages.push({ telegramMessageId: values[i][2], text: values[i][3] });
      rowsToDelete.push(i + 1); // sheet rows are 1-indexed
    }
  }
  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }
  return messages;
}

function getQueueSheet() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('QUEUE_SHEET_ID');
  var ss = null;
  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (err) {
      ss = null; // sheet got deleted/moved — recreate below
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('Telegram mirror queue');
    props.setProperty('QUEUE_SHEET_ID', ss.getId());
    ss.getSheets()[0].appendRow(['timestamp', 'storageName', 'telegramMessageId', 'text']);
  }
  return ss.getSheets()[0];
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

Важно: клиент шлёт свои запросы с `Content-Type: text/plain` (см.
`createChatStore.js`/`useTelegramLinksStore.js`), не `application/json` —
иначе браузер шлёт CORS preflight (OPTIONS), а Apps Script веб-апп на него
нормально не отвечает, и запрос молча падает. `doPost` всё равно получает
валидный JSON в `e.postData.contents`, просто заголовок другой. Апдейты от
Telegram (webhook) и `doGet`-опрос из приложения — обычные
сервер-сервер/simple-GET запросы, CORS preflight их не касается.

## 3. Подключить в приложении

В `.env.local` — один URL на всё:

```
VITE_TG_NOTIFY_URL=https://script.google.com/macros/s/.../exec
```

Пересобрать/перезапустить dev-сервер (или пересобрать desktop-приложение,
если пользуешься им — см. `npm run tauri:build`) после правки
`.env.local`. Пустое значение — вся телеграм-интеграция выключена,
ничего не ломается.

## 4. Привязать канал к чату

В приложении: **Настройки → Настройки разделов → [Data/Insights/Analysis]
→ Канал Telegram** — вставить `chat_id`/`@username`, "Привязать". Это же
действие обновляет reverse-map в Apps Script — больше ничего руками
делать не нужно. Кнопка "Отвязать" снимает привязку в обе стороны.

Только эти три раздела — чат-фиды на `createChatStore.js`:
Data (`productivity-hub-reference-info`), Insights
(`productivity-hub-insights`), Analysis/Principles
(`productivity-hub-principles`).

## Известные ограничения

- Не пуш, а опрос раз в ~15 сек, и только пока сам чат открыт в
  приложении — сообщение из канала, написанное когда приложение закрыто,
  подхватится при следующем открытии этого чата (Apps Script хранит его в
  очереди сколько угодно, не теряется).
- Очередь (Google Sheet "Telegram mirror queue") — read-once: если ответ
  `doGet` не долетит до приложения (сеть оборвалась в момент опроса),
  прочитанные-но-недоставленные строки уже удалены и теряются. Для личного
  малообъёмного зеркала это приемлемо, для гарантированной доставки нужна
  была бы другая схема (подтверждение от клиента перед удалением строки).
- Фото зеркалируется только в одну сторону (приложение → Telegram), не
  обратно — фото, отправленное прямо в канале, приложением не подхватится
  (`handleTelegramUpdate` смотрит только `post.text`). Войс/файлы не
  зеркалируются вообще, ни в одну сторону.

## Где смотреть код

- Стор привязок + синхронизация с Apps Script: `src/store/useTelegramLinksStore.js`
- UI привязки: `src/features/telegram/TelegramLinkSetting.jsx`
  (подключён в `src/pages/SettingsPage.jsx`)
- Отправка/удаление в Telegram: `notifyTelegram` / `notifyTelegramPhoto` /
  `deleteFromTelegram` в `src/store/createChatStore.js`
- Приём из Telegram: `addIncomingTelegramMessage` в
  `src/store/createChatStore.js`, опрашивается из
  `src/features/telegram/useTelegramPoll.js` (подключён в
  `ReferenceInfoPage.jsx`, `InsightsPage.jsx`, `PrinciplesPage.jsx`)
