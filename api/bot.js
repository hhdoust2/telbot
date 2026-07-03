const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

// منوی اصلی دکمه‌ای
const mainMenu = Markup.keyboard([
    ['💰 قیمت ارز و طلا', '🤖 سوال از هوش مصنوعی'],
    ['🌤 وضعیت آب و هوا']
]).resize();

// دستور /start
bot.start((ctx) => {
    ctx.reply('سلام! به ربات پیشرفته خوش آمدید. یکی از گزینه‌های زیر را انتخاب کنید:', mainMenu);
});

// ۱. بخش آب و هوا (اصلاح شده بر اساس دکمه)
bot.hears('🌤 وضعیت آب و هوا', (ctx) => {
    ctx.reply('لطفاً دستور آب‌وهوا را همراه با نام شهر به انگلیسی بفرستید. مثلاً:\n/weather tehran');
});

bot.command('weather', async (ctx) => {
    const messageText = ctx.message.text;
    const cityName = messageText.split(' ')[1];
    if (!cityName) return ctx.reply('لطفاً نام شهر را وارد کنید. مثلاً: /weather tehran');

    try {
        const response = await axios.get(`https://wttr.in/${cityName}?format=j1`);
        const currentCondition = response.data.current_condition[0];
        const report = `🌤 آب و هوای *${cityName.toUpperCase()}*:\n\n🌡 دما: ${currentCondition.temp_C}°C\n💧 رطوبت: ${currentCondition.humidity}%`;
        ctx.replyWithMarkdown(report);
    } catch {
        ctx.reply('خطا در دریافت اطلاعات آب‌وهوا.');
    }
});

// ۲. بخش قیمت ارز و طلا
bot.hears('💰 قیمت ارز و طلا', async (ctx) => {
    await ctx.reply('🔄 در حال دریافت قیمت‌های زنده...');
    try {
        // استفاده از یک API عمومی برای قیمت ارزها (به عنوان نمونه)
        const response = await axios.get('https://open.er-api.com/v6/latest/USD');
        const rates = response.data.rates;
        
        // محاسبه نرخ‌های حدودی یا نمایش ارزهای جهانی (یا APIهای ایرانی در صورت داشتن دسترسی)
        const report = `💰 **نرخ برابری ارزها (پایه USD):**\n\n` +
                       `🇪🇺 یورو (EUR): ${rates.EUR.toFixed(2)}\n` +
                       `🇬🇧 پوند (GBP): ${rates.GBP.toFixed(2)}\n` +
                       `🇦🇪 درهم (AED): ${rates.AED.toFixed(2)}\n` +
                       `🇯🇵 ین (JPY): ${rates.JPY.toFixed(2)}\n\n` +
                       `💡 _نکته: این قیمت‌ها از بازارهای جهانی دریافت شده‌اند._`;
        
        ctx.replyWithMarkdown(report);
    } catch (error) {
        ctx.reply('❌ متأسفانه در حال حاضر امکان دریافت قیمت ارز وجود ندارد.');
    }
});

// ۳. بخش هوش مصنوعی
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
        // اتصال به یک API رایگان و بدون تحریم هوش مصنوعی (مدل Llama یا مشابه)
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "meta-llama/llama-3-8b-instruct:free", // یک مدل کاملاً رایگان در OpenRouter
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, // بعداً این توکن را در ورسل ست می‌کنیم
                'Content-Type': 'application/json'
            }
        });

        const replyText = response.data.choices[0].message.content;
        ctx.reply(replyText);
    } catch (error) {
        console.error(error);
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
