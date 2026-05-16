const User = require('../models/User');
const Order = require('../models/Order');

exports.getProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Fetch user data excluding password
        const user = await User.findById(userId).select('-password');
        
        // Fetch user's orders and populate product details
        const orders = await Order.find({ user: userId })
                                  .populate('items.product')
                                  .sort({ createdAt: -1 });

        res.render('user/profile', { 
            profileUser: user, 
            orders: orders,
            successMessage: req.session.successMessage || null,
            errorMessage: req.session.errorMessage || null
        });

        // Clear messages after displaying
        req.session.successMessage = null;
        req.session.errorMessage = null;

    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { name, phone, address } = req.body;

        await User.findByIdAndUpdate(userId, {
            name: name,
            phone: phone,
            address: address
        });

        // Update session name if it was changed
        req.session.user.name = name;
        
        req.session.successMessage = 'Profil bilgileriniz başarıyla güncellendi.';
        res.redirect('/user/profile');

    } catch (err) {
        console.error(err);
        req.session.errorMessage = 'Bilgiler güncellenirken bir hata oluştu.';
        res.redirect('/user/profile');
    }
};
