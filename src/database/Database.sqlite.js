import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export default class Database {

    constructor() {
        this.db = null
        this.dbPath = './attendance.db'
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) reject(err)
                else this.createTables().then(resolve).catch(reject)
            })
        })
    }

    async createTables() {
        const createStudentTable = `
            CREATE TABLE IF NOT EXISTS students(
                rollNo TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                courseName TEXT,
                semester TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `

        const createAttendanceTable = `
            CREATE TABLE IF NOT EXISTS attendance(
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            studentName TEXT NOT NULL,
                            rollNo TEXT,
                            courseName TEXT,
                            groupName TEXT,
                            message TEXT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                            date DATE DEFAULT (date('now')),
                            messageId TEXT UNIQUE,
                            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(messageId, rollNo)
                        );
        `

        const createIndexes = `
            CREATE INDEX IF NOT EXISTS idx_rollNo_attendance ON attendance(rollNo);
            CREATE INDEX IF NOT EXISTS idx_date_attendance ON attendance(date);
            CREATE INDEX IF NOT EXISTS idx_groupName_attendance ON attendance(groupName);
            CREATE INDEX IF NOT EXISTS idx_student_roll ON students(rollNo);
        `

        return new Promise((resolve, reject) => {
            this.db.exec(
                createStudentTable + createAttendanceTable + createIndexes,
                (err) => (err ? reject(err) : resolve())
            )
        })
    }

    // Student Methods
    async saveStudents(students) {
        const query = `INSERT OR REPLACE INTO students(rollNo, name, courseName, semester)
            VALUES (?,?,?,?)`

        for (const student of students) {
            await new Promise((resolve, reject) => {
                this.db.run(
                    query,
                    [
                        student.rollNo,
                        student.name,
                        student.courseName || '',
                        student.semester || ''
                    ],
                    function (err) {
                        if (err) reject(err)
                        else resolve(this.lastID)
                    }
                )
            })
        }
    }

    async getStudentByRoll(rollNo) {
        return new Promise((res, rej) => {
            this.db.get(
                'SELECT * FROM students WHERE rollNo = ?',
                [rollNo],
                (err, row) => (err ? reject(err) : resolve(row))
            );
        })
    }

    async getAllStudents() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM students ORDER BY rollNo', (err, rows) =>
                err ? reject(err) : resolve(rows)
            );
        });
    }


    // Attendance Methods

    async saveAttendance(data) {
        let name = data.studentName;
        // If studentName not filled but rollNo present, fill from student database if possible
        if ((!name || name.trim() === "") && data.rollNo) {
            const ref = await this.getStudentByRoll(data.rollNo);
            if (ref && ref.name) {
                name = ref.name;
            }
        }
        const query = `
        INSERT OR IGNORE INTO attendance (studentName, rollNo, courseName, groupName, message, timestamp, date, messageId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
        return new Promise((resolve, reject) => {
            this.db.run(
                query,
                [
                    name || '',
                    data.rollNo,
                    data.phoneNumber || '',
                    data.groupName || '',
                    data.message || '',
                    (data.timestamp instanceof Date ? data.timestamp.toISOString() : data.timestamp) || new Date().toISOString(),
                    (data.timestamp instanceof Date ? data.timestamp.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                    data.messageId || null
                ],
                function (err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, changes: this.changes });
                }
            );
        }
        )
    }

    // Get records from the database with optional filters
    async getAttendance(filters = {}) { // if no argument is given then by default takes an empty object

        //1. Start base SQL query to get all attendance rows
        let query = `SELECT * FROM attendance`
        let params = []
        let conditions = []

        // 2. If date filter is given by user, add WHERE condition
        if (!filters.date) {
            conditions.push('date =?')
            params.push(filters.date)
        }

        // 3. If groupName filter is requested, add LIKE condition
        if (filters.groupName) {
            conditions.push('groupName LIKE ?')
            params.push(`%${filters.groupName}%`)
        }

        // 4. If rollNo is provided, add WHERE condition
        if (filters.rollNo) {
            conditions.push('rollNo = ?')
            params.push(filters.rollNo)
        }

        // 5. If any conditions are present, create WHERE clauses
        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(` AND `)
        }

        // Sorting
        if (filters.sortBy && ['studentName', 'rollNo', 'groupName', 'date', 'timestamp'].includes(filters.sortBy)) {
            query += ` ORDER BY ${filters.sortBy} ${filters.sortDir === 'asc' ? 'ASC' : 'DESC'}`;
        } else {
            query += ' ORDER BY timestamp DESC';
        }
        // Pagination
        if (filters.limit) {
            query += ` LIMIT ${parseInt(filters.limit)}`;
            if (filters.page && filters.page > 1) {
                query += ` OFFSET ${(parseInt(filters.page) - 1) * parseInt(filters.limit)}`;
            }
        }


        // 8. Actually run the SQL query, return matching rows as JS array
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) reject(err)
                else resolve(rows)
            })
        })

    }

    async getStats() {
        const totalPromise = new Promise((resolve, reject) =>
            this.db.get('SELECT COUNT(*) as count FROM attendance', (err, row) =>
                err ? reject(err) : resolve(row?.count || 0)
            )
        );
        const todayPromise = new Promise((resolve, reject) =>
            this.db.get('SELECT COUNT(*) as count FROM attendance WHERE date = date("now")', (err, row) =>
                err ? reject(err) : resolve(row?.count || 0)
            )
        );
        const groupPromise = new Promise((resolve, reject) =>
            this.db.all('SELECT groupName, COUNT(*) as count FROM attendance GROUP BY groupName', (err, rows) =>
                err ? reject(err) : resolve(rows)
            )
        );
        const studentPromise = new Promise((resolve, reject) =>
            this.db.get('SELECT COUNT(*) as count FROM students', (err, row) =>
                err ? reject(err) : resolve(row?.count || 0)
            )
        );
        const recentPromise = new Promise((resolve, reject) =>
            this.db.all('SELECT * FROM attendance ORDER BY timestamp DESC LIMIT 10', (err, rows) =>
                err ? reject(err) : resolve(rows)
            )
        );

        const [total, today, groups, students, recent] = await Promise.all([
            totalPromise, todayPromise, groupPromise, studentPromise, recentPromise
        ]);
        return { total, today, groups, students, recent };
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close(resolve);
            });
        }
    }

}
