const { Telegraf } = require('telegraf');

// خواندن توکن ربات از متغیرهای محیطی ورسل
const bot = new Telegraf(process.env.BOT_TOKEN);

// دستور /start
bot.start((ctx) => ctx.reply('سلام! به ربات متصل به ورسل خوش آمدید.'));

// پاسخ به دستور /help
bot.help((ctx) => ctx.reply('چطور می‌تونم کمکت کنم؟'));

// پاسخ به پیام‌های متنی ساده
bot.on('text', (ctx) => {
    const text = ctx.message.text;
    ctx.reply(`شما گفتی: ${text}`);
});

// این بخش اصلی برای هماهنگی با وب‌هووک ورسل است
module.exports = async (req, res) => {
    try {
        // مطمئن می‌شویم که درخواست فقط از نوع POST (از طرف تلگرام) باشد
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body, res);
        } else {
            res.status(200).send('Bot is running...');
        }
    } catch (error) {
        console.error('Error handling update:', error);
        res.status(500).send('Internal Server Error');
    }
};
