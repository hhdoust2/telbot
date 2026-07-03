const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ۱. منوی اصلی ربات
const mainMenu = Markup.keyboard([
    ['📊 قیمت ارز دیجیتال', '🤖 سوال از هوش مصنوعی'],
    ['🌤 وضعیت آب و هوا']
]).resize();

// ۲. منوی انتخاب شهرها
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

// وقتی کاربر دکمه آب و هوا را می‌زند
bot.hears('🌤 وضعیت آب و هوا', (ctx) => {
    ctx.reply('لطفاً شهر مورد نظر خود را انتخاب کنید:', weatherMenu);
});

// تابع مشترک برای گرفتن آب و هوا
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


// ۳. بخش اصلاح‌شده قیمت ارزهای دیجیتال (بایننس + سرور پشتیبان تعاملی)
bot.hears('📊 قیمت ارز دیجیتال', async (ctx) => {
    await ctx.reply('🔄 در حال دریافت قیمت‌های لحظه‌ای...');
    
    const cryptoList = [
        { symbol: 'BTC', binancePair: 'BTCUSDT' },
        { symbol: 'ETH', binancePair: 'ETHUSDT' },
        { symbol: 'SOL', binancePair: 'SOLUSDT' },
        { symbol: 'TON', binancePair: 'TONUSDT' },
        { symbol: 'XRP', binancePair: 'XRPUSDT' },
        { symbol: 'NEAR', binancePair: 'NEARUSDT' },
        { symbol: 'SUI', binancePair: 'SUIUSDT' },
        { symbol: 'ADA', binancePair: 'ADAUSDT' },
        { symbol: 'CRV', binancePair: 'CRVUSDT' }
    ];

    try {
        // روش اول: درخواست مستقیم به بایننس با فرمت دقیق انکود شده
        const symbolsParam = JSON.stringify(cryptoList.map(c => c.binancePair));
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`;
        
        const response = await axios.get(url, { timeout: 4000 }); // تایم‌اوت ۴ ثانیه‌ای برای سوییچ سریع در صورت خرابی
        const tickerList = response.data;

        let report = `📊 **قیمت لحظه‌ای رمزارزها (صرافی Binance):**\n\n`;
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
        return ctx.replyWithMarkdown(report);

    } catch (binanceError) {
        console.log('Binance API failed or blocked, trying backup API...');
        
        // روش دوم (پشتیبان): اگر بایننس قطع بود یا آی‌پی ورسل را بلاک کرد، از این سرور کمکی استفاده می‌شود
        try {
            const fsyms = cryptoList.map(c => c.symbol).join(',');
            const backupUrl = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${fsyms}&tsyms=USD`;
            
            const backupResponse = await axios.get(backupUrl);
            const displayData = backupResponse.data.DISPLAY;

            let report = `📊 **قیمت لحظه‌ای رمزارزها (سرور پشتیبان کریپتو):**\n\n`;
            cryptoList.forEach(c => {
                if (displayData && displayData[c.symbol] && displayData[c.symbol].USD) {
                    const coinInfo = displayData[c.symbol].USD;
                    const price = coinInfo.PRICE;
                    const change = coinInfo.CHANGEPCT24HOUR;
                    const emoji = parseFloat(change) >= 0 ? '🟢' : '🔴';
                    const plusSign = parseFloat(change) >= 0 ? '+' : '';

                    report += `🪙 **${c.symbol}**: ${price} (${emoji} ${plusSign}${parseFloat(change).toFixed(2)}%)\n`;
                }
            });
            report += `\n⏰ _داده‌ها از سرور پشتیبان بارگذاری شدند._`;
            return ctx.replyWithMarkdown(report);

        } catch (backupError) {
            console.error(backupError);
            return ctx.reply('❌ متأسفانه ارتباط با تمام سرورهای قیمت‌گذاری قطع شده است. لطفاً چند لحظه دیگر امتحان کنید.');
        }
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
