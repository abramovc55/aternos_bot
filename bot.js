const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const readline = require('readline');
const crypto = require('crypto');
const os = require('os');
const { Client, GatewayIntentBits, WebhookClient } = require('discord.js');

const TOKEN = 'MTM0NDMzNzk0NzczMzkyMTgyMw.GmXSHH.DUypmOg7I9aoj-E9RBKBzrCEAXkTvEhNkYzUHk';
const CHANNEL_ID = '1382426537567191200';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1408817015463874731/BAOD-rVN5NDKgMWPmOJ12KEOElI27Da5DTMlH5gH0QdIgbqW5hriEgvP_AOCPUnrO2QJ';
const webhookClient = new WebhookClient({ url: WEBHOOK_URL });

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

function getDeviceId() {
  const raw = os.userInfo().username + os.hostname();
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

async function checkPassword(password) {
  return new Promise(async (resolve, reject) => {
    try {
      await discordClient.login(TOKEN);
      discordClient.once('ready', async () => {
        try {
          const channel = await discordClient.channels.fetch(CHANNEL_ID);
          if (!channel) return reject('Канал не найден');

          let found = false;
          let lastMessageId = null;

          while (!found) {
            const options = { limit: 100 };
            if (lastMessageId) options.before = lastMessageId;

            const messages = await channel.messages.fetch(options);
            if (messages.size === 0) break;

            for (const msg of messages.values()) {
              if (msg.content.startsWith('.reg ')) {
                const registeredPassword = msg.content.slice(5).trim();
                if (registeredPassword === password) {
                  found = true;
                  break;
                }
              }
            }

            lastMessageId = messages.last().id;
          }

          const deviceId = getDeviceId();
          const pcUsername = os.userInfo().username;
          const now = new Date().toLocaleString('ru-RU');

          await channel.send(
            `**🔐 Попытка входа**\n` +
            `📅 Дата: \`${now}\`\n` +
            `👤 Имя Пользователя: \`${pcUsername}\`\n` +
            `🆔 Устройство: \`${deviceId}\`\n` +
            `Статус: ${found ? '✅ Доступ разрешён' : '❌ Неверный пароль'}`
          );

          discordClient.destroy();
          resolve(found);
        } catch (err) {
          discordClient.destroy();
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function sendBotBalance(bot) {
  return new Promise(resolve => {
    const listener = (message) => {
      const text = message.toString();
      if (text.includes('Баланс: $')) {
        const match = text.match(/Баланс: \$([\d,\.]+)/);
        if (match) {
          const money = match[1];
          // Отправка в существующий вебхук
          webhookClient.send(`🤑 Баланс бота **${bot.username}**: $${money}`).catch(console.error);
          bot.removeListener('message', listener);
          resolve(money);
        }
      }
    };

    bot.on('message', listener);
    bot.chat('/money'); // отправляем команду на сервер
  });
}

const bots = [];
let intervalId = null;
let chatEnabled = true;
let monitorBlockEnabled = false;
const connectedToHub = new Set(); // сюда добавляются имена ботов, которые зашли

function readBotsMapping() {
  const filePath = path.resolve(__dirname, 'bots.txt');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const map = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [nick, id] = trimmed.split('=');
      if (nick && id) map[nick.trim()] = id.trim();
    }
    return map;
  } catch (e) {
    console.log('⚠️ Не удалось прочитать bots.txt. Запуск без ID.');
    return {};
  }
}

const botsMapping = readBotsMapping();

function getUsernamesByIDs(ids) {
  return Object.entries(botsMapping)
    .filter(([nick, id]) => ids.includes(id))
    .map(([nick]) => nick);
}
/*
// хз под что переделат должен быть отслеживател ьчата
const originalLog = console.log;
console.log = (...args) => {
  args.forEach(arg => {
    if (typeof arg === 'string' && arg.includes('▣')) {
      originalLog('⚠️ Найдено начальное GUI в консоли!');
    }
  });
  originalLog(...args);
};
*/

function autoUseGUI20(bot) {
  if (bot.autoCheckInterval) return; // чтобы не создавать несколько интервалов

  bot.autoCheckInterval = setInterval(async () => {
    if (!bot.autoCheckEnabled) return;

    let count = 0;

    // 1️⃣ Считаем порох в обычном инвентаре
    if (bot.inventory) {
      bot.inventory.items().forEach(item => {
        if (item.name === 'gunpowder') count += item.count;
      });
    }

    // 2️⃣ Если открыто GUI — считаем порох там тоже
    if (bot.currentWindow) {
      bot.currentWindow.slots.forEach(slot => {
        if (slot && slot.name === 'gunpowder') count += slot.count;
      });
    }

    // Если порох заполнен >= 27 слотов (1728)
    if (count >= 27 * 64) {
      const now = Date.now();
      if (!bot.lastCommandTime || now - bot.lastCommandTime >= 500) {
        bot.lastCommandTime = now;

        // Кликаем по слоту 20 даже если GUI открыто
        if (bot.currentWindow) {
          await bot.commandsHandler('!usegui 20').catch(() => {});
          console.log(`[${bot.username}] Авто !usegui 20 выполнена (GUI открыто)`);
        } else {
          // Если GUI закрыто — открываем и кликаем
          await bot.commandsHandler('!usegui 20').catch(() => {});
          console.log(`[${bot.username}] Авто !usegui 20 выполнена (GUI закрыто)`);
        }
      }
    }
  }, 5000);
}

// Сохраняем оригинальные функции
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

// Перехватываем вывод
process.stdout.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string' && chunk.includes('Ignoring block entities')) {
    return true; // просто игнорируем
  }
  return originalStdoutWrite(chunk, encoding, callback);
};

process.stderr.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string' && chunk.includes('Ignoring block entities')) {
    return true; // просто игнорируем
  }
  return originalStderrWrite(chunk, encoding, callback);
};

// ===== Чтение настроек =====
let settings = {};
if (fs.existsSync('settings.txt')) {
  const lines = fs.readFileSync('settings.txt', 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes('=')) continue;
    const [key, value] = line.split('=');
    settings[key.trim().toUpperCase()] = value.trim();
  }
}

// ===== Константы из settings.txt =====
const host = settings.HOST;
const port = settings.PORT ? parseInt(settings.PORT) : undefined;
const version = settings.VERSION;
let targetMob = settings.TARGET_MOB;

function createBot(username) {
  const bot = mineflayer.createBot({
    host,
    port,
    username,
    version,
    profilesFolder: './profiles',
    skinParts: false
  });

bot._username = username;

  // ===== Автоклик !usegui 20 =====
let autoCheckEnabled = false;
let autoCheckInterval = null;

  bot.on('login', () => {
  console.log(`✅ ${bot._username} подключился`);
  bot.isDisconnected = false;
});
  bot.on('kick', () => {
  console.log(`⛔ ${bot._username} отключён`);
  bot.isDisconnected = true; // помечаем бот как отключённого
});
  const guiMap = {
  "§fꈁꀀꈂꌁꈂꀁ§0ꈃꄀ": "начальное GUI",
  "§fꈁꀀꈂꍄꈂꀁ§0ꈃꄠ": "другое GUI", 
};

bot.on('windowOpen', window => {
  const titleText = window.title.raw; // берём только raw
  const guiName = guiMap[titleText] || titleText; // если не нашли в guiMap — оставляем оригинал

  console.log(`[${bot.username}] Открыто окно: ${guiName}`);
});

bot.isDisconnected = false; // при создании бота

bot.on('end', () => {
  console.log(`⛔ ${bot._username} отключён`);
  bot.isDisconnected = true; // помечаем бот как отключённого
});

  bot.on('error', err => {
    if (err.message && err.message.includes("Server didn't respond to transaction")) return;
    console.log(`❌ Ошибка ${username}:`, err);
  });
// --- Новый вебхук для сообщений с "Ваша цель" ---
const CONTRACT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1420347908321968148/maguwC7z9SXhPxxhPejshW3zcO8RLoGT2kJp_HrqFoJPl2_AAy2w5MmmF2Y8HoZdeOFO';
const contractWebhook = new WebhookClient({ url: CONTRACT_WEBHOOK_URL });

// Перехват всех сообщений
bot.on('message', message => {
  const rawText = message.toString(); // без цветов
  if (!chatEnabled && rawText.includes('▣')) return; // игнорируем сообщения с ▣ при выключенном чате

  const text = message.toAnsi(); // превращаем в цветной текст
  console.log(`[${username}] ${text}`);

    // --- Игнор сообщений с символом ▣, если чат отключен ---
  if (!chatEnabled && text.includes('▣')) return;
});

  bot._client.on('resource_pack_send', packet => {
    console.log(`[${username}] 📦 Ресурспак: ${packet.url}`);
    bot._client.write('resource_pack_receive', { result: 0, hash: packet.hash });
  });


  bot.on('message', async message => {
  const text = message.toString();

  // Проверяем фразу, которая появляется при входе в хаб
  if (/Intensive server activity has been HALTED/i.test(text)) {
    if (!connectedToHub.has(bot.username)) {
      connectedToHub.add(bot.username);
      console.log(`[${bot.username}] ✅ Подключился к хабу`);
    }

    // Если все боты уже в хабе и сообщение ещё не выводилось
    if (connectedToHub.size === bots.length) {
      await new Promise(r => setTimeout(r, 3500));
      console.log(`✅ Все ${bots.length} ботов успешно подключились к хабу!`);
      connectedToHub.clear();
    }
  }
});


// блок под ботом 
function monitorBlockBelow(bot) {
  if (bot._monitoringBlock) return;
  bot._monitoringBlock = true;

  setInterval(() => {
    if (!bot.entity) return;

    if (!monitorBlockEnabled) return; // проверка глобальной переменной

    const block = bot.blockAt(bot.entity.position.offset(0, -1, 0));
    if (block) {
      console.log(`[${bot.username}] Под ботом находится: ${block.name} (ID: ${block.type})`);
      if (block.name === 'lava') console.log(`[${bot.username}] ⚠ Осторожно! Лава под ботом!`);
      else if (block.name === 'water') console.log(`[${bot.username}] 💧 Бот стоит в воде`);
    } else {
      console.log(`[${bot.username}] Блок под ботом не найден`);
    }
  }, 10000);
}


// Использование после создания бота
bot.on('login', () => {
  monitorBlockBelow(bot);
});


// проверка на лимит
const limitReachedSet = new Set(); // здесь будем хранить ботов, которые уже сообщили

bot.on('message', message => {
  const text = message.toString(); // текст сообщения без цветов

  // Проверяем, содержит ли сообщение фразу "достигнут лимит" или "0/2000" и т.д.
  if (/достигнут лимит|0\/\d+/i.test(text)) {
    if (!limitReachedSet.has(bot.username)) {
      limitReachedSet.add(bot.username);
      console.log(`[${bot.username}] ⚠ Достигнут лимит!`);

      // Отправка в Discord
      webhookClient.send(`⚠ Бот **${bot.username}** достиг лимита сдачи предметов!`).catch(console.error);
    }
  }
});

  let lastUsedSlotTime = 0;

  async function safeClickGUI(slotIndex) {
    const now = Date.now();
    if (now - lastUsedSlotTime < 300) return;
    lastUsedSlotTime = now;

    if (!bot.currentWindow) {
      console.log(`[${username}] ⚠️ Окно GUI не открыто.`);
      return;
    }

    const item = bot.currentWindow.slots[slotIndex];
    if (!item) {
      console.log(`[${username}] ⚠️ В слоте ${slotIndex} нет предмета.`);
      return;
    }

    try {
      await bot.clickWindow(slotIndex, 0, 0, { skipTransaction: true });
    } catch (e) {
      if (!e.message.includes("Server didn't respond to transaction")) {
        console.log(`[${username}] ⚠️ Ошибка при клике: ${e.message}`);
      }
    }
  }

  async function clickWorkbench() {
    if (!bot.currentWindow) return;
    const slotIndex = bot.currentWindow.slots.findIndex(slot => slot && slot.name === 'crafting_table');
    if (slotIndex !== -1) await safeClickGUI(slotIndex);
  }

  async function clickGriefMenu() {
    if (!bot.currentWindow) return;
    const slotIndex = bot.currentWindow.slots.findIndex(slot => slot && slot.name === 'player_head');
    if (slotIndex !== -1) await safeClickGUI(slotIndex);
  }

  async function clickGriefByCount(count) {
    if (!bot.currentWindow) return;
    const slotIndex = bot.currentWindow.slots.findIndex(slot =>
      slot && slot.name === 'player_head' && slot.count === count
    );
    if (slotIndex !== -1) await safeClickGUI(slotIndex);
  }

  function useHotbar(slotNum) {
    const hotbarItem = bot.inventory.slots[36 + slotNum];
    if (!hotbarItem) {
      console.log(`[${username}] ⚠️ Предмет в хотбаре в слоте ${slotNum} не найден.`);
      return;
    }
    bot.setQuickBarSlot(slotNum);
    bot.activateItem();
  }

  async function griefSequence(griefNumber) {
    try {
      useHotbar(0);
      await new Promise(r => setTimeout(r, 300));
      await bot.commandsHandler('!useworkbench');
      await new Promise(r => setTimeout(r, 300));
      await bot.commandsHandler(`!usegrief ${griefNumber}`);
    } catch (e) {
      console.log(`[${username}] Ошибка в griefSequence: ${e.message}`);
    }
  }

  const colorsMap = {
    black: '\x1b[30m', dark_blue: '\x1b[34m', dark_green: '\x1b[32m', dark_aqua: '\x1b[36m',
    dark_red: '\x1b[31m', dark_purple: '\x1b[35m', gold: '\x1b[33m', gray: '\x1b[37m',
    dark_gray: '\x1b[90m', blue: '\x1b[94m', green: '\x1b[92m', aqua: '\x1b[96m',
    red: '\x1b[91m', light_purple: '\x1b[95m', yellow: '\x1b[93m', white: '\x1b[97m',
    reset: '\x1b[0m'
  };

  function extractTextWithColor(component) {
    if (typeof component === 'string') return component;
    let result = '';
    const colorCode = component.color ? (colorsMap[component.color.toLowerCase()] || '') : '';
    if (component.text) result += colorCode + component.text + colorsMap.reset;
    if (Array.isArray(component.extra)) for (const extra of component.extra) result += extractTextWithColor(extra);
    return result;
  }

  let hitInterval = null;

  function startAutoAttack() {
    if (hitInterval) return;
    hitInterval = setInterval(() => {
      const entity = bot.nearestEntity(e => e.name === targetMob && bot.entity.position.distanceTo(e.position) <= 3.2);
      if (entity) try { bot.attack(entity); } catch (e) { console.log(`[${username}] ⚠️ Ошибка атаки: ${e.message}`); }
    }, 900);
    console.log(`[${username}] 🔫 Автоатака включена`);
  }

  function stopAutoAttack() {
    if (hitInterval) { clearInterval(hitInterval); hitInterval = null; console.log(`[${username}] 🛑 Автоатака выключена`); }
  }

  async function dropAllItems(bot, delay = 300) {
    for (let i = 0; i < bot.inventory.slots.length; i++) {
      const item = bot.inventory.slots[i];
      if (item) {
        try {
          await bot.tossStack(item);
          await new Promise(r => setTimeout(r, delay));
        } catch (e) {
          console.log(`[${bot.username}] ⚠️ Ошибка при выкидывании: ${e.message}`);
        }
      }
    }
    console.log(`[${bot.username}] 🗑️ Инвентарь очищен`);
  }

  let guardEnabled = false;
  let guardInterval = null;

  function startGuard() {
    if (guardInterval) return;
    guardEnabled = true;
    console.log(`[${username}] 🛡️ Режим охраны включён`);
    guardInterval = setInterval(() => {
      const nearbyPlayers = Object.values(bot.entities).filter(entity =>
        entity.type === 'player' &&
        entity.username !== bot.username &&
        bot.entity.position.distanceTo(entity.position) <= 20
      );
      if (nearbyPlayers.length > 0) {
        console.log(`[${username}] ⚠ Рядом игроки: ${nearbyPlayers.map(p => p.username).join(', ')}`);
        sendNearbyPlayers(bot);
      }
    }, 3000);
  }

  function stopGuard() {
    if (guardInterval) {
      clearInterval(guardInterval);
      guardInterval = null;
      guardEnabled = false;
      console.log(`[${username}] 🛡️ Режим охраны выключен`);
    }
  }

  

  // ------------------ Новая функция крафта снежков ------------------
  const mcData = require('minecraft-data')(bot.version);

async function craftSnowBlocks() {
  try {
    const snowballId = mcData.itemsByName.snowball.id;
    const snowBlockId = mcData.itemsByName.snow_block.id;

    let snowballCount = bot.inventory.count(snowballId);
    if (snowballCount < 4) {
      console.log(`[${bot.username}] ❌ Недостаточно снежков для крафта`);
      return;
    }

    console.log(`[${bot.username}] 🧊 Начинаю ручной крафт снежных блоков...`);

    const craftSlots = [1, 2, 3, 4]; // сетка 2x2
    const resultSlot = 0; // слот результата

    // --- ищем первый пустой слот ---
    const getFirstEmptySlot = () => {
      for (let i = 9; i < 45; i++) {
        if (!bot.inventory.slots[i]) return i;
      }
      return null;
    };

    // --- ищем слот, куда можно доложить снежные блоки ---
    const getStackableSlot = (itemId) => {
      for (let i = 9; i < 45; i++) {
        const item = bot.inventory.slots[i];
        if (item && item.type === itemId && item.count < item.stackSize) {
          return i;
        }
      }
      return null;
    };

    while (snowballCount >= 4) {
      const snowballs = bot.inventory.slots.filter(i => i && i.type === snowballId);
      if (snowballs.length < 4) break;

      // выкладываем снежки в сетку
      for (let i = 0; i < 4; i++) {
        await bot.clickWindow(snowballs[i].slot, 0, 0);
        await bot.clickWindow(craftSlots[i], 0, 0);
        await bot.waitForTicks(2);
      }

      await bot.waitForTicks(5);

      // определяем, куда положить готовый блок
      const stackSlot = getStackableSlot(snowBlockId);
      const emptySlot = getFirstEmptySlot();

      if (stackSlot === null && emptySlot === null) {
        console.log(`[${bot.username}] ❌ Нет места для снежных блоков`);
        break;
      }

      const targetSlot = stackSlot ?? emptySlot;

      await bot.clickWindow(resultSlot, 0, 1); // взять блок
      await bot.clickWindow(targetSlot, 0, 0); // положить в стак или пустой слот
      await bot.waitForTicks(5);

      // очищаем сетку
      for (const slot of craftSlots) {
        const item = bot.inventory.slots[slot];
        if (item) {
          const freeSlot = getFirstEmptySlot();
          if (freeSlot === null) {
            console.log(`[${bot.username}] ❌ Инвентарь переполнен, останавливаю крафт`);
            return;
          }
          await bot.clickWindow(slot, 0, 0);
          await bot.clickWindow(freeSlot, 0, 0);
        }
      }

      snowballCount = bot.inventory.count(snowballId);
      console.log(`[${bot.username}] ✅ Скрафтил снежный блок (${snowballCount} снежков осталось)`);

      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[${bot.username}] 🧊 Крафт снежных блоков завершён`);
  } catch (err) {
    console.log(`[${bot.username}] ⚠️ Ошибка при крафте снежных блоков: ${err.message}`);
  }
}

  bot.commandsHandler = async function(input) {
    const args = input.trim().split(' ');
    const command = args[0];

    if (command.startsWith('/')) bot.chat(input.trim());
    else if (command === '!gui') {
      if (bot.currentWindow) {
        console.log(`\n[${username}] Окно: ${JSON.stringify(bot.currentWindow.title)}`);
        bot.currentWindow.slots.forEach((slot, i) => { if (slot) console.log(`  Слот ${i}: ${slot.name} x${slot.count}`); });
      } else console.log(`[${username}] ⚠️ Окно GUI не открыто.`);
    }
    else if (command === '!dropall') await dropAllItems(bot);
    else if (command === '!chattoggle' && bot.username === bots[0].username) {
  chatEnabled = !chatEnabled;
  const state = chatEnabled ? 'включён' : 'выключен';
  console.log(`💬 Чат теперь ${state} для всех ботов (${bots.length})`);
  
  bots.forEach(b => {
    b.chatEnabled = chatEnabled;
  });
}
    else if (command === '!balance') {
    try {
      const money = await sendBotBalance(bot);
    } catch (err) {
      console.log(`[${bot.username}] ⚠️ Не удалось получить баланс: ${err.message}`);
    }
  }

    else if (command === '!tooltip') {
      const slotIndex = parseInt(args[1]);
      if (!bot.currentWindow) return console.log(`[${username}] ⚠️ GUI не открыт.`);
      if (isNaN(slotIndex)) return console.log(`[${username}] ⚠️ Укажи слот: !tooltip <номер_слота>`);
      const item = bot.currentWindow.slots[slotIndex];
      if (!item) return console.log(`[${username}] ⚠️ В слоте ${slotIndex} нет предмета.`);
      if (item.nbt?.value?.display?.value?.Lore) {
        const loreList = item.nbt.value.display.value.Lore.value.value;
        const foundLore = loreList.find(loreLine => {
          try { const json = JSON.parse(loreLine); return extractTextWithColor(json).includes('Лимит продаж'); }
          catch { return loreLine.includes('Лимит продаж'); }
        });
        if (foundLore) {
          try { const json = JSON.parse(foundLore); console.log(`[${username}] ${extractTextWithColor(json)}`); }
          catch { console.log(`[${username}] ${foundLore}`); }
        } else { console.log(`[${username}] ❌ В лоре нет строки с 'Лимит продаж'.`); }
      } else { console.log(`[${username}] ❌ У предмета нет lore.`); }
    }
    else if (command === '!usegui') { const slotIndex = parseInt(args[1]); if (!isNaN(slotIndex)) await safeClickGUI(slotIndex); }
    else if (command === '!useworkbench') await clickWorkbench();
    else if (command === '!usegrief') { const griefCount = parseInt(args[1]); if (!isNaN(griefCount)) await clickGriefByCount(griefCount); }
    else if (command === '!usehotbar') { const hotbarSlot = parseInt(args[1]); if (!isNaN(hotbarSlot)) useHotbar(hotbarSlot); }
    else if (command === '!leave') bot.quit();
    else if (command === '!usegriefmenu') await clickGriefMenu();
    else if (command === '!grief') { const griefNumber = parseInt(args[1]); if (!isNaN(griefNumber)) await griefSequence(griefNumber); }
    else if (command === '!hiton') startAutoAttack();
    else if (command === '!close') {
  if (bot.currentWindow) {
    try {
      bot.closeWindow(bot.currentWindow); // закрываем текущее окно
      console.log(`[${username}] 🪟 Окно GUI закрыто`);
    } catch (e) {
      console.log(`[${username}] ❌ Ошибка при закрытии окна: ${e.message}`);
    }
  } else {
    console.log(`[${username}] ⚠️ Окно GUI не открыто`);
  }
}
    else if (command === '!hitoff') stopAutoAttack();
    else if (command === '!guard') {
      const arg = args[1];
      if (arg === 'on') { if (!guardEnabled) startGuard(); else console.log(`[${username}] 🛡️ Режим охраны уже включён`); }
      else if (arg === 'off') { if (guardEnabled) stopGuard(); else console.log(`[${username}] 🛡️ Режим охраны уже выключен`); }
      else console.log(`[${username}] ⚠️ Использование: !guard on/off`);
    }
    // ------------------ Команда крафта снежков ------------------
    else if (command === '!craftsnow') await craftSnowBlocks();
  };

  bot.on('windowOpen', window => {
    console.log(`[${username}] Открыто окно: ${window.title}`);
 });

  function sendNearbyPlayers(bot) {
    const nearbyPlayers = Object.values(bot.entities).filter(entity =>
      entity.type === 'player' && entity.username !== bot.username
    );
    if (nearbyPlayers.length === 0) return;

    const playersList = nearbyPlayers.map(p => p.username).join(', ');
    const pos = bot.entity.position;
    webhookClient.send({
      content: `⚠ Игроки рядом с ${bot.username}: ${playersList}\n📍 Координаты: X:${pos.x.toFixed(1)} Y:${pos.y.toFixed(1)} Z:${pos.z.toFixed(1)}`
    }).catch(console.error);
  }

  return bot;
}

// --- Консоль и автоклик !usegui 20 ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let modeSelect = null;

function handleCommands() {
  rl.on('line', (input) => {
    const trimmed = input.trim();


    // блок
    if (trimmed === '!block') {
  monitorBlockEnabled = !monitorBlockEnabled;
  console.log(`🟢 Слежка блока под ботом ${monitorBlockEnabled ? 'включена' : 'выключена'}`);
}

        // Наша консольная команда
    if (trimmed === 'sme') {
      console.log('Привет! Это текст, который ты сам указал.');
      return;
    }

    if (trimmed === '!gun') {
  bots.forEach(bot => {
    bot.autoCheckEnabled = !bot.autoCheckEnabled; // включаем/выключаем для каждого бота

    if (bot.autoCheckEnabled) {
      autoUseGUI20(bot); // запускаем проверку для этого бота
      console.log(`[${bot.username}] ▶️ Автоклик !usegui 20 включён`);
    } else {
      console.log(`[${bot.username}] ⏸️ Автоклик !usegui 20 выключен`);
    }
  });
  return;
}
    
    if (trimmed === '!reconnect') {
  console.log('🔄 Попытка переподключения всех ботов...');

  bots.forEach((bot, index) => {
    // Берём username, который был изначально при создании бота
    const username = bot._username || bot.username;

    if (!username) {
      console.log(`⚠️ Не удалось определить ник бота в слоте ${index}, пропускаем`);
      return;
    }

    // Если бот отключён или не успел войти
    if (bot.isDisconnected || !bot.username) {
      console.log(`🔄 Переподключение бота ${username}...`);

      // Очищаем старый бот
      try { bot.quit(); } catch {}

      // Создаём нового бота с тем же ником
      const newBot = createBot(username);
      bots[index] = newBot; // заменяем сразу

      // Логин теперь обрабатывается внутри createBot через bot.on('login')
    } else {
      console.log(`✅ ${bot.username} уже в сети, пропускаем`);
    }
  });

  return;
}


    if (trimmed === '.off') {
      console.log('⛔ Выключение всех ботов...');
      bots.forEach(bot => { bot.quit(); console.log(`⛔ ${bot.username} отключён`); });
      bots.length = 0;
      modeSelect = null;
      rl.removeAllListeners('line');
      setTimeout(() => askForBots(), 700);
      return;
    }
    const match = trimmed.match(/^\.(\S+)\s(.+)/);
    if (match) {
      const targetName = match[1];
      const commandText = match[2];
      const targetBot = bots.find(bot => bot.username.toLowerCase() === targetName.toLowerCase());
      if (targetBot) targetBot.commandsHandler(commandText);
      else console.log(`⚠️ Бот с ником "${targetName}" не найден.`);
      return;
    }
    bots.forEach(bot => bot.commandsHandler(trimmed));
  });
}

function askForBots() {
  if (!modeSelect) {
    rl.question('Выберите режим запуска ботов (1 - по ID, 2 - по никам): ', (answer) => {
      if (answer.trim() === '1') {
        modeSelect = 'id';
        if (Object.keys(botsMapping).length === 0) { modeSelect = 'nick'; askForUsernames(); return; }
        console.log('Доступные боты из bots.txt:');
        Object.entries(botsMapping).forEach(([nick, id]) => console.log(`  ${nick}=${id}`));
        rl.question('Введите ID через пробел: ', ids => { const usernames = getUsernamesByIDs(ids.trim().split(/\s+/)); usernames.forEach(name => bots.push(createBot(name))); handleCommands(); });        
      } else { modeSelect = 'nick'; askForUsernames(); }
    });
  }
}

function askForUsernames() {
  rl.question('Введите ники ботов через пробел: ', input => { input.trim().split(/\s+/).forEach(nick => bots.push(createBot(nick))); handleCommands(); });
}

askForBots();
