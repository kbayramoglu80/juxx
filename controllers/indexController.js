const Product = require('../models/Product');
const Banner = require('../models/Banner');
const Category = require('../models/Category');

exports.getHome = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 }).limit(8);
        const popularProducts = await Product.find({ isPopular: true }).limit(5);
        const heroBanners = await Banner.find({ type: 'hero' }).sort({ order: 1 });
        const middleBanners = await Banner.find({ type: 'middle' }).sort({ order: 1 });
        
        res.render('index', { products, popularProducts, heroBanners, middleBanners });
    } catch (err) {
        console.error(err);
        res.render('index', { products: [], popularProducts: [], heroBanners: [], middleBanners: [] });
    }
};

exports.getShop = async (req, res) => {
    try {
        const { category } = req.query;
        let query = {};
        let pageTitle = 'Mağaza';
        
        const categories = await Category.find().sort({ name: 1 });
        
        if (category) {
            const catObj = await Category.findOne({ slug: category });
            if (catObj) {
                query.category = catObj._id;
                pageTitle = catObj.name;
            }
        }
        
        const products = await Product.find(query).populate('category').sort({ createdAt: -1 });
        res.render('shop', { products, categories, currentCategory: category || 'Hepsi', pageTitle });
    } catch (err) {
        console.error(err);
        res.render('shop', { products: [], categories: [], currentCategory: 'Hepsi', pageTitle: 'Mağaza' });
    }
};

exports.getCategory = async (req, res) => {
    try {
        const slug = req.params.slug;
        const catObj = await Category.findOne({ slug });
        if (!catObj) return res.redirect('/shop');

        const categories = await Category.find().sort({ name: 1 });
        const products = await Product.find({ category: catObj._id }).populate('category').sort({ createdAt: -1 });

        res.render('shop', { 
            products, 
            categories, 
            currentCategory: slug,
            pageTitle: catObj.name 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/shop');
    }
};

exports.getProductDetails = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.redirect('/shop');
        }
        const product = await Product.findById(req.params.id);
        if (!product) return res.redirect('/shop');
        res.render('product_details', { product });
    } catch (err) {
        console.error(err);
        res.redirect('/shop');
    }
};

exports.getAbout = (req, res) => {
    res.render('about');
};

exports.getContact = (req, res) => {
    res.render('contact');
};

// Cart Methods
exports.getCart = (req, res) => {
    res.render('cart');
};

exports.addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
        }
        
        const cart = req.session.cart || [];
        const existingItemIndex = cart.findIndex(item => item.productId === productId);
        
        const qty = parseInt(quantity) || 1;
        
        if (existingItemIndex >= 0) {
            cart[existingItemIndex].quantity += qty;
        } else {
            cart.push({
                productId: product._id.toString(),
                name: product.name,
                price: product.price,
                imageUrl: product.imageUrl,
                quantity: qty
            });
        }
        
        req.session.cart = cart;
        res.json({ success: true, message: 'Ürün sepete eklendi' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
};

exports.removeFromCart = (req, res) => {
    try {
        const { productId } = req.body;
        if (req.session.cart) {
            req.session.cart = req.session.cart.filter(item => item.productId !== productId);
        }
        res.redirect('/cart');
    } catch (err) {
        console.error(err);
        res.redirect('/cart');
    }
};

// Checkout Methods
exports.getCheckout = (req, res) => {
    // Only allow checkout if user is logged in
    if (!req.session.user) {
        return res.redirect('/auth/login?redirect=/checkout');
    }
    
    // Check if cart is empty
    if (!req.session.cart || req.session.cart.length === 0) {
        return res.redirect('/cart');
    }
    
    res.render('checkout');
};
