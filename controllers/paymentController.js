const crypto = require('crypto');
const Order = require('../models/Order');

exports.createPaymentToken = async (req, res) => {
    try {
        const { user_name, user_address, user_phone, user_email } = req.body;
        
        // Cart check
        if (!req.session.cart || req.session.cart.length === 0) {
            return res.status(400).json({ status: 'error', reason: 'Sepet boş.' });
        }
        
        let cartTotal = 0;
        const cart_items = req.session.cart.map(item => {
            cartTotal += (item.price * item.quantity);
            return [item.name, item.price.toString(), item.quantity];
        });
        
        // PayTR Ayarları
        const merchant_id = process.env.PAYTR_MERCHANT_ID;
        const merchant_key = process.env.PAYTR_MERCHANT_KEY;
        const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
        
        const merchant_oid = 'OID' + Date.now(); // Benzersiz sipariş numarası
        const payment_amount = Math.round(cartTotal * 100); // Kuruş cinsinden
        const merchant_ok_url = 'http://localhost:3000/payment/success';
        const merchant_fail_url = 'http://localhost:3000/payment/fail';
        const user_basket = JSON.stringify(cart_items);
        const timeout_limit = "30";
        const debug_on = 1;
        const test_mode = 1; // 1 for testing, 0 for production
        const no_installment = 0;
        const max_installment = 0;
        const user_ip = req.ip || '127.0.0.1';
        const email = req.session.user ? req.session.user.email : (user_email || 'guest@test.com');
        
        const currency = "TL";

        // Hash oluşturma: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
        const hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode;
        const paytr_token = crypto.createHmac('sha256', merchant_key).update(hash_str + merchant_salt).digest('base64');

        // Siparişi veritabanına "Pending" olarak kaydet
        const newOrder = new Order({
            user: req.session.user ? (req.session.user._id || req.session.user.id) : null,
            guestName: !req.session.user ? user_name : undefined,
            guestEmail: !req.session.user ? email : undefined,
            guestPhone: !req.session.user ? user_phone : undefined,
            items: req.session.cart.map(item => ({ 
                product: item.productId, 
                quantity: item.quantity, 
                price: item.price,
                selectedCarat: item.selectedCarat || null
            })),
            totalAmount: cartTotal,
            shippingAddress: user_address + " - " + user_phone + " - " + user_name,
            merchant_oid: merchant_oid,
            paymentStatus: 'Pending'
        });
        await newOrder.save();

        // PayTR API İsteği
        const postData = new URLSearchParams({
            merchant_id: merchant_id,
            user_ip: user_ip,
            merchant_oid: merchant_oid,
            email: email,
            payment_amount: payment_amount,
            paytr_token: paytr_token,
            user_basket: user_basket,
            debug_on: debug_on,
            no_installment: no_installment,
            max_installment: max_installment,
            user_name: user_name,
            user_address: user_address,
            user_phone: user_phone,
            merchant_ok_url: merchant_ok_url,
            merchant_fail_url: merchant_fail_url,
            timeout_limit: timeout_limit,
            currency: currency,
            test_mode: test_mode
        });

        const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: postData
        });
        
        const responseData = await response.json();
        
        if (responseData.status === 'success') {
            res.json({ status: 'success', token: responseData.token });
        } else {
            console.error('PayTR Token Error:', responseData.reason);
            res.json({ status: 'error', reason: responseData.reason });
        }
    } catch (err) {
        console.error('Payment Token Creation Error:', err);
        res.status(500).json({ status: 'error', reason: 'Ödeme başlatılamadı.' });
    }
};

exports.paymentCallback = async (req, res) => {
    try {
        // PayTR'den gelen POST verisi
        const { merchant_oid, status, total_amount, hash } = req.body;
        
        const merchant_key = process.env.PAYTR_MERCHANT_KEY;
        const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
        
        // Hash kontrolü
        const hash_str = merchant_oid + merchant_salt + status + total_amount;
        const calculated_hash = crypto.createHmac('sha256', merchant_key).update(hash_str).digest('base64');
        
        if (hash !== calculated_hash) {
            console.error('PayTR Webhook Hash Mismatch!');
            return res.send('PAYTR WATCH DOG HASH FAILED');
        }
        
        if (status === 'success') {
            await Order.findOneAndUpdate({ merchant_oid }, { paymentStatus: 'Paid' });
            console.log(`Order ${merchant_oid} paid successfully`);
        } else {
            await Order.findOneAndUpdate({ merchant_oid }, { paymentStatus: 'Failed' });
            console.log(`Order ${merchant_oid} payment failed`);
        }
        
        res.send('OK');
    } catch (error) {
        console.error('PayTR Webhook Error:', error);
        res.status(500).send('ERROR');
    }
};

exports.paymentSuccess = (req, res) => {
    // Sepeti temizle
    if (req.session) {
        req.session.cart = [];
    }
    res.render('payment_success');
};

exports.paymentFail = (req, res) => {
    res.render('payment_fail');
};
