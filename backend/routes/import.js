const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { Siswa, Kelas, Guru, OrangTua, Jurusan, GuruKelas } = require('../models');

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
        kelamin: {
            label: 'Jenis Kelamin',
            required: false,
            patterns: ['jenis_kelamin', 'jenis kelamin', 'kelamin', 'gender', 'jk']
        },
        status: {
            label: 'Status',
            required: false,
            patterns: ['status', 'stat', 'keadaan', 'kondisi']
        }
    },
    guru: {
        nip: {
            label: 'NIP',
            required: true,
            patterns: ['nip', 'no_pegawai', 'nomor_pegawai', 'id_guru', 'employee_id']
        },
        nama: {
            label: 'Nama Lengkap',
            required: true,
            patterns: ['nama', 'name', 'nama_lengkap', 'nama lengkap', 'nama_guru', 'nama guru', 'fullname']
        },
        username: {
            label: 'Username (wajib untuk guru baru)',
            required: false,
            patterns: ['username', 'user', 'user_name', 'akun']
        },
        password: {
            label: 'Password (opsional)',
            required: false,
            patterns: ['password', 'pass', 'pwd', 'sandi', 'kata_sandi']
        },
        kelas: {
            label: 'Kelas',
            required: true,
            patterns: ['kelas', 'class', 'mengajar_kelas']
        },
        mapel: {
            label: 'Mata Pelajaran',
            required: true,
            patterns: ['mapel', 'mata_pelajaran', 'mata pelajaran', 'subject', 'pelajaran', 'bidang']
        },
        jam_mulai: {
            label: 'Jam Mulai',
            required: true,
            patterns: ['jam_mulai', 'jam mulai', 'mulai_mengajar', 'start_time']
        }
    },
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
        // Normalize path untuk Windows
        const filePath = path.normalize(req.file.path);

        console.log('Reading file:', filePath);

        // Verify file exists
        if (!fs.existsSync(filePath)) {
            return res.status(400).json({ success: false, error: 'File tidak ditemukan di server' });
        }

        // Read Excel file
        const workbook = XLSX.readFile(filePath, { type: 'file' });
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
        if (req.file) {
            const tempPath = path.normalize(req.file.path);
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
        res.status(500).json({ success: false, error: 'Gagal membaca file: ' + error.message });
    }
});

// Process import with user-confirmed mapping
router.post('/process', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { filePath, entityType, mapping, options } = req.body;

        console.log('=== PROCESS IMPORT ===');
        console.log('filePath received:', filePath);
        console.log('mapping received:', JSON.stringify(mapping, null, 2));

        // Normalize path untuk Windows
        const normalizedPath = path.normalize(filePath);

        console.log('normalizedPath:', normalizedPath);
        console.log('exists:', fs.existsSync(normalizedPath));

        if (!normalizedPath || !fs.existsSync(normalizedPath)) {
            return res.status(400).json({ success: false, error: 'File tidak ditemukan atau sudah expired' });
        }

        const skipDuplicate = options?.skipDuplicate !== false;
        const updateExisting = options?.updateExisting === true;

        // Read Excel file
        const workbook = XLSX.readFile(normalizedPath, { type: 'file' });
        const sheetName = req.body.sheetName || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log('Headers in file:', jsonData[0]);
        console.log('Total data rows:', jsonData.length - 1);

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

        // Get kelas mapping for both siswa and guru import
        let kelasMap = {};
        const kelasList = await Kelas.findAll();
        console.log('Kelas yang tersedia:', kelasList.map(k => ({ nama: k.nama, id: k.id })));
        kelasList.forEach(k => {
            kelasMap[k.nama.toLowerCase().trim()] = k.id;
        });
        console.log('Kelas Map:', kelasMap);


        console.log('Mapping yang diterima:', mapping);
        console.log('Total baris data:', dataRows.length);

        // Process each row
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowNumber = i + 2; // Excel row number (1-indexed + header)

            console.log(`Processing row ${rowNumber}:`, row);

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

                console.log(`Row ${rowNumber} - Mapped data:`, data);

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
                    console.log(`Row ${rowNumber} - Gagal: Field wajib kosong`);
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
                            error: `Kelas "${data.kelas}" tidak ditemukan di database. Pastikan kelas sudah dibuat!`,
                            data: data
                        });
                        continue;
                    }

                    // Validate email - jika bukan format email, set ke null
                    let emailValue = data.email || null;
                    if (emailValue && (!emailValue.includes('@') || !emailValue.includes('.'))) {
                        console.log(`Row ${rowNumber} - Email "${emailValue}" tidak valid, di-set ke null`);
                        emailValue = null;
                    }

                    // Check for existing
                    let existing = null;
                    let isDuplicate = false;
                    try {
                        existing = await Siswa.findOne({ where: { nis: data.nis } });
                    } catch (e) {
                        console.error(`Row ${rowNumber} - Error checking existing:`, e);
                    }

                    if (existing) {
                        if (updateExisting) {
                            try {
                                await existing.update({
                                    nama: data.nama,
                                    kelas_id: kelas_id,
                                    kelamin: data.kelamin || existing.kelamin,
                                    status: data.status || existing.status
                                });
                                results.updated++;
                            } catch (e) {
                                results.failed++;
                                results.errors.push({
                                    row: rowNumber,
                                    error: `Update failed: ${e.message}`,
                                    data: data
                                });
                                continue;
                            }
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
                        try {
                            await Siswa.create({
                                nis: data.nis,
                                nama: data.nama,
                                kelas_id: kelas_id,
                                kelamin: data.kelamin || null,
                                status: data.status || 'aktif'
                            });
                            results.success++;
                            console.log(`Row ${rowNumber} - Berhasil: ${data.nama}`);
                        } catch (e) {
                            results.failed++;
                            results.errors.push({
                                row: rowNumber,
                                error: `Create failed: ${e.message}`,
                                data: data
                            });
                            continue;
                        }
                    }
                } else if (entityType === 'guru') {
                    // This logic processes one teaching assignment (GuruKelas) per row.
                    
                    // 1. Find or Create the Guru
                    const [guru, created] = await Guru.findOrCreate({
                        where: { nip: data.nip },
                        defaults: {
                            nama: data.nama,
                            username: data.username,
                            password: data.password || 'guru123', // Default password if needed
                            mapel: '-', // Default value, as mapel is now per-assignment
                            role: 'guru'
                        }
                    });

                    // If a new guru was created, hash the password
                    if (created) {
                        if (!data.username) {
                            results.failed++;
                            results.errors.push({ row: rowNumber, error: `Username wajib diisi untuk guru baru dengan NIP ${data.nip}.` });
                            // Rollback guru creation by destroying it
                            await guru.destroy();
                            continue;
                        }
                        const bcrypt = require('bcryptjs');
                        guru.password = await bcrypt.hash(guru.password, 10);
                        await guru.save();
                        results.success++; // Count guru creation as a success
                    } else {
                        // If guru exists, optionally update their name
                        if (updateExisting && data.nama && guru.nama !== data.nama) {
                           await guru.update({ nama: data.nama });
                           // We don't count this as an "update" in the results unless the assignment is also updated.
                        }
                    }

                    // 2. Find the Kelas
                    const kelasName = data.kelas?.toLowerCase().trim();
                    const kelas_id = kelasMap[kelasName];

                    if (!kelas_id) {
                        results.failed++;
                        results.errors.push({ row: rowNumber, error: `Kelas "${data.kelas}" tidak ditemukan.` });
                        continue;
                    }

                    // 3. Create the GuruKelas assignment
                    const assignmentData = {
                        guru_id: guru.id,
                        kelas_id: kelas_id,
                        jam_mulai: data.jam_mulai,
                        mata_pelajaran: data.mapel
                    };

                    const existingAssignment = await GuruKelas.findOne({
                        where: {
                            guru_id: guru.id,
                            kelas_id: kelas_id,
                            jam_mulai: data.jam_mulai
                        }
                    });

                    if (existingAssignment) {
                        if (updateExisting) {
                            await existingAssignment.update({ mata_pelajaran: data.mapel });
                            results.updated++;
                        } else if (skipDuplicate) {
                            results.skipped++;
                        } else {
                             results.failed++;
                             results.errors.push({ row: rowNumber, error: `Jadwal mengajar untuk guru ini di kelas dan jam yang sama sudah ada.` });
                        }
                    } else {
                        await GuruKelas.create(assignmentData);
                        // Only count as success if the guru wasn't just created (as that was already counted)
                        if (!created) results.success++;
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
        if (fs.existsSync(normalizedPath)) {
            fs.unlinkSync(normalizedPath);
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
        const normalizedPath = path.normalize(filePath);

        if (normalizedPath && fs.existsSync(normalizedPath)) {
            fs.unlinkSync(normalizedPath);
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
                ['12345', 'Ahmad Rizki', kelasList[0]?.nama || 'XII TJKT A', 'Laki-laki', 'aktif'],
                ['12346', 'Budi Santoso', kelasList[0]?.nama || 'XII TJKT A', 'Laki-laki', 'aktif'],
                ['12347', 'Citra Dewi', kelasList[1]?.nama || 'XII TJKT B', 'Perempuan', 'aktif']
            ];
        } else if (entityType === 'guru') {
            const kelasList = await Kelas.findAll({ limit: 3, order: [['nama', 'ASC']] });
            const kelasContoh1 = kelasList[0]?.nama || 'X TJKT A';
            const kelasContoh2 = kelasList[1]?.nama || 'X TJKT B';
            const kelasContoh3 = kelasList[2]?.nama || 'XI TJKT A';

            sampleData = [
                // nip, nama, username, password, kelas, mapel, jam_mulai
                ['198501012010011001', 'Sari Indah, S.Pd', 'sari.indah', 'guru123', kelasContoh1, 'Matematika', '07:00'],
                ['198501012010011001', 'Sari Indah, S.Pd', '', '', kelasContoh2, 'Matematika', '09:00'],
                ['198601012010011002', 'Budi Hartono, M.Pd', 'budi.hartono', '', kelasContoh3, 'Bahasa Inggris', '08:00'],
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
