import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import WhatsAppAgent from '../agent/WhatsAppAgent.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();


export default class WebServer {
    constructor(database) {
        this.database = database;
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.upload = multer({ dest: 'uploads/' });
        this.server = null;
        this.whatsappAgent = null

        this.setup();
    }

    setWhatsAppAgent(whatsappAgent) {
        this.whatsappAgent = whatsappAgent;
    }

    setup() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../../public')));

        // Attendance API with filters, pagination, sorting
        this.app.get('/api/attendance', async (req, res) => {
            try {
                const filters = {
                    date: req.query.date,
                    groupName: req.query.group,
                    rollNo: req.query.rollNo,
                    name: req.query.name,
                    page: req.query.page ? parseInt(req.query.page) : 1,
                    limit: req.query.limit ? parseInt(req.query.limit) : 100,
                    sortBy: req.query.sortBy,
                    sortDir: req.query.sortDir
                };
                const records = await this.database.getAttendance(filters);
                let total = records.length; // Simple total count
                res.json({ success: true, data: records, total });
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        });

        // Stats API for dashboard widgets
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.database.getStats();
                res.json({ success: true, data: stats });
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        });

        // Get all students API
        this.app.get('/api/students', async (req, res) => {
            try {
                const students = await this.database.getAllStudents();
                res.json({ success: true, data: students });
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        });

        // Get single student by rollNo
        this.app.get('/api/students/:rollNo', async (req, res) => {
            try {
                const student = await this.database.getStudentByRoll(req.params.rollNo);
                res.json({ success: true, data: student });
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        });

        // Upload Students CSV file and import
        this.app.post('/api/students/upload', this.upload.single('studentFile'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ success: false, error: 'No file uploaded' });
                }

                const students = [];
                const filePath = req.file.path;

                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        if (row.roll_no || row.rollNo || row['Roll No']) {
                            students.push({
                                rollNo: row.roll_no || row.rollNo || row['Roll No'],
                                name: row.name || row.Name || row['Student Name'] || '',
                                courseName: row.courseName || row.courseName || '',
                                semester: row.semester || row.Semester || '',
                            });
                        }
                    })
                    .on('end', async () => {
                        try {
                            await this.database.saveStudents(students);
                            fs.unlinkSync(filePath); // Remove uploaded file
                            res.json({ success: true, message: `${students.length} students imported successfully` });
                        } catch (error) {
                            res.status(500).json({ success: false, error: error.message });
                        }
                    })
                    .on('error', (error) => {
                        res.status(500).json({ success: false, error: error.message });
                    });
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        });


        this.app.post('/api/whatsapp/start', async (req, res) => {
            try {
                if (this.whatsappAgent) {
                    res.json({ success: true, message: "WhatsApp Agent is already running" })
                } else {
                    this.whatsappAgent = new WhatsAppAgent(this.database)
                    await this.whatsappAgent.start()
                    res.json({ success: true, message: "WhatsApp Agent started" })
                }
            } catch (error) {
                res.json({ success: false, message: 'Failed to start agent: ' + error.message })
            }
        })


        this.app.post('/api/whatsapp/stop', async (req, res) => {
            try {
                if (this.whatsappAgent) {
                    await this.whatsappAgent.stop()
                    this.whatsappAgent = null
                    res.json({ success: true, message: 'WhatsApp agent stopped' })
                } else {
                    res.json({ success: false, message: 'No agent running' })
                }
            } catch (error) {
                res.json({ success: false, message: 'Failed to stop agent: ' + error.message })
            }
        })

        this.app.get('/api/whatsapp/qr', (req, res) => {
            if (this.whatsappAgent && this.whatsappAgent.getLatestQr()) {
                res.json({ success: true, qr: this.whatsappAgent.getLatestQr() });
            }
            else {
                res.json({ success: false, qr: null });
            }
        })

        // WhatsApp Agent Status endpoint
        this.app.get('/api/whatsapp/status', (req, res) => {
            if (this.whatsappAgent) {
                const connectionStatus = this.whatsappAgent.getConnectionStatus();
                const status = {
                    running: true,
                    connected: connectionStatus.isConnected,
                    hasQrCode: connectionStatus.hasQrCode,
                    qrCode: connectionStatus.qrCode
                };
                res.json({ success: true, status });
            } else {
                res.json({ 
                    success: true, 
                    status: { 
                        running: false, 
                        connected: false, 
                        hasQrCode: false, 
                        qrCode: null 
                    } 
                });
            }
        })
        
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ success: true, status: 'running', timestamp: new Date().toISOString() });
        });

        // Main frontend router (SPA catch all)
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../../public/index.html'));
        });
    }

    async start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                console.log(`Server is running on port: ${this.port}`);
                resolve();
            });
        });
    }

    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('Server stopped');
                    resolve();
                });
            });
        }
    }
}
