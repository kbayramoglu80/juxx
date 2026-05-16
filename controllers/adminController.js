const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Banner = require('../models/Banner');
const Category = require('../models/Category');

const bufferToBase64 = (file) => {
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
};

exports.getDashboard = async (req, res) => {
    try {
        const productCount = await Product.countDocuments();
        const orderCount = await Order.countDocuments();
        const userCount = await User.countDocuments();
        const recentOrders = await Order.find().populate('user').sort({ createdAt: -1 }).limit(5);
        
        res.render('admin/dashboard', { 
            productCount, 
            orderCount, 
            userCount, 
            recentOrders
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

exports.getLogin = (req, res) => {
    res.render('admin/login', { error: null });
};

exports.postLogin = (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    }
    res.render('admin/login', { error: 'Hatalı şifre!' });
};

// Ürün Yönetimi
exports.getProducts = async (req, res) => {
    const products = await Product.find().populate('category').sort({ createdAt: -1 });
    const categories = await Category.find().sort({ name: 1 });
    res.render('admin/products', { products, categories });
};

exports.addProduct = async (req, res) => {
    try {
        const { name, description, price, category, stock, isPopular } = req.body;
        
        let imageUrl = '/assets/img/gallery/popular1.png'; // default
        let images = [];
        let videoUrl = '';

        if (req.files) {
            if (req.files.imageFile && req.files.imageFile.length > 0) {
                imageUrl = bufferToBase64(req.files.imageFile[0]);
            }
            if (req.files.galleryImages) {
                req.files.galleryImages.forEach((file, index) => {
                    images.push({ url: bufferToBase64(file), order: index });
                });
            }
            if (req.files.videoFile && req.files.videoFile.length > 0) {
                videoUrl = bufferToBase64(req.files.videoFile[0]);
            }
        }
        console.log('--- ADD PRODUCT ATTEMPT ---');
        console.log('Body:', req.body);
        console.log('Files:', req.files ? Object.keys(req.files) : 'No files');

        const newProduct = new Product({ 
            name, 
            description, 
            price, 
            category, 
            stock, 
            imageUrl, 
            images,
            videoUrl,
            isPopular: isPopular === 'on' 
        });
        await newProduct.save();
        console.log('Product saved successfully:', newProduct._id);
        res.redirect('/admin/products?msg=success');
    } catch (err) {
        console.error('ADD PRODUCT ERROR:', err);
        res.redirect('/admin/products?msg=error');
    }
};

exports.editProduct = async (req, res) => {
    try {
        const { name, description, price, category, stock, isPopular } = req.body;
        
        let updateData = {
            name, 
            description, 
            price, 
            category, 
            stock, 
            isPopular: isPopular === 'on' 
        };

        if (req.files) {
            if (req.files.imageFile && req.files.imageFile.length > 0) {
                updateData.imageUrl = bufferToBase64(req.files.imageFile[0]);
            }
            
            if (req.files.galleryImages && req.files.galleryImages.length > 0) {
                updateData.images = [];
                req.files.galleryImages.forEach((file, index) => {
                    updateData.images.push({ url: bufferToBase64(file), order: index });
                });
            }
            
            if (req.files.videoFile && req.files.videoFile.length > 0) {
                updateData.videoUrl = bufferToBase64(req.files.videoFile[0]);
            }
        }

        await Product.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/products');
    }
};

exports.deleteProduct = async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect('/admin/products');
};

// Sipariş Yönetimi
exports.getOrders = async (req, res) => {
    const orders = await Order.find().populate('user').sort({ createdAt: -1 });
    res.render('admin/orders', { orders });
};

exports.updateOrderStatus = async (req, res) => {
    await Order.findByIdAndUpdate(req.params.id, { orderStatus: req.body.status });
    res.redirect('/admin/orders');
};

// Kullanıcı Yönetimi
exports.getUsers = async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    res.render('admin/users', { users });
};

exports.deleteUser = async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/users');
};

// Banner/Slider Yönetimi
exports.getBanners = async (req, res) => {
    const banners = await Banner.find().sort({ order: 1 });
    res.render('admin/banners', { banners });
};

exports.addBanner = async (req, res) => {
    try {
        const { type, imageUrl: textImageUrl, title, subtitle, link, order } = req.body;
        let imageUrl = textImageUrl;

        if (req.file) {
            imageUrl = bufferToBase64(req.file);
        }

        const newBanner = new Banner({ type, imageUrl, title, subtitle, link, order });
        await newBanner.save();
        res.redirect('/admin/banners');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/banners');
    }
};

exports.deleteBanner = async (req, res) => {
    await Banner.findByIdAndDelete(req.params.id);
    res.redirect('/admin/banners');
};

// Kategori Yönetimi
exports.getCategories = async (req, res) => {
    const categories = await Category.find().sort({ name: 1 });
    res.render('admin/categories', { categories });
};

exports.addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        const newCategory = new Category({ name, slug });
        await newCategory.save();
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/categories');
    }
};

exports.editCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        await Category.findByIdAndUpdate(req.params.id, { name, slug });
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/categories');
    }
};

exports.deleteCategory = async (req, res) => {
    await Category.findByIdAndDelete(req.params.id);
    res.redirect('/admin/categories');
};
