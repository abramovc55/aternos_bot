const mineflayer = require('mineflayer');
const readline = require('readline');

let bot;
let reconnectTimeout = 10000; // 10 секунд между переподключениями

function createBot() {
  bot = mineflayer.createBot({
    host: 'CLANVANILA.aternos.me', // IP сервера (исправил .mes -> .me)
    port: 44813, // порт сервера
    username: 'Android', // ник бота
    version: false, // автоопределение версии
  });

  // когда бот зашёл
  bot.on('login', () => {
    console.log('✅ Бот вошёл на сервер!');
  });

  // чат от игроков
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    console.log(`💬 ${username}: ${message}`);
  });

  // системные сообщения (вход, кик, логин и т.п.)
  bot.on('message', (jsonMsg) => {
    const text = jsonMsg.toString();
    console.log(`🧩 Системное сообщение: ${text}`);

    // авто /login или /register
    if (text.toLowerCase().includes('/login')) {
      setTimeout(() => bot.chat('/login laitglok'), 5000);
    } else if (text.toLowerCase().includes('/register')) {
      setTimeout(() => bot.chat('/register laitglok laitglok'), 1000);
    }



  // === простые ответы на ключевые слова ===
  if (text.includes('я ем')) {
    setTimeout(() => {}, 10000);
    bot.chat(' пенисы на завтрак');
  } else if (text.includes('привет')) {
    bot.chat('Привет! 😄');
  } else if (text.includes('пока')) {
    bot.chat('До встречи 👋');
  }

  });

  bot.on('kicked', (reason) => {
    console.log(`🚪 Бота кикнули: ${reason}`);
    reconnect();
  });

  bot.on('end', () => {
    console.log('⛔ Соединение потеряно. Переподключаемся...');
    reconnect();
  });

  bot.on('error', (err) => {
    if (err.code === 'ECONNRESET') {
      console.log('⚠️ Сервер сбросил соединение (ECONNRESET). Переподключаемся...');
      reconnect();
    } else {
      console.error('❌ Ошибка:', err);
    }
  });
}

// ======= Переподключение =======
function reconnect() {
  setTimeout(() => {
    console.log('🔁 Переподключаемся...');
    createBot();
  }, reconnectTimeout);
}

// ======= Отправка сообщений из консоли =======
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  if (bot && bot.player) {
    bot.chat(input);
  } else {
    console.log('⚠️ Бот не подключен, сообщение не отправлено.');
  }
});

// ======= Запуск =======
createBot();
