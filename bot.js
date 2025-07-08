const mineflayer = require('mineflayer');

function createBot() {
  const bot = mineflayer.createBot({
    host: 'testys.aternos.me', // ← замени на свой IP Aternos
    port: 44813, // обычно 25565
    username: 'Mr_afk', // ник для входа
    version: '1.21.1' // или та версия, на которой твой сервер
  });

  bot.on('spawn', () => {
    console.log('✅ Бот успешно вошёл на сервер!');

    // Каждые 20 секунд прыгает, чтобы не кикало по AFK
    setInterval(() => {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }, 20000);
  });

  bot.on('end', () => {
    console.log('⛔ Бот отключён. Переподключаюсь через 10 секунд...');
    setTimeout(createBot, 10000);
  });

  bot.on('error', err => {
    console.log('⚠️ Ошибка:', err.message);
  });
}

createBot();