const mineflayer = require('mineflayer');
const readline = require('readline');
const Vec3 = require('vec3');

let bot;
let reconnectTimeout = 3000; // 3e секунд между переподключениями
let farming = false;
let mining = false;
let miningLoopActive = false;
let loginTimeout = null;

// === Создание бота ===
function createBot() {
  // Очистка старого таймера логина, если был
  if (loginTimeout) clearTimeout(loginTimeout);

  bot = mineflayer.createBot({
    host: 'CLANVANILA.aternos.me', // IP сервера
    port: 44813,                   // порт
    username: 'Android',           // ник бота
    version: false,                // автоопределение версии
  });

  bot.on('login', () => console.log('✅ Бот вошёл на сервер!'));
  bot.on('spawn', () => console.log('🎮 Бот появился в мире!'));

  // === Авто логин ===
  bot.on('message', (jsonMsg) => {
    const msg = jsonMsg.toString();
    console.log(`🧩 Системное сообщение: ${msg}`);

    if (msg.includes('/login')) {
      loginTimeout = setTimeout(() => {
        if (bot && bot._client && typeof bot._client.chat === 'function') {
          bot.chat('/login laitglok');
          console.log('🔐 Отправлена команда /login');
        } else {
          console.log('⚠️ Бот не готов к отправке /login (переподключение?)');
        }
      }, 2000);
    }
  });


// === Функция логирования с временем и предполагаемым киком через 30 минут ===
function logWithKick(message, kickMinutes = 30) {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');

  const kickDate = new Date(now.getTime() + kickMinutes * 60000);
  const kickHours = kickDate.getHours().toString().padStart(2, '0');
  const kickMinutesStr = kickDate.getMinutes().toString().padStart(2, '0');

  console.log(`[${hours}:${minutes}] ${message} предполагаемый кик в ${kickHours}:${kickMinutesStr}`);
}

bot.on('spawn', () => logWithKick('Бот появился в мире!'));

    // === Автоматический сон, если кто-то лёг на кровать ===
  bot.on('message', async (jsonMsg) => {
    const msg = jsonMsg.toString().toLowerCase();

    if (msg.includes('players sleeping')) {
      console.log('💤 Обнаружено сообщение о сне — бот ищет кровать...');

      // Ищем ближайшую кровать
      const bed = bot.findBlock({
        matching: block => block.name.includes('bed'),
        maxDistance: 6
      });

      if (!bed) {
        console.log('⚠️ Кровать рядом не найдена.');
        return;
      }

      try {
        await bot.sleep(bed);
        console.log('😴 Бот лёг спать, чтобы скипнуть ночь!');
      } catch (err) {
        console.log('⚠️ Ошибка сна:', err.message);
      }
    }
  });

  // === Просыпаемся утром ===
  bot.on('time', async () => {
    if (bot.isSleeping && bot.time.timeOfDay < 1000) {
      try {
        await bot.wake();
        console.log('🌅 Утро наступило — бот проснулся!');
      } catch (err) {
        console.log('⚠️ Не удалось проснуться:', err.message);
      }
    }
  });


  // === Обработка отключений ===
bot.on('kicked', (reason, loggedIn) => {
  let reasonStr;

  if (typeof reason === 'string') {
    reasonStr = reason;
  } else if (reason && typeof reason === 'object') {
    // Обычно у объекта есть .text или .toString()
    reasonStr = JSON.stringify(reason);
  } else {
    reasonStr = String(reason);
  }

  console.log(`🚪 Бота кикнули: ${reasonStr}`);
  reconnect();
});

bot.on('end', () => {
  console.log('⛔ Соединение потеряно. Возможно timed out. Переподключаемся...');
  reconnect();
});

bot.on('error', (err) => {
  if (err.code === 'ECONNRESET') {
    console.log('⚠️ Сервер сбросил соединение (ECONNRESET). Переподключаемся...');
    reconnect();
  } else if (err.message && err.message.includes('timed out')) {
    console.log('⚠️ Соединение потеряно (timed out). Переподключаемся...');
    reconnect();
  } else if (err.name === 'PartialReadError') {
    // игнорируем
    return;
  } else {
    console.error('❌ Ошибка:', err);
  }
});

  // === Автофарм мобов ===
  setInterval(() => {
    if (!farming || !bot.entity) return;
    const mob = bot.nearestEntity(
      (e) => e.type === 'mob' && e.mobType !== 'Armor Stand' && e.mobType !== 'Item'
    );
    if (mob) {
      bot.lookAt(mob.position.offset(0, mob.height, 0))
        .then(() => bot.attack(mob))
        .catch(() => {});
    }
  }, 500);

  // === Автокопание ===
  async function startMiningLoop() {
    while (mining) {
      const block = bot.blockAtCursor(4);
      if (block && bot.canDigBlock(block)) {
        try {
          const pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'));
          if (pickaxe) {
            if (!bot.heldItem || bot.heldItem.name !== pickaxe.name) {
              await bot.equip(pickaxe, 'hand');
            }
          } else {
            console.log('⚠️ Кирка не найдена в инвентаре!');
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }

          await bot.dig(block, true); // копаем
        } catch (err) {
          // игнорируем ошибки копания
        }
      } else {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  setInterval(() => {
    if (mining && !miningLoopActive) {
      miningLoopActive = true;
      startMiningLoop().then(() => miningLoopActive = false);
    }
  }, 1000);

// === АНТИ-АФК (улучшенный) ===
setInterval(async () => {
  if (!bot.entity) return;

  try {
    // --- Случайное движение ---
    const actions = ['forward', 'back', 'left', 'right'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    bot.setControlState(action, true);
    setTimeout(() => bot.setControlState(action, false), 500);

    // --- Случайный прыжок ---
    if (Math.random() < 0.5) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 300);
    }

    // --- Случайный присед (shift) ---
    if (Math.random() < 0.5) {
      bot.setControlState('sneak', true);
      setTimeout(() => bot.setControlState('sneak', false), 2000);
      console.log('🛋️ Анти-АФК: бот сел на shift');
    }

    // --- Случайный клик по направлению курсора ---
    if (Math.random() < 0.5) {
      bot.swingArm('right');
      console.log('👋 Анти-АФК: бот кликнул левой кнопкой');
    }

    // --- Лёгкое движение головы ---
    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * 0.5;
    bot.look(yaw, pitch, false);

    console.log('🌀 Анти-АФК: бот слегка пошевелился');
  } catch (err) {
    console.log('⚠️ Ошибка анти-АФК:', err.message);
  }
}, 60 * 1000); // каждые 60 секунд
}

// === Переподключение ===
function reconnect() {
  if (bot) {
    try {
      bot.removeAllListeners();
      bot.quit();
    } catch {}
  }

  setTimeout(() => {
    console.log('🔁 Переподключаемся...');
    createBot();
  }, reconnectTimeout);
}

// === Ввод из консоли ===
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on('line', (input) => {
  if (!bot || !bot.player) {
    console.log('⚠️ Бот не подключен, сообщение не отправлено.');
    return;
  }

  if (input.startsWith('.')) {
    handleCommand(input);
  } else {
    if (bot && bot._client && typeof bot._client.chat === 'function') {
      bot.chat(input);
    } else {
      console.log('⚠️ Сообщение не отправлено: бот не готов.');
    }
  }
});

// === Обработка команд ===
function handleCommand(input) {
  switch (input) {
    case '.farm on':
      farming = true;
      console.log('⚔️ Автофарм включен!');
      break;
    case '.farm off':
      farming = false;
      console.log('🛑 Автофарм выключен!');
      break;
    case '.mine on':
      mining = true;
      console.log('⛏️ Автокопание включено!');
      break;
    case '.mine off':
      mining = false;
      console.log('🧱 Автокопание выключено!');
      break;
    case '.drop all':
      dropAllItems();
      break;
    default:
      console.log('❔ Неизвестная команда.');
  }
}

// === Выброс всех предметов ===
async function dropAllItems() {
  if (!bot || !bot.inventory) {
    console.log('⚠️ Инвентарь недоступен.');
    return;
  }

  const items = bot.inventory.items();
  if (items.length === 0) {
    console.log('📦 Инвентарь пуст.');
    return;
  }

  console.log(`🗑️ Выбрасываю ${items.length} предмет(ов)...`);
  for (const item of items) {
    try {
      await bot.tossStack(item);
      await new Promise(r => setTimeout(r, 150));
    } catch {
      console.log(`⚠️ Не удалось выбросить ${item.name}`);
    }
  }

  console.log('✅ Все предметы выброшены.');
}

// === Запуск ===
createBot();
