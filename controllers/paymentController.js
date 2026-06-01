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
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const merchant_ok_url = `${protocol}://${host}/payment/success`;
        const merchant_fail_url = `${protocol}://${host}/payment/fail`;
        const user_basket = Buffer.from(JSON.stringify(cart_items)).toString('base64');
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
                selectedCarat: item.selectedCarat || null,
                selectedSize: item.selectedSize || null
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
        console.log('========================================');
        console.log('=== PAYTR WEBHOOK ALINDI ===');
        console.log('Zaman:', new Date().toISOString());
        console.log('Method:', req.method);
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Raw Body:', JSON.stringify(req.body || {}, null, 2));

        const body = req.body || {};
        
        const merchant_oid = body.merchant_oid;
        const status = body.status;
        const total_amount = body.total_amount;
        const hash = body.hash;
        
        console.log('Alınan Alanlar:');
        console.log('  merchant_oid:', merchant_oid);
        console.log('  status:', status);
        console.log('  total_amount:', total_amount);
        console.log('  hash:', hash ? 'VAR' : 'YOK');
        
        if (!merchant_oid || !status || !total_amount || !hash) {
            console.error('HATA: Eksik alanlar!');
            console.log('Gerekli alanlar: merchant_oid, status, total_amount, hash');
            console.log('========================================');
            return res.status(400).send('FAIL');
        }
        
        const merchant_key = process.env.PAYTR_MERCHANT_KEY;
        const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
        
        if (!merchant_key || !merchant_salt) {
            console.error('HATA: Çevre değişkenleri eksik!');
            console.error('PAYTR_MERCHANT_KEY:', merchant_key ? 'VAR' : 'YOK');
            console.error('PAYTR_MERCHANT_SALT:', merchant_salt ? 'VAR' : 'YOK');
            console.log('========================================');
            return res.status(500).send('ERROR');
        }
        
        const hash_str = merchant_oid + merchant_salt + status + total_amount;
        const calculated_hash = crypto.createHmac('sha256', merchant_key).update(hash_str).digest('base64');
        
        console.log('Hash Kontrolü:');
        console.log('  Gelen Hash:', hash);
        console.log('  Hesaplanan Hash:', calculated_hash);
        console.log('  Eşleşiyor mu?', hash === calculated_hash ? 'EVET' : 'HAYIR');
        
        if (hash !== calculated_hash) {
            console.error('HATA: Hash eşleşmesi başarısız!');
            console.log('========================================');
            return res.send('PAYTR WATCH DOG HASH FAILED');
        }
        
        const order = await Order.findOne({ merchant_oid });
        
        if (!order) {
            console.warn('UYARI: Sipariş veritabanında bulunamadı! merchant_oid:', merchant_oid);
        } else {
            order.paymentStatus = status === 'success' ? 'Paid' : 'Failed';
            await order.save();
            console.log('BAŞARILI: Sipariş durumu güncellendi:', merchant_oid, '->', order.paymentStatus);
        }
        
        console.log('=== PAYTR WEBHOOK BAŞARILI ===');
        console.log('========================================');
        res.send('OK');
    } catch (error) {
        console.error('========================================');
        console.error('=== PAYTR WEBHOOK HATA ===');
        console.error('Hata:', error);
        console.error('Stack:', error.stack);
        console.error('========================================');
        res.status(500).send('ERROR');
    }
};

exports.paymentTest = (req, res) => {
    const testData = {
        status: 'success',
        message: 'Payment callback endpoint is working!',
        endpoint: '/payment/callback',
        method: 'POST',
        expected_fields: ['merchant_oid', 'status', 'total_amount', 'hash'],
        documentation: 'Bu endpoint sadece POST isteklerini kabul eder. PayTR bildirimleri bu adrese gönderilir.',
        server_time: new Date().toISOString()
    };
    
    console.log('=== PAYTR TEST ENDPOINT ÇAĞRILDI ===');
    console.log('Zaman:', testData.server_time);
    
    res.json(testData);
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

exports.paymentCallbackGet = (req, res) => {
    console.error('PayTR Webhook GET Error: Received GET request instead of POST!');
    res.status(405).send(
        'HATA: Sunucunuza POST yerine GET isteği ulaştı! ' +
        'Bu durum, sitenizde etkin olan otomatik bir yönlendirmeden (HTTP -> HTTPS veya www. -> non-www) kaynaklanır. ' +
        'PayTR bildirimleri sadece POST isteği ile gönderir, ancak yönlendirmeler tarayıcı/istemci tarafından POST isteğini GET isteğine dönüştürür ve veri kaybına yol açar. ' +
        'Lütfen PayTR Mağaza Paneli -> Ayarlar bölümündeki Bildirim URL bilgisini yönlendirme yapmayan nihai URL (örneğin doğrudan https://midiamond.com.tr/payment/callback) olarak güncelleyin veya sunucunuzun yönlendirme ayarlarını kontrol edin.'
    );
};
