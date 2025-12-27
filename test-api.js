// =====================================================
// Test API untuk debug Master Data
// =====================================================

const http = require('http');

console.log('🧪 Testing API Endpoints...\n');

// Test health check
function testHealth() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3000/api/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('✅ Health Check:', data);
                resolve();
            });
        }).on('error', (err) => {
            console.log('❌ Health Check Failed:', err.message);
            console.log('   Make sure server is running: npm run dev\n');
            reject(err);
        });
    });
}

// Test endpoints
async function testEndpoints() {
    try {
        await testHealth();
        console.log('\n📡 API Endpoints yang bisa ditest:');
        console.log('   GET  http://localhost:3000/api/master-data/kelas/all');
        console.log('   GET  http://localhost:3000/api/master-data/guru/all');
        console.log('   GET  http://localhost:3000/api/master-data/siswa/all');
        console.log('\n💡 Login credentials untuk test:');
        console.log('   Username: admin');
        console.log('   Password: admin123');
        console.log('\n🔧 Steps untuk test:');
        console.log('   1. npm run dev');
        console.log('   2. npm run seed');
        console.log('   3. Buka http://localhost:3000');
        console.log('   4. Login sebagai admin');
        console.log('   5. Klik "Master Data"');
        console.log('   6. Cek console browser (F12) untuk debug info\n');
    } catch (error) {
        console.log('\n❌ Cannot test endpoints. Please start the server first.');
    }
}

testEndpoints();
