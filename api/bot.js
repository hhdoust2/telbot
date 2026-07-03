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

bot.start((ctx) => {
    ctx.reply('سلام! به ربات پیشرفته خود خوش آمدید. یکی از گزینه‌های زیر را انتخاب کنید:', mainMenu);
});

bot.hears('🔙 بازگشت به منوی اصلی', (ctx) => {
    ctx.reply('به منوی اصلی برگشتید:', mainMenu);
});

bot.hears('🌤 وضعیت آب و هوا', (ctx) => {
    ctx.reply('لطفاً شهر مورد نظر خود را انتخاب کنید:', weatherMenu);
});

async function getWeatherData(ctx, cityNameEn, cityNameFa) {
    try {
        const response = await axios.get(`https://wttr.in/${cityNameEn}?format=j1`);
        const currentCondition = response.data.current_condition[0];
        ctx.replyWithMarkdown(`🌤 وضعیت آب و هوای *${cityNameFa}*:\n\n🌡 دما: ${currentCondition.temp_C}°C\n💧 رطوبت: ${currentCondition.humidity}%`);
    } catch {
        ctx.reply(`❌ خطا در دریافت اطلاعات آب‌وهوای ${cityNameFa}.`);
    }
}

bot.hears('📍 تهران', (ctx) => getWeatherData(ctx, 'tehran', 'تهران'));
bot.hears('📍 یاسوج', (ctx) => getWeatherData(ctx, 'yasuj', 'یاسوج'));
bot.hears('📍 دهدشت', (ctx) => getWeatherData(ctx, 'dehdasht', 'دهدشت'));

// ۳. بخش قیمت ارز با استفاده از اندپوینت موردنظر شما و دامنه امن api1
bot.hears('📊 قیمت ارز دیجیتال', async (ctx) => {
    await ctx.reply('🔄 در حال دریافت قیمت‌های لحظه‌ای از صرافی...');
    
    const symbols = ['BTC', 'ETH', 'SOL', 'TON', 'XRP', 'NEAR', 'SUI', 'ADA', 'CRV'];
    
    try {
        // ایجاد آرایه‌ای از جفت‌ارزها به صورت ["BTCUSDT", "ETHUSDT", ...]
        const pairs = symbols.map(s => `${s}USDT`);
        
        // استفاده از دامنه api1 به جای api اصلی برای دور زدن فایروال بایننس در ورسل
        const url = `https://api1.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(pairs))}`;
        
        const response = await axios.get(url, { timeout: 4000 });
        const pricesData = response.data; // این اندپوینت آرایه‌ای از {symbol, price} برمی‌گرداند

        let report = `📊 **قیمت لحظه‌ای رمزارزها (Binance Price Ticker):**\n\n`;
        
        pricesData.forEach(coin => {
            const cleanSymbol = coin.symbol.replace('USDT', '');
            const price = parseFloat(coin.price);
            const formattedPrice = price >= 1 ? price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : price;
            
            report += `🪙 **${cleanSymbol}**: $${formattedPrice}\n`;
        });

        report += `\n⏰ _قیمت‌ها کاملاً زنده و بدون تأخیر هستند._`;
        return ctx.replyWithMarkdown(report);

    } catch (binanceError) {
        console.log('Binance api1 failed, switching to fallback API...');
        
        // سرور پشتیبان طلایی: اگر بایننس کلاً کل شبکه ورسل را ببندد، این بخش فوراً قیمت‌ها را بدون ارور دادن به کاربر نمایش می‌دهد
        try {
            const fsyms = symbols.join(',');
            const backupUrl = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${fsyms}&tsyms=USD`;
            const backupResponse = await axios.get(backupUrl);
            const displayData = backupResponse.data.DISPLAY;

            let report = `📊 **قیمت لحظه‌ای رمزارزها (سرور پشتیبان):**\n\n`;
            symbols.forEach(sym => {
                if (displayData && displayData[sym] && displayData[sym].USD) {
                    report += `🪙 **${sym}**: ${displayData[sym].USD.PRICE}\n`;
                }
            });
            return ctx.replyWithMarkdown(report);
        } catch (backupError) {
            return ctx.reply('❌ در حال حاضر ارتباط با تمام سرورهای قیمت‌گذاری قطع است.');
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
    if (!prompt) return ctx.reply('لطفاً سوال خود را بعد از دستور بنویسید. مثلاً: /ai بگو پایتخت فرانسه کجاست؟');

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
        ctx.reply(response.data.choices[0].message.content);
    } catch (error) {
        ctx.reply('❌ مشکلی در اتصال به هوش مصنوعی به وجود آمد.');
    }
});

module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body, res);
        } else {
            res.status(200).send('Bot is running!');
        }
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
};
