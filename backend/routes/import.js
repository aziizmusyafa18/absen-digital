const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { Siswa, Kelas, Guru, OrangTua, Jurusan } = require('../models');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
        ];
        if (allowedTypes.includes(file.mimetype) ||
            file.originalname.endsWith('.xlsx') ||
            file.originalname.endsWith('.xls') ||
            file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file Excel (.xlsx, .xls) atau CSV yang diizinkan'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Field mapping configuration with auto-detect patterns
const fieldMappings = {
    siswa: {
        nis: {
            label: 'NIS',
            required: true,
            patterns: ['nis', 'nisn', 'no_induk', 'nomor_induk', 'no induk', 'nomor induk', 'student_id', 'id_siswa']
        },
        nama: {
            label: 'Nama Lengkap',
            required: true,
            patterns: ['nama', 'name', 'nama_lengkap', 'nama lengkap', 'nama_siswa', 'nama siswa', 'fullname', 'full_name']
        },
        kelas: {
            label: 'Kelas',
            required: true,
            patterns: ['kelas', 'class', 'ruang', 'ruang_kelas', 'ruang kelas', 'tingkat']
        },
        email: {
            label: 'Email',
            required: false,
            patterns: ['email', 'e-mail', 'mail', 'email_siswa']
        },
        phone: {
            label: 'No. Telepon',
            required: false,
            patterns: ['phone', 'telepon', 'telp', 'no_hp', 'no hp', 'no_telepon', 'no telepon', 'handphone', 'hp', 'mobile']
        }
    },
    guru: {
        username: {
            label: 'Username',
            required: true,
            patterns: ['username', 'user', 'user_name', 'akun']
        },
        nama: {
            label: 'Nama Lengkap',
            required: true,
            patterns: ['nama', 'name', 'nama_lengkap', 'nama lengkap', 'nama_guru', 'nama guru', 'fullname']
        },
        nip: {
            label: 'NIP',
            required: true,
            patterns: ['nip', 'no_pegawai', 'nomor_pegawai', 'id_guru', 'employee_id']
        },
        mapel: {
            label: 'Mata Pelajaran',
            required: true,
            patterns: ['mapel', 'mata_pelajaran', 'mata pelajaran', 'subject', 'pelajaran', 'bidang']
        },
        password: {
            label: 'Password',
            required: false,
            patterns: ['password', 'pass', 'pwd', 'sandi', 'kata_sandi']
        }
    }
};

// Auto-detect column mapping based on header names
function autoDetectMapping(headers, entityType) {
    const mapping = {};
    const fields = fieldMappings[entityType];

    if (!fields) return mapping;

    headers.forEach((header, index) => {
        const headerLower = header.toLowerCase().trim().replace(/[^a-z0-9_\s]/g, '');

        for (const [fieldKey, fieldConfig] of Object.entries(fields)) {
            // Check if already mapped
            if (mapping[fieldKey]) continue;

            // Check against patterns
            for (const pattern of fieldConfig.patterns) {
                if (headerLower === pattern ||
                    headerLower.includes(pattern) ||
                    pattern.includes(headerLower)) {
                    mapping[fieldKey] = {
                        columnIndex: index,
                        columnName: header,
                        confidence: headerLower === pattern ? 'high' : 'medium'
                    };
                    break;
                }
            }
        }
    });

    return mapping;
}

// Parse Excel file and return headers + preview data
router.post('/parse', authMiddleware, adminOnly, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'File tidak ditemukan' });
        }

        const entityType = req.body.entity_type || 'siswa';
        const filePath = req.file.path;

        // Read Excel file
        const workbook = XLSX.readFile(filePath);
        const sheetNames = workbook.SheetNames;

        // Get first sheet by default or specified sheet
        const sheetName = req.body.sheet_name || sheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ success: false, error: 'File Excel kosong' });
        }

        // Get headers (first row)
        const headers = jsonData[0].map(h => String(h || '').trim());

        // Get preview data (next 10 rows)
        const previewData = jsonData.slice(1, 11).map(row => {
            const rowData = {};
            headers.forEach((header, index) => {
                rowData[header] = row[index] !== undefined ? String(row[index]) : '';
            });
            return rowData;
        });

        // Auto-detect column mapping
        const autoMapping = autoDetectMapping(headers, entityType);

        // Get available fields for mapping
        const availableFields = fieldMappings[entityType] || {};

        // Get list of kelas for reference (if importing siswa)
        let kelasList = [];
        if (entityType === 'siswa') {
            kelasList = await Kelas.findAll({
                attributes: ['id', 'nama'],
                order: [['nama', 'ASC']]
            });
        }

        // Store file path in session/temp for later use
        const importSession = {
            filePath: filePath,
            fileName: req.file.originalname,
            sheetName: sheetName,
            totalRows: jsonData.length - 1, // Exclude header
            entityType: entityType
        };

        res.json({
            success: true,
            data: {
                importSession,
                sheetNames,
                headers,
                previewData,
                autoMapping,
                availableFields: Object.entries(availableFields).map(([key, config]) => ({
                    key,
                    label: config.label,
                    required: config.required
                })),
                kelasList: kelasList.map(k => ({ id: k.id, nama: k.nama }))
            }
        });

    } catch (error) {
        console.error('Parse error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, error: 'Gagal membaca file: ' + error.message });
    }
});

// Process import with user-confirmed mapping
router.post('/process', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { filePath, entityType, mapping, options } = req.body;

        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(400).json({ success: false, error: 'File tidak ditemukan atau sudah expired' });
        }

        const skipDuplicate = options?.skipDuplicate !== false;
        const updateExisting = options?.updateExisting === true;

        // Read Excel file
        const workbook = XLSX.readFile(filePath);
        const sheetName = req.body.sheetName || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const headers = jsonData[0];
        const dataRows = jsonData.slice(1);

        const results = {
            total: dataRows.length,
            success: 0,
            skipped: 0,
            updated: 0,
            failed: 0,
            errors: []
        };

        // Get kelas mapping for siswa import
        let kelasMap = {};
        if (entityType === 'siswa') {
            const kelasList = await Kelas.findAll();
            kelasList.forEach(k => {
                kelasMap[k.nama.toLowerCase().trim()] = k.id;
            });
        }

        // Process each row
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowNumber = i + 2; // Excel row number (1-indexed + header)

            try {
                // Build data object from mapping
                const data = {};
                let hasRequiredFields = true;
                const missingFields = [];

                for (const [fieldKey, mapConfig] of Object.entries(mapping)) {
                    if (mapConfig && mapConfig.columnIndex !== undefined) {
                        let value = row[mapConfig.columnIndex];
                        value = value !== undefined && value !== null ? String(value).trim() : '';
                        data[fieldKey] = value;
                    }
                }

                // Validate required fields
                const fields = fieldMappings[entityType];
                for (const [fieldKey, fieldConfig] of Object.entries(fields)) {
                    if (fieldConfig.required && (!data[fieldKey] || data[fieldKey] === '')) {
                        hasRequiredFields = false;
                        missingFields.push(fieldConfig.label);
                    }
                }

                if (!hasRequiredFields) {
                    results.failed++;
                    results.errors.push({
                        row: rowNumber,
                        error: `Field wajib kosong: ${missingFields.join(', ')}`,
                        data: data
                    });
                    continue;
                }

                // Process based on entity type
                if (entityType === 'siswa') {
                    // Find kelas_id
                    const kelasName = data.kelas?.toLowerCase().trim();
                    const kelas_id = kelasMap[kelasName];

                    if (!kelas_id) {
                        results.failed++;
                        results.errors.push({
                            row: rowNumber,
                            error: `Kelas "${data.kelas}" tidak ditemukan`,
                            data: data
                        });
                        continue;
                    }

                    // Check for existing
                    const existing = await Siswa.findOne({ where: { nis: data.nis } });

                    if (existing) {
                        if (updateExisting) {
                            await existing.update({
                                nama: data.nama,
                                kelas_id: kelas_id,
                                email: data.email || existing.email,
                                phone: data.phone || existing.phone
                            });
                            results.updated++;
                        } else if (skipDuplicate) {
                            results.skipped++;
                        } else {
                            results.failed++;
                            results.errors.push({
                                row: rowNumber,
                                error: `NIS ${data.nis} sudah ada`,
                                data: data
                            });
                        }
                    } else {
                        await Siswa.create({
                            nis: data.nis,
                            nama: data.nama,
                            kelas_id: kelas_id,
                            email: data.email || null,
                            phone: data.phone || null
                        });
                        results.success++;
                    }
                } else if (entityType === 'guru') {
                    const existing = await Guru.findOne({ where: { nip: data.nip } });

                    if (existing) {
                        if (updateExisting) {
                            const updateData = {
                                nama: data.nama,
                                mapel: data.mapel,
                                username: data.username
                            };
                            if (data.password) {
                                const bcrypt = require('bcrypt');
                                updateData.password = await bcrypt.hash(data.password, 10);
                            }
                            await existing.update(updateData);
                            results.updated++;
                        } else if (skipDuplicate) {
                            results.skipped++;
                        } else {
                            results.failed++;
                            results.errors.push({
                                row: rowNumber,
                                error: `NIP ${data.nip} sudah ada`,
                                data: data
                            });
                        }
                    } else {
                        const bcrypt = require('bcrypt');
                        const password = data.password || 'guru123'; // Default password
                        const hashedPassword = await bcrypt.hash(password, 10);

                        await Guru.create({
                            username: data.username,
                            password: hashedPassword,
                            nama: data.nama,
                            nip: data.nip,
                            mapel: data.mapel,
                            role: 'guru'
                        });
                        results.success++;
                    }
                }

            } catch (rowError) {
                results.failed++;
                results.errors.push({
                    row: rowNumber,
                    error: rowError.message,
                    data: row
                });
            }
        }

        // Clean up uploaded file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({
            success: true,
            message: `Import selesai: ${results.success} berhasil, ${results.updated} diupdate, ${results.skipped} dilewati, ${results.failed} gagal`,
            results
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ success: false, error: 'Gagal import data: ' + error.message });
    }
});

// Cancel import and clean up file
router.post('/cancel', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { filePath } = req.body;

        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ success: true, message: 'Import dibatalkan' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Download template
router.get('/template/:entityType', authMiddleware, adminOnly, async (req, res) => {
    try {
        const entityType = req.params.entityType;
        const fields = fieldMappings[entityType];

        if (!fields) {
            return res.status(400).json({ success: false, error: 'Tipe entity tidak valid' });
        }

        // Create workbook with template
        const wb = XLSX.utils.book_new();

        // Create headers
        const headers = Object.values(fields).map(f => f.label);

        // Sample data
        let sampleData = [];
        if (entityType === 'siswa') {
            const kelasList = await Kelas.findAll({ limit: 3 });
            sampleData = [
                ['12345', 'Ahmad Rizki', kelasList[0]?.nama || 'XII TJKT A', 'ahmad@email.com', '081234567890'],
                ['12346', 'Budi Santoso', kelasList[0]?.nama || 'XII TJKT A', 'budi@email.com', '081234567891'],
                ['12347', 'Citra Dewi', kelasList[1]?.nama || 'XII TJKT B', '', '081234567892']
            ];
        } else if (entityType === 'guru') {
            sampleData = [
                ['sari', 'Sari Indah, S.Pd', '198501012010011001', 'Matematika', 'guru123'],
                ['budi', 'Budi Hartono, M.Pd', '198601012010011002', 'Bahasa Inggris', ''],
                ['dewi', 'Dewi Lestari, S.Kom', '198701012010011003', 'Pemrograman Web', '']
            ];
        }

        const wsData = [headers, ...sampleData];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column widths
        ws['!cols'] = headers.map(() => ({ wch: 20 }));

        XLSX.utils.book_append_sheet(wb, ws, 'Data');

        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=template_${entityType}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
