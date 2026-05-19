const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Banner = require('../models/Banner');
const Category = require('../models/Category');
const Message = require('../models/Message');

// Support / Chat Methods
exports.getSupport = async (req, res) => {
    try {
        // Hem gönderen hem de alan tarafında kullanıcıyı ara (Admin olmayan taraf)
        const sentUsers = await Message.distinct('sender', { isAdminSender: false });
        const receivedUsers = await Message.distinct('receiver', { isAdminSender: true });
        
        // Benzersiz kullanıcı ID'lerini birleştir
        const allUserIds = [...new Set([...sentUsers, ...receivedUsers])].filter(id => id != null);
        
        const users = await User.find({ _id: { $in: allUserIds } });
        
        res.render('admin/support', { users });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.getUserMessages = async (req, res) => {
    try {
        const userId = req.params.userId;
        const messages = await Message.find({
            $or: [
                { sender: userId },
                { receiver: userId }
            ]
        }).sort({ createdAt: 1 });
        
        const user = await User.findById(userId);
        res.json({ success: true, messages, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.sendAdminMessage = async (req, res) => {
    try {
        const { userId, content } = req.body;
        const newMessage = new Message({
            receiver: userId,
            isAdminSender: true,
            content
        });
        
        await newMessage.save();
        res.json({ success: true, message: newMessage });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteChatMessage = async (req, res) => {
    try {
        await Message.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.editChatMessage = async (req, res) => {
    try {
        const { content } = req.body;
        await Message.findByIdAndUpdate(req.params.id, { content });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.endChat = async (req, res) => {
    try {
        const userId = req.params.userId;
        // Tüm mesajları sil (Kullanıcı bir daha göremesin diye)
        await Message.deleteMany({
            $or: [
                { sender: userId },
                { receiver: userId }
            ]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};



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
        return req.session.save(err => {
            if (err) console.error(err);
            res.redirect('/admin');
        });
    }
    res.render('admin/login', { error: 'Hatalı şifre!' });
};

// Ürün Yönetimi
exports.getProducts = async (req, res) => {
    const products = await Product.find().populate('category').sort({ createdAt: -1 });
    const categories = await Category.find().sort({ name: 1 });
    res.render('admin/products', { products, categories });
};

// Helper to clean and parse Turkish formatted prices elegantly
const parseTurkishPrice = (priceVal) => {
    if (priceVal === undefined || priceVal === null || priceVal === '') return 0;
    if (typeof priceVal === 'number') return priceVal;
    
    let cleaned = priceVal.toString().trim();
    
    // If there is both a dot and a comma, remove the dot and replace the comma with a dot
    if (cleaned.includes('.') && cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
    } 
    // If there is only a dot and it's followed by exactly 3 digits, it's a thousands separator (e.g., "30.000")
    else if (cleaned.includes('.') && !cleaned.includes(',')) {
        const parts = cleaned.split('.');
        const lastPart = parts[parts.length - 1];
        if (lastPart.length === 3) {
            cleaned = cleaned.replace(/\./g, '');
        }
    }
    // If there is only a comma, replace it with a dot
    else if (cleaned.includes(',') && !cleaned.includes('.')) {
        cleaned = cleaned.replace(/,/g, '.');
    }
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
};

exports.addProduct = async (req, res) => {
    try {
        const { name, description, price, category, stock, isPopular, existingImages, existingImagesOrder, videoOrder } = req.body;
        
        let imageUrl = '/assets/img/gallery/popular1.png'; // default
        let images = [];
        let videoUrl = '';

        if (req.files) {
            if (req.files.imageFile && req.files.imageFile.length > 0) {
                imageUrl = bufferToBase64(req.files.imageFile[0]);
            }
            if (req.files.videoFile && req.files.videoFile.length > 0) {
                videoUrl = bufferToBase64(req.files.videoFile[0]);
            }
        }

        // Process client-side base64 gallery images & their orders (similar to editProduct)
        if (existingImages) {
            const keptImages = Array.isArray(existingImages) ? existingImages : [existingImages];
            const keptImagesOrder = existingImagesOrder 
                ? (Array.isArray(existingImagesOrder) ? existingImagesOrder : [existingImagesOrder])
                : [];
            
            keptImages.forEach((url, index) => {
                const orderVal = (keptImagesOrder && keptImagesOrder[index] !== undefined && keptImagesOrder[index] !== '') 
                    ? parseInt(keptImagesOrder[index]) 
                    : index;
                images.push({ url, order: orderVal });
            });
        }

        let parsedVideoOrder = 99;
        if (videoUrl) {
            parsedVideoOrder = (videoOrder !== undefined && videoOrder !== '') ? parseInt(videoOrder) : 99;
        }

        const parsedPrice = parseTurkishPrice(price);

        console.log('--- ADD PRODUCT ATTEMPT ---');
        console.log('Body:', req.body);
        console.log('Parsed Price:', parsedPrice);
        console.log('Files:', req.files ? Object.keys(req.files) : 'No files');

        const newProduct = new Product({ 
            name, 
            description, 
            price: parsedPrice, 
            category, 
            stock, 
            imageUrl, 
            images,
            videoUrl,
            videoOrder: parsedVideoOrder,
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
        const { name, description, price, category, stock, isPopular, existingImages, videoOrder, deleteVideo } = req.body;
        
        const parsedPrice = parseTurkishPrice(price);

        let updateData = {
            name, 
            description, 
            price: parsedPrice, 
            category, 
            stock, 
            isPopular: isPopular === 'on' 
        };

        // Extract kept existing images in their new sorted order
        let images = [];
        if (existingImages) {
            const keptImages = Array.isArray(existingImages) ? existingImages : [existingImages];
            const keptImagesOrder = req.body.existingImagesOrder 
                ? (Array.isArray(req.body.existingImagesOrder) ? req.body.existingImagesOrder : [req.body.existingImagesOrder])
                : [];
            
            keptImages.forEach((url, index) => {
                const orderVal = (keptImagesOrder && keptImagesOrder[index] !== undefined && keptImagesOrder[index] !== '') 
                    ? parseInt(keptImagesOrder[index]) 
                    : index;
                images.push({ url, order: orderVal });
            });
        }

        // Process files
        if (req.files) {
            if (req.files.imageFile && req.files.imageFile.length > 0) {
                updateData.imageUrl = bufferToBase64(req.files.imageFile[0]);
            }
            
            // Process new video upload
            if (req.files.videoFile && req.files.videoFile.length > 0) {
                updateData.videoUrl = bufferToBase64(req.files.videoFile[0]);
            }
        }

        // Save sorted images array
        updateData.images = images;

        // Process video delete or order update
        if (deleteVideo === 'true') {
            updateData.videoUrl = '';
            updateData.videoOrder = 99;
        } else {
            if (videoOrder !== undefined && videoOrder !== '') {
                updateData.videoOrder = parseInt(videoOrder);
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
