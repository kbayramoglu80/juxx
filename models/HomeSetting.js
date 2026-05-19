const mongoose = require('mongoose');

const homeSettingSchema = new mongoose.Schema({
    newArrivalTitle: { 
        type: String, 
        default: 'Yeni Gelenler' 
    },
    service1Title: { 
        type: String, 
        default: 'Hızlı ve Ücretsiz Teslimat' 
    },
    service1Desc: { 
        type: String, 
        default: 'Tüm siparişlerde ücretsiz kargo' 
    },
    service2Title: { 
        type: String, 
        default: 'Güvenli Ödeme' 
    },
    service2Desc: { 
        type: String, 
        default: 'PayTR ile %100 güvenli ödeme' 
    },
    service3Title: { 
        type: String, 
        default: 'Mağazamızı Ziyaret Edin' 
    },
    service3Desc: { 
        type: String, 
        default: 'Kapalıçarşı mağazamızı ziyaret edebilirsiniz' 
    },
    service4Title: { 
        type: String, 
        default: 'Uzman Kadro Desteği' 
    },
    service4Desc: { 
        type: String, 
        default: 'Uzman kadromuzla 7/24 destek vermeye hazırız' 
    }
}, { timestamps: true });

module.exports = mongoose.model('HomeSetting', homeSettingSchema);
