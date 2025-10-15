import puppeteer from 'puppeteer'
import dotenv from 'dotenv'

dotenv.config()

export default class CollegeWebsiteAgent {
    constructor(database) {
        this.database = database;
        this.browser = null;
        this.page = null;
        this.isRunning = false;
        console.log('CollegeWebsiteAgent initialized');
    }

    async start() {
        if (this.isRunning) {
            return { success: true, message: 'Agent already running.' };
        }

        try {
            this.browser = await puppeteer.launch({
                headless: false,
                defaultViewport: null,
                args: ['--start-maximized']
            });

            this.page = (await this.browser.pages())[0] || (await this.browser.newPage());
            this.isRunning = true;

            this.browser.on('disconnected', () => {
                this.isRunning = false;
                console.log('Browser closed.');
            });

            // --- AUTOMATED LOGIN LOGIC ---
            console.log('Navigating to college login page...');
            await this.page.goto(process.env.COLLEGE_WEBSITE_URL, { waitUntil: 'networkidle2' });

            // IMPORTANT: You MUST find the correct CSS selectors for these fields
            const USERNAME_SELECTOR = 'body > div.row.admin-logo-outer > div.col-md-4.col-sm-6.col-xs-12 > div > form.login-form > div:nth-child(2) > div > input'; // Example: <input id="username">
            const PASSWORD_SELECTOR = 'body > div.row.admin-logo-outer > div.col-md-4.col-sm-6.col-xs-12 > div > form.login-form > div:nth-child(3) > div > input'; // Example: <input id="password">
            const SUBMIT_BUTTON_SELECTOR = 'body > div.row.admin-logo-outer > div.col-md-4.col-sm-6.col-xs-12 > div > form.login-form > div.form-actions > button'; // Example: <button type="submit">

            await this.page.waitForSelector(USERNAME_SELECTOR);

            console.log('Typing credentials...');
            await this.page.type(USERNAME_SELECTOR, process.env.COLLEGE_USERNAME);
            await this.page.type(PASSWORD_SELECTOR, process.env.COLLEGE_PASSWORD);

            console.log('Clicking login button...');
            await this.page.click(SUBMIT_BUTTON_SELECTOR);
            // --- END OF AUTOMATED LOGIN ---

            // Wait for successful login navigation
            await this.page.waitForNavigation({
                timeout: 60000,
                waitUntil: 'networkidle2'
            });
            
            console.log('Login successful! Agent is ready.');
            return { success: true, message: 'Agent started and logged in successfully.' };

        } catch (error) {
            console.error('Error starting CollegeWebsiteAgent:', error);
            if (this.browser) await this.browser.close();
            this.isRunning = false;
            return { success: false, message: `Login failed: ${error.message}` };
        }
    }

    /**
     * Stops the agent and closes the browser.
     */
    async stop() {
        if (this.browser) {
            await this.browser.close();
        }
        this.isRunning = false;
        this.browser = null;
        this.page = null;
        console.log('CollegeWebsiteAgent stopped.');
        return { success: true, message: 'Agent stopped.' };
    }

    /**
     * Main function to mark attendance on the website.
     */
    async markAttendance(filters) {
        if (!this.isRunning || !this.page) {
            return { success: false, message: 'Agent is not running. Please start it first.' };
        }

        try {
            // 1. Fetch attendance data from our database
            const attendanceRecords = await this.database.getAttendance({
                date: filters.date,
                groupName: filters.groupName
            });

            if (!attendanceRecords || attendanceRecords.length === 0) {
                return { success: false, message: 'No attendance records found in DB for that date/group.' };
            }

            // 2. Navigate to the correct attendance page
            //    This URL is just a placeholder. You MUST change it.
            const attendancePageUrl = `https://college-website.com/attendance/mark?group=${filters.groupName}&date=${filters.date}`;
            await this.page.goto(attendancePageUrl, { waitUntil: 'networkidle2' });

            // 3. Loop through records and mark them
            let markedCount = 0;
            for (const record of attendanceRecords) {
                const rollNo = record.rollNo;
                
                // IMPORTANT: This selector MUST be changed to match the college website's HTML.
                // This example assumes an input checkbox with a 'data-rollno' attribute.
                const studentSelector = `input[type="checkbox"][data-rollno="${rollNo}"]`;

                // Find the element on the page
                const elementHandle = await this.page.$(studentSelector);

                if (elementHandle) {
                    // This is the highlighting function
                    await this.highlightElement(elementHandle);
                    
                    // Click the checkbox
                    await elementHandle.click();
                    
                    // Wait a moment so the user can see the action
                    await this.page.waitForTimeout(300); // 300ms delay
                    
                    markedCount++;
                } else {
                    console.warn(`Could not find element for roll no: ${rollNo}`);
                }
            }

            return { success: true, message: `Successfully marked ${markedCount} out of ${attendanceRecords.length} students.` };

        } catch (error) {
            console.error('Error marking attendance:', error);
            return { success: false, message: `Error: ${error.message}` };
        }
    }

    /**
     * Helper function to highlight an element on the page.
     */
    async highlightElement(elementHandle) {
        try {
            await elementHandle.evaluate(el => {
                // Apply a green highlight box
                el.style.outline = '3px solid #25D366';
                el.style.boxShadow = '0 0 10px #25D366';
                // Scroll the element into the middle of the screen
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            });
        } catch (e) {
            console.warn('Could not highlight element', e.message);
        }
    }
}