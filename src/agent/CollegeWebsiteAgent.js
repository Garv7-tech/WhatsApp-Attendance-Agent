import puppeteer from 'puppeteer';

export default class CollegeWebsiteAgent {
    constructor(database) {
        this.database = database;
        this.browser = null;
        this.page = null;
        this.isRunning = false;
        console.log('CollegeWebsiteAgent initialized');
    }

    /**
     * Launches a visible browser window and waits for the user to log in.
     */
    async start() {
        if (this.isRunning) {
            console.warn('CollegeWebsiteAgent is already running.');
            return { success: true, message: 'Agent already running.' };
        }

        try {
            console.log('Launching browser...');
            this.browser = await puppeteer.launch({
                headless: false, // This is key: 'false' makes the browser visible
                defaultViewport: null, // Adapts to window size
                args: ['--start-maximized'] // Starts maximized
            });

            this.page = (await this.browser.pages())[0] || (await this.browser.newPage());
            this.isRunning = true;

            // Handle browser close event
            this.browser.on('disconnected', () => {
                this.isRunning = false;
                this.browser = null;
                this.page = null;
                console.log('Browser closed by user.');
            });

            // Navigate to the login page
            console.log('Navigating to college login page...');
            await this.page.goto(process.env.COLLEGE_WEBSITE_URL, { waitUntil: 'networkidle2' });

            // Wait for the user to log in and land on the dashboard
            // We'll wait for a URL that contains 'dashboard' for up to 5 minutes
            await this.page.waitForNavigation({
                timeout: 60000,
                waitUntil: 'networkidle2'
            });

            console.log('Login successful! Agent is ready.');
            return { success: true, message: 'Agent started and logged in successfully.' };

        } catch (error) {
            console.error('Error starting CollegeWebsiteAgent:', error);
            if (this.browser) {
                await this.browser.close();
            }
            this.isRunning = false;
            return { success: false, message: `Error: ${error.message}` };
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
            await this.page.goto(process.env.COLLEGE_WEBSITE_URL, { waitUntil: 'networkidle2' });

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