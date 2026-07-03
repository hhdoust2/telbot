const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ۱. منوی اصلی ربات
const mainMenu = Markup.keyboard([
    ['📊 قیمت ارز دیجیتال', '🤖 سوال از هوش مصنوعی'],
    ['🌤 وضعیت آب و هوا']
]).resize();

// ۲. منوی انتخاب شهرها (که جایگزین کیبورد اصلی می‌شود)
const weatherMenu = Markup.keyboard([
    ['📍 تهران', '📍 یاسوج'],
    ['📍 دهدشت', '🔙 بازگشت به منوی اصلی']
]).resize();

// دستور /start
bot.start((ctx) => {
    ctx.reply('سلام! به ربات پیشرفته خوش آمدید. یکی از گزینه‌های زیر را انتخاب کنید:', mainMenu);
});

// بازگشت به منوی اصلی
bot.hears('🔙 بازگشت به منوی اصلی', (ctx) => {
    ctx.reply('به منوی اصلی برگشتید:', mainMenu);
});

// وقتی کاربر دکمه آب و هوا را می‌زند، منوی شهرها باز می‌شود
bot.hears('🌤 وضعیت آب و هوا', (ctx) => {
    ctx.reply('لطفاً شهر مورد نظر خود را انتخاب کنید:', weatherMenu);
});

// تابع مشترک برای گرفتن آب و هوا بر اساس نام انگلیسی شهر
async function getWeatherData(ctx, cityNameEn, cityNameFa) {
    try {
        const response = await axios.get(`https://wttr.in/${cityNameEn}?format=j1`);
        const currentCondition = response.data.current_condition[0];
        const temp = currentCondition.temp_C;
        const humidity = currentCondition.humidity;
        const weatherDesc = currentCondition.weatherDesc[0].value;

        const report = `🌤 وضعیت آب و هوای *${cityNameFa}*:\n\n` +
                       `🌡 دما: ${temp}°C\n` +
                       `💧 رطوبت: ${humidity}%\n` +
                       `📝 وضعیت: ${weatherDesc}`;

        ctx.replyWithMarkdown(report);
    } catch (error) {
        ctx.reply(`❌ خطا در دریافت اطلاعات آب‌وهوای ${cityNameFa}. لطفاً دوباره تلاش کنید.`);
    }
}

// پاسخ به دکمه‌های هر شهر
bot.hears('📍 تهران', (ctx) => getWeatherData(ctx, 'tehran', 'تهران'));
bot.hears('📍 یاسوج', (ctx) => getWeatherData(ctx, 'yasuj', 'یاسوج'));
bot.hears('📍 دهدشت', (ctx) => getWeatherData(ctx, 'dehdasht', 'دهدشت'));


// ۳. بخش قیمت ارزهای دیجیتال از صرافی بایننس (Binance)
bot.hears('📊 قیمت ارز دیجیتال', async (ctx) => {
    await ctx.reply('🔄 در حال دریافت قیمت‌های لحظه‌ای از صرافی بایننس...');
    try {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'TONUSDT', 'XRPUSDT', 'NEARUSDT', 'SUIUSDT', 'ADAUSDT', 'CRVUSDT'];
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`;
        
        const response = await axios.get(url);
        const tickerList = response.data;

        let report = `📊 **قیمت لحظه‌ای رمزارزها در صرافی Binance:**\n\n`;

        tickerList.forEach(coin => {
            const symbol = coin.symbol.replace('USDT', '');
            const price = parseFloat(coin.lastPrice);
            const change = parseFloat(coin.priceChangePercent);
            
            const formattedPrice = price >= 1 ? price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : price;
            const emoji = change >= 0 ? '🟢' : '🔴';
            const plusSign = change >= 0 ? '+' : '';

            report += `🪙 **${symbol}**: $${formattedPrice} (${emoji} ${plusSign}${change.toFixed(2)}%)\n`;
        });

        report += `\n⏰ _قیمت‌ها کاملاً زنده و بدون تأخیر هستند._`;
        ctx.replyWithMarkdown(report);
    } catch (error) {
        ctx.reply('❌ مشکلی در دریافت قیمت‌ها از بایننس رخ داد.');
    }
});

// ۴. بخش هوش مصنوعی
bot.hears('🤖 سوال از هوش مصنوعی', (ctx) => {
    ctx.reply('برای پرسش از هوش مصنوعی، متن خود را همراه با دستور /ai بفرستید. مثلاً:\n\n/ai چرا آسمان آبی است؟');
});

bot.command('ai', async (ctx) => {
    const messageText = ctx.message.text;
    const prompt = messageText.replace('/ai', '').trim();

    if (!prompt) {
        return ctx.reply('لطفاً سوال خود را بعد از دستور بنویسید. مثلاً: /ai بگو پایتخت فرانسه کجاست؟');
    }

    await ctx.reply('🤖 در حال فکر کردن...');

    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "meta-llama/llama-3-8b-instruct:free",
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const replyText = response.data.choices[0].message.content;
        ctx.reply(replyText);
    } catch (error) {
        ctx.reply('❌ مشکلی در اتصال به هوش مصنوعی به وجود آمد.');
    }
});

// بخش هماهنگی وب‌هووک ورسل
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body, res);
        } else {
            res.status(200).send('Bot is running...');
        }
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
};
