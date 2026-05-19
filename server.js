const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
require('dotenv').config();

const app = express();
const chatController = require('./controllers/chatController');

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: (MongoStore.create || MongoStore.default.create)({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
        secure: false // Set true in production with HTTPS
    }
}));

// Global variables for views
app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;
    
    // Initialize cart if not exists
    if (!req.session.cart) {
        req.session.cart = [];
    }
    res.locals.cart = req.session.cart;
    
    // Calculate total count and amount
    let cartCount = 0;
    let cartTotal = 0;
    req.session.cart.forEach(item => {
        cartCount += item.quantity;
        cartTotal += (item.price * item.quantity);
    });
    res.locals.cartCount = cartCount;
    res.locals.cartTotal = cartTotal;
    
    try {
        const Category = require('./models/Category');
        res.locals.globalCategories = await Category.find().sort({ name: 1 });
    } catch (err) {
        res.locals.globalCategories = [];
    }
    
    next();
});

// Chat Routes
app.get('/chat/messages', chatController.getMessages);
app.post('/chat/send', chatController.sendMessage);

// Routes
app.use('/', require('./routes/indexRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/auth', require('./routes/authRoutes'));
app.use('/payment', require('./routes/paymentRoutes'));
app.use('/user', require('./routes/userRoutes'));

// Error Handler
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.send('<script>alert("Hata: Dosya boyutu çok büyük! (Maksimum 50MB)"); window.history.back();</script>');
    }
    if (req.path.startsWith('/admin')) {
        return res.redirect('/admin/products?msg=error');
    }
    res.status(500).send('Bir hata oluştu!');
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB veritabanına başarıyla bağlanıldı.');
        app.listen(PORT, () => {
            console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
        });
    })
    .catch(err => {
        console.error('MongoDB bağlantı hatası:', err.message);
        console.log('Lütfen .env dosyasındaki MONGODB_URI adresini kontrol edin.');
        // Veritabanı olmadan da sunucuyu test edebilmek için geçici olarak başlatıyoruz
        app.listen(PORT, () => {
            console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor (MongoDB BAĞLANTISI YOK).`);
        });
    });
