import pkg from 'whatsapp-web.js'
const { Client, LocalAuth } = pkg

import qrcode from 'qrcode-terminal'
import MessageParser from './MessageParser.js'

export default class WhatsAppAgent {
    constructor(database) {
        this.database = database
        this.parser = new MessageParser()
        this.isReady = false;
        this.isConnected = false;
        this.qrcode = null

        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: "attendance-agent",
                dataPath: "./.wwebjs_auth"
            }), // use local storage for sessions so login is persistent
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        })

        this.setupEventHandlers()
    }

    setupEventHandlers() {
        this.client.on('qr', qr => {
            this.qrcode = qr
            console.clear()
            // Show QR in terminal for initial login
            qrcode.generate(qr, {
                small: true,
            })
        })

        this.client.on('ready', () => {
            console.log(`✅ WhatsApp connected`)
            this.isConnected = true;
            this.qrcode = null
        })

        this.client.on('message', async (msg) => {

            try {

                // Only group messages
                console.log('Event message fired');
                console.log('Message body:', msg.body);
                const chat = await msg.getChat()
                if (!chat.isGroup) return
                
                // Parse Attendance
                const attendanceList = this.parser.parseAttendanceMultiple(msg.body)

                // Save record
                if (attendanceList.length > 0) {
                    for (const attendanceData of attendanceList) {
                        await this.database.saveAttendance({
                            studentName: attendanceData.name,
                            rollNo: attendanceData.rollNo,
                            groupName: chat.name,
                            message: msg.body,
                            timestamp: new Date(),
                            messageId: `${msg.id._serialized}-${attendanceData.rollNo}` // Unique per student per message
                        })

                        console.log(`✅ Recorded : ${attendanceData.name} (${attendanceData.rollNo})`)
                    }
                }
            } catch (error) {
                console.error(`Error handling messages : ${error}`)
            }
        })

        this.client.on('auth_failure', (err) => {
            console.error(`❌ Auth failure, ${err}`)
        })
    }

    getLatestQr(){
        return this.qrcode
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            hasQrCode: !!this.qrcode,
            qrCode: this.qrcode
        };
    }
    
    start() {
        return this.client.initialize()
    }
    stop(){
        this.isConnected = false;
        this.qrcode = null;
        return this.client.destroy()
    }
}