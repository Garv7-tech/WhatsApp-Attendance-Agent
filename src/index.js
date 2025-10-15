import WhatsAppAgent from './agent/WhatsAppAgent.js'
import CollegeWebsiteAgent from './agent/CollegeWebsiteAgent.js';
import WebServer from './server/WebServer.js'
import Database from './database/Database.js'

class AttendanceSystem{
    constructor(){
        console.log(`🚀 Starting WhatsApp Attendance System...`)
        this.database = new Database()
        this.webserver = new WebServer(this.database)
        this.whatsappAgent = new WhatsAppAgent(this.database)
        this.collegeWebsiteAgent = new CollegeWebsiteAgent(this.database)
    }

    async start(){
        try {
            // Initialize Database
            await this.database.init()
            console.log(`✅Database Initialized`)

            // Pass WhatsApp agent to WebServer BEFORE starting anything
            this.webserver.setWhatsAppAgent(this.whatsappAgent)
            this.webserver.setCollegeWebsiteAgent(this.collegeWebsiteAgent)

            // Start WebServer
            await this.webserver.start()
            console.log(`✅ Web Server started`)

            // Start WhatsApp Agent
            await this.whatsappAgent.start()
            console.log(`✅ WhatsApp Agent started`)

            console.log(`\n🎉 System is ready!`)
            console.log(`\n📱 Scan QR code to connect WhatsApp`)

        } catch (error) {
            console.error(`❌ System startup failed: ${error}`)
            process.exit(1)
        }
    }
}

// Start the system
const system = new AttendanceSystem()
system.start()