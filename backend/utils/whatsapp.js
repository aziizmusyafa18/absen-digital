const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { LogNotifikasi, Siswa } = require('../models');

// Delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'absen-digital-wa' }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let isReady = false;
let waStatus = 'INITIALIZING';
let waQrCode = null;

client.on('qr', (qr) => {
    console.log('🔄 Memerlukan otentikasi WhatsApp. Silakan scan QR code di Dashboard Admin.');
    waStatus = 'QR_READY';
    waQrCode = qr;
});

client.on('ready', () => {
    console.log('✅ WhatsApp Gateway berhasil terhubung dan siap.');
    isReady = true;
    waStatus = 'READY';
    waQrCode = null;
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp terotentikasi.');
    waStatus = 'AUTHENTICATED';
});

client.on('auth_failure', msg => {
    console.error('❌ Gagal otentikasi WhatsApp:', msg);
    waStatus = 'AUTH_FAILURE';
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Gateway terputus:', reason);
    isReady = false;
    waStatus = 'DISCONNECTED';
    waQrCode = null;
});

client.on('message_ack', async (msg, ack) => {
    /*
      ACK values:
      1: SENT
      2: RECEIVED / DELIVERED
      3: READ
    */
    try {
        const statusMap = {
            1: 'sent',
            2: 'delivered',
            3: 'read'
        };
        
        if (statusMap[ack]) {
            // Find in log by phone number and pending/sent status 
            // This is a naive way to update since we didn't store message id. 
            // In a real app we'd store msg.id.id in LogNotifikasi.
            const targetPhone = msg.to.split('@')[0];
            const logEntry = await LogNotifikasi.findOne({
                where: { 
                    no_tujuan: targetPhone,
                },
                order: [['createdAt', 'DESC']]
            });
            
            if (logEntry) {
                await logEntry.update({ status: statusMap[ack] });
            }
        }
    } catch (err) {
        console.error('Error updating message ack status', err);
    }
});

// Initialize client
client.initialize();

/**
 * Queue sistem sederhana untuk mengirim pesan
 */
const messageQueue = [];
let isProcessingQueue = false;

const processQueue = async () => {
    if (isProcessingQueue || messageQueue.length === 0) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        const task = messageQueue.shift(); // Get the first task
        
        try {
            if (!isReady) {
                console.log(`⏳ Menunggu WA Gateway siap untuk mengirim pesan ke ${task.phone}...`);
                // Re-queue if not ready, wait a bit
                messageQueue.unshift(task);
                await delay(3000);
                continue;
            }

            // Format phone number
            // Ensure no '+' and no leading '0' if it's supposed to be 62...
            // the user requested international format "6281234567890"
            const formattedPhone = `${task.phone}@c.us`;

            const logEntry = await LogNotifikasi.create({
                pesan: task.message,
                no_tujuan: task.phone,
                siswa_id: task.siswaId,
                status: 'pending'
            });

            console.log(`📤 Mengirim pesan WA ke ${task.phone} ...`);
            await client.sendMessage(formattedPhone, task.message);
            
            await logEntry.update({ status: 'sent', keterangan: 'Berhasil dikirim' });
            console.log(`✅ Pesan WA terkirim ke ${task.phone}`);

        } catch (error) {
            console.error(`❌ Gagal mengirim pesan WA ke ${task.phone}:`, error);
            try {
                if (task.siswaId) {
                    await LogNotifikasi.create({
                        pesan: task.message,
                        no_tujuan: task.phone,
                        siswa_id: task.siswaId,
                        status: 'failed',
                        keterangan: error.message
                    });
                }
            } catch (dbErr) {}
        }

        // Delay 1-2 seconds between messages as requested
        await delay(1500 + Math.random() * 500); 
    }

    isProcessingQueue = false;
};

/**
 * Send WhatsApp Notification
 * @param {string} phone - Target phone number
 * @param {string} message - Message content
 * @param {number} siswaId - (Optional) Siswa ID for logging
 */
const sendWhatsAppMessage = (phone, message, siswaId = null) => {
    if (!phone) return;
    
    // Add to queue
    messageQueue.push({ phone, message, siswaId });
    
    // Process queue in background
    processQueue().catch(console.error);
};

const getWaStatus = () => {
    return { status: waStatus, qr: waQrCode };
};

module.exports = {
    client,
    sendWhatsAppMessage,
    getWaStatus
};
