const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
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
        const filePath = path.normalize(req.file.path);

        console.log('Reading file:', filePath);

        if (!fs.existsSync(filePath)) {
            return res.status(400).json({ success: false, error: 'File tidak ditemukan di server' });
        }

        // Read Excel file with exceljs
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        const worksheet = req.body.sheet_name ? 
            workbook.getWorksheet(req.body.sheet_name) : 
            workbook.worksheets[0];

        if (!worksheet) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ success: false, error: 'Sheet tidak ditemukan' });
        }

        const jsonData = [];
        worksheet.eachRow((row, rowNumber) => {
            const rowValues = [];
            // row.values returns 1-indexed array, first element is undefined
            for (let i = 1; i <= worksheet.columnCount; i++) {
                rowValues.push(row.getCell(i).text || '');
            }
            jsonData.push(rowValues);
        });

        if (jsonData.length === 0) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ success: false, error: 'File Excel kosong' });
        }

        const headers = jsonData[0].map(h => String(h || '').trim());

        const previewData = jsonData.slice(1, 11).map(row => {
            const rowData = {};
            headers.forEach((header, index) => {
                rowData[header] = row[index] !== undefined ? String(row[index]) : '';
            });
            return rowData;
        });

        const autoMapping = autoDetectMapping(headers, entityType);
        const availableFields = fieldMappings[entityType] || {};

        let kelasList = [];
        if (entityType === 'siswa') {
            kelasList = await Kelas.findAll({
                attributes: ['id', 'nama'],
                order: [['nama', 'ASC']]
            });
        }

        const importSession = {
            filePath: filePath,
            fileName: req.file.originalname,
            sheetName: worksheet.name,
            totalRows: jsonData.length - 1,
            entityType: entityType
        };

        res.json({
            success: true,
            data: {
                importSession,
                sheetNames: workbook.worksheets.map(ws => ws.name),
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
        const normalizedPath = path.normalize(filePath);

        if (!normalizedPath || !fs.existsSync(normalizedPath)) {
            return res.status(400).json({ success: false, error: 'File tidak ditemukan atau sudah expired' });
        }

        const skipDuplicate = options?.skipDuplicate !== false;
        const updateExisting = options?.updateExisting === true;

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(normalizedPath);
        
        const worksheet = req.body.sheetName ? 
            workbook.getWorksheet(req.body.sheetName) : 
            workbook.worksheets[0];

        const jsonData = [];
        worksheet.eachRow((row, rowNumber) => {
            const rowValues = [];
            for (let i = 1; i <= worksheet.columnCount; i++) {
                rowValues.push(row.getCell(i).text || '');
            }
            jsonData.push(rowValues);
        });

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

        let kelasMap = {};
        const kelasList = await Kelas.findAll();
        kelasList.forEach(k => {
            kelasMap[k.nama.toLowerCase().trim()] = k.id;
        });

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowNumber = i + 2;

            try {
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

                if (entityType === 'siswa') {
                    const kelasName = data.kelas?.toLowerCase().trim();
                    const kelas_id = kelasMap[kelasName];

                    if (!kelas_id) {
                        results.failed++;
                        results.errors.push({
                            row: rowNumber,
                            error: `Kelas "${data.kelas}" tidak ditemukan di database.`,
                            data: data
                        });
                        continue;
                    }

                    let existing = await Siswa.findOne({ where: { nis: data.nis } });

                    if (existing) {
                        if (updateExisting) {
                            await existing.update({
                                nama: data.nama,
                                kelas_id: kelas_id,
                                kelamin: data.kelamin || existing.kelamin,
                                status: data.status || existing.status
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
                            kelamin: data.kelamin || null,
                            status: data.status || 'aktif'
                        });
                        results.success++;
                    }
                } else if (entityType === 'guru') {
                    const [guru, created] = await Guru.findOrCreate({
                        where: { nip: data.nip },
                        defaults: {
                            nama: data.nama,
                            username: data.username,
                            password: data.password || 'guru123',
                            mapel: '-',
                            role: 'guru'
                        }
                    });

                    if (created) {
                        if (!data.username) {
                            results.failed++;
                            results.errors.push({ row: rowNumber, error: `Username wajib diisi untuk guru baru.` });
                            await guru.destroy();
                            continue;
                        }
                        const bcrypt = require('bcryptjs');
                        guru.password = await bcrypt.hash(guru.password, 10);
                        await guru.save();
                        results.success++;
                    } else {
                        if (updateExisting && data.nama && guru.nama !== data.nama) {
                           await guru.update({ nama: data.nama });
                        }
                    }

                    const kelasName = data.kelas?.toLowerCase().trim();
                    const kelas_id = kelasMap[kelasName];

                    if (!kelas_id) {
                        results.failed++;
                        results.errors.push({ row: rowNumber, error: `Kelas "${data.kelas}" tidak ditemukan.` });
                        continue;
                    }

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
                             results.errors.push({ row: rowNumber, error: `Jadwal mengajar sudah ada.` });
                        }
                    } else {
                        await GuruKelas.create({
                            guru_id: guru.id,
                            kelas_id: kelas_id,
                            jam_mulai: data.jam_mulai,
                            mata_pelajaran: data.mapel
                        });
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

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data');

        const headers = Object.values(fields).map(f => f.label);
        worksheet.addRow(headers);

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
                ['198501012010011001', 'Sari Indah, S.Pd', 'sari.indah', 'guru123', kelasContoh1, 'Matematika', '07:00'],
                ['198501012010011001', 'Sari Indah, S.Pd', '', '', kelasContoh2, 'Matematika', '09:00'],
                ['198601012010011002', 'Budi Hartono, M.Pd', 'budi.hartono', '', kelasContoh3, 'Bahasa Inggris', '08:00'],
            ];
        }

        sampleData.forEach(row => worksheet.addRow(row));
        
        // Auto-fit column width
        worksheet.columns.forEach(column => {
            column.width = 20;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=template_${entityType}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;


module.exports = router;
