const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const isAdmin = require('../controllers/isAdmin');
const upload = require('../middlewares/upload');

router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);

router.use(isAdmin); // Diğer tüm admin rotaları için isAdmin kontrolü

router.get('/', adminController.getDashboard);
router.get('/products', adminController.getProducts);

// AJAX ön-yükleme: tek dosyayı Cloudinary'ye yükler, URL döner
router.post('/upload-temp', upload.single('file'), adminController.uploadTemp);

router.post('/products/add', upload.single('imageFile'), adminController.addProduct);
router.post('/products/edit/:id', upload.single('imageFile'), adminController.editProduct);
router.get('/products/delete/:id', adminController.deleteProduct);

router.get('/orders', adminController.getOrders);
router.post('/orders/update/:id', adminController.updateOrderStatus);

router.get('/users', adminController.getUsers);
router.get('/users/delete/:id', adminController.deleteUser);

router.get('/banners', adminController.getBanners);
router.post('/banners/add', upload.single('imageFile'), adminController.addBanner);
router.get('/banners/delete/:id', adminController.deleteBanner);

router.get('/categories', adminController.getCategories);
router.post('/categories/add', adminController.addCategory);
router.post('/categories/edit/:id', adminController.editCategory);
router.get('/categories/delete/:id', adminController.deleteCategory);

// Support Routes
router.get('/support', adminController.getSupport);
router.get('/support/messages/:userId', adminController.getUserMessages);
router.post('/support/send', adminController.sendAdminMessage);
router.put('/support/message/:id', adminController.editChatMessage);
router.delete('/support/message/:id', adminController.deleteChatMessage);
router.post('/support/end-chat/:userId', adminController.endChat);

module.exports = router;
