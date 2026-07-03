const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

// راه‌اندازی ربات با توکن ذخیره شده در متغیرهای محیطی ورسل
const bot = new Telegraf(process.env.BOT_TOKEN);

// ۱. تعریف منوی اصلی ربات (کیبورد پایین صفحه)
const mainMenu = Markup.keyboard([
    ['📊 قیمت ارز دیجیتال', '🤖 سوال از هوش مصنوعی'],
    ['🌤 وضعیت آب و هوا']
]).resize();

// ۲. تعریف منوی انتخاب شهرها برای بخش آب‌وهوا
const weatherMenu = Markup.keyboard([
    ['📍 تهران', '📍 یاسوج'],
    ['📍 دهدشت', '🔙 بازگشت به منوی اصلی']
]).resize();

// دستور /start
bot.start((ctx) => {
    ctx.reply('سلام! به ربات پیشرفته خود خوش آمدید. یکی از گزینه‌های زیر را انتخاب کنید:', mainMenu);
});

// دکمه بازگشت به منوی اصلی
bot.hears('🔙 بازگشت به منوی اصلی', (ctx) => {
    ctx.reply('به منوی اصلی برگشتید:', mainMenu);
});

// وقتی کاربر روی دکمه آب و هوا کلیک می‌کند، منوی شهرها ظاهر می‌شود
bot.hears('🌤 وضعیت آب و هوا', (ctx) => {
    ctx.reply('لطفاً شهر مورد نظر خود را انتخاب کنید:', weatherMenu);
});

// تابع مشترک برای دریافت داده‌های آب‌وهوا از سرویس wttr.in
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

// گوش دادن به دکمه‌های مربوط به هر شهر
bot.hears('📍 تهران', (ctx) => getWeatherData(ctx, 'tehran', 'تهران'));
bot.hears('📍 یاسوج', (ctx) => getWeatherData(ctx, 'yasuj', 'یاسوج'));
bot.hears('📍 دهدشت', (ctx) => getWeatherData(ctx, 'dehdasht', 'دهدشت'));

// ۳. بخش پیشرفته قیمت ارز دیجیتال با استفاده از Klines بایننس و فالبک پشتیبان
bot.hears('📊 قیمت ارز دیجیتال', async (ctx) => {
    await ctx.reply('🔄 در حال دریافت دقیق‌ترین قیمت‌ها از چارت بایننس...');
    
    // لیست دقیق رمزارزهای درخواستی شما
    const symbols = ['BTC', 'ETH', 'SOL', 'TON', 'XRP', 'NEAR', 'SUI', 'ADA', 'CRV'];
    
    try {
        // ارسال همزمان درخواست کلاینز روزانه برای تک‌تک ارزها به ساب‌دامنه رسمی api1 بایننس
        const promises = symbols.map(async (symbol) => {
            try {
                const url = `https://api1.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=1`;
                const response = await axios.get(url, { timeout: 3500 });
                
                const lastCandle = response.data[0];
                const closePrice = parseFloat(lastCandle[4]); // قیمت بسته شدن کندل (قیمت فعلی)
                const openPrice = parseFloat(lastCandle[1]);  // قیمت باز شدن کندل روزانه
                
                // محاسبه دقیق درصد تغییرات روزانه
                const changePercent = ((closePrice - openPrice) / openPrice) * 100;
                
                return { symbol, price: closePrice, change: changePercent, success: true };
            } catch (err) {
                // در صورت خطای یک ارز، بقیه ارزها خراب نمی‌شوند
                return { symbol, success: false };
            }
        });

        const results = await Promise.all(promises);

        let report = `📊 **قیمت لحظه‌ای رمزارزها (Binance Klines):**\n\n`;
        let hasAtLeastOneSuccess = false;

        results.forEach(coin => {
            if (coin.success) {
                hasAtLeastOneSuccess = true;
                const formattedPrice = coin.price >= 1 ? coin.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : coin.price;
                const emoji = coin.change >= 0 ? '🟢' : '🔴';
                const plusSign = coin.change >= 0 ? '+' : '';
                report += `🪙 **${coin.symbol}**: $${formattedPrice} (${emoji} ${plusSign}${coin.change.toFixed(2)}%)\n`;
            } else {
                report += `❌ **${coin.symbol}**: خطا در بارگذاری از بایننس\n`;
            }
        });

        // اگر بایننس کلاً سرور ورسل را بلاک کرده باشد، سیستم سوییچ می‌کند روی سرور پشتیبان
        if (!hasAtLeastOneSuccess) {
            throw new Error("All Binance requests blocked");
        }

        report += `\n⏰ _داده‌ها مستقیم از کندل‌های روزانه صرافی استخراج شده‌اند._`;
        return ctx.replyWithMarkdown(report);

    } catch (globalError) {
        console.log('Binance Klines failed, switching to backup API...');
        
        // سرور پشتیبان بدون محدودیت IP و تحریم (CryptoCompare) برای مواقع اضطراری
        try {
            const fsyms = symbols.join(',');
            const backupUrl = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${fsyms}&tsyms=USD`;
            const backupResponse = await axios.get(backupUrl);
            const displayData = backupResponse.data.DISPLAY;

            let report = `📊 **قیمت لحظه‌ای رمزارزها (سرور پشتیبان کریپتو):**\n\n`;
            symbols.forEach(sym => {
                if (displayData && displayData[sym] && displayData[sym].USD) {
                    const coinInfo = displayData[sym].USD;
                    const emoji = parseFloat(coinInfo.CHANGEPCT24HOUR) >= 0 ? '🟢' : '🔴';
                    report += `🪙 **${sym}**: ${coinInfo.PRICE} (${emoji} ${coinInfo.CHANGEPCT24HOUR}%)\n`;
                }
            });
            report += `\n⏰ _به دلیل محدودیت بایننس، داده‌ها از سرور پشتیبان بارگذاری شدند._`;
            return ctx.replyWithMarkdown(report);
        } catch (backupError) {
            return ctx.reply('❌ در حال حاضر ارتباط با تمام سرورهای قیمت‌گذاری قطع است. لطفاً کمی بعد تلاش کنید.');
        }
    }
});

// ۴. بخش هوش مصنوعی (اتصال به مدل رایگان لاما ۳ در OpenRouter)
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
        ctx.reply('❌ مشکلی در اتصال به هوش مصنوعی به وجود آمد. مطمئن شوید کلید OPENROUTER_API_KEY را در ورسل تنظیم کرده‌اید.');
    }
});

// ۵. بخش هندلر اصلی وب‌هووک برای سازگاری با توابع Serverless ورسل
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body, res);
        } else {
            res.status(200).send('Bot is running successfully!');
        }
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
