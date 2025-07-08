const mineflayer = require('mineflayer');

function createBot() {
  const bot = mineflayer.createBot({
    host: 'testys.aternos.me',
    port: 44813,
    username: 'mr_aft',
    version: '1.21.1',
    plugins: {
      chat: null // отключаем встроенный обработчик чата
    }
  });

  bot.on('spawn', () => {
    console.log('✅ Бот успешно вошёл на сервер!');

    setInterval(() => {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }, 20000);
  });

  bot.on('death', () => {
    console.log('💀 Бот умер, возрождаюсь...');
    setTimeout(() => {
      try {
        bot.pressButton(0); // имитируем нажатие кнопки "Respawn"
      } catch (err) {
        console.log('Ошибка при возрождении:', err.message);
      }
    }, 3000);
  });

  bot.on('end', () => {
    console.log('⛔ Бот отключён. Переподключаемся через 10 секунд...');
    setTimeout(createBot, 10000);
  });

  bot.on('error', err => {
    console.log('⚠️ Ошибка:', err.message);
  });
}

// Глобальный ловец ошибок для игнорирования ошибки парсинга чата
process.on('uncaughtException', function (err) {
  if (err.message && err.message.includes('unknown chat format code')) {
    console.log('Игнорируем ошибку парсинга чата:', err.message);
  } else {
    console.error('Неизвестная ошибка:', err);
  }
});

createBot();
