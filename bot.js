const mineflayer = require('mineflayer');

function createBot() {
  const bot = mineflayer.createBot({
    host: 'testys.aternos.me', // замени на свой адрес
    port: 25565,
    username: 'MR_ttk', // или любой другой ник
    version: '1.21.1'
  });

  bot.on('spawn', () => {
    console.log('✅ Бот успешно вошёл на сервер!');

    // Прыгаем каждые 20 секунд, чтобы не быть AFK
    setInterval(() => {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }, 20000);
  });

  bot.on('end', () => {
    console.log('⛔ Бот отключён. Переподключаемся через 10 секунд...');
    setTimeout(createBot, 10000);
  });

  bot.on('error', err => {
    console.log('⚠️ Ошибка:', err.message);
  });
}

createBot();
