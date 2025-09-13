import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Ensure your MongoDB connection string is in a .env file
// e.g., MONGODB_URI="mongodb+srv://<user>:<password>@<cluster-url>/<dbname>?retryWrites=true&w=majority"
const MONGODB_URI = process.env.MONGODB_URI;

export default class Database {
    constructor() {
        if (!MONGODB_URI) {
            throw new Error('❌ MONGODB_URI is not set in the environment variables');
        }
        this.client = new MongoClient(MONGODB_URI);
        this.db = null;
    }

    async init() {
        try {
            await this.client.connect();
            this.db = this.client.db();

            // Create collections if they don't exist
            await this.createCollections();
            console.log('✅ Connected to MongoDB Atlas');
            return true;
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            throw error;
        }
    }

    async createCollections() {
        const collections = await this.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        if (!collectionNames.includes('students')) {
            await this.db.createCollection('students');
            console.log('✅ Created students collection');
        }
        if (!collectionNames.includes('attendance')) {
            await this.db.createCollection('attendance');
            console.log('✅ Created attendance collection');
        }
    }

    // Student Methods
    async saveStudents(students) {
        const studentCollection = this.db.collection('students');
        const bulkOps = students.map(student => ({
            updateOne: {
                filter: { rollNo: student.rollNo },
                update: { $set: student },
                upsert: true
            }
        }));
        await studentCollection.bulkWrite(bulkOps);
    }

    async getStudentByRoll(rollNo) {
        const studentCollection = this.db.collection('students');
        return await studentCollection.findOne({ rollNo: rollNo });
    }

    async getAllStudents() {
        const studentCollection = this.db.collection('students');
        return await studentCollection.find({}).sort({ rollNo: 1 }).toArray();
    }

    // Attendance Methods
    async saveAttendance(data) {
        const attendanceCollection = this.db.collection('attendance');
        let name = data.studentName;

        if (!name && data.rollNo) {
            const student = await this.getStudentByRoll(data.rollNo);
            if (student && student.name) {
                name = student.name;
            }
        }

        const record = {
            studentName: name || '',
            rollNo: data.rollNo,
            courseName: data.phoneNumber || '',
            groupName: data.groupName || '',
            message: data.message || '',
            timestamp: data.timestamp || new Date(),
            date: data.timestamp ? data.timestamp.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            messageId: data.messageId || null,
            createdAt: new Date(),
        };

        const result = await attendanceCollection.updateOne(
            { messageId: record.messageId, rollNo: record.rollNo },
            { $set: record },
            { upsert: true }
        );

        return result.upsertedId || (result.modifiedCount > 0);
    }

    // Get records with filters, pagination, and sorting
    async getAttendance(filters = {}) {
        const attendanceCollection = this.db.collection('attendance');
        let query = {};

        if (filters.date) {
            query.date = filters.date;
        }

        if (filters.groupName) {
            query.groupName = { $regex: filters.groupName, $options: 'i' };
        }

        if (filters.rollNo) {
            query.rollNo = filters.rollNo;
        }

        let sort = { timestamp: -1 };
        if (filters.sortBy) {
            sort = { [filters.sortBy]: filters.sortDir === 'asc' ? 1 : -1 };
        }

        const options = {
            sort,
            limit: filters.limit ? parseInt(filters.limit) : 100,
            skip: filters.page && filters.limit ? (parseInt(filters.page) - 1) * parseInt(filters.limit) : 0,
        };

        return await attendanceCollection.find(query, options).toArray();
    }

    async getStats() {
        const attendanceCollection = this.db.collection('attendance');
        const studentCollection = this.db.collection('students');

        const totalPromise = attendanceCollection.countDocuments({});
        const todayPromise = attendanceCollection.countDocuments({ date: new Date().toISOString().split('T')[0] });
        const groupPromise = attendanceCollection.aggregate([
            { $group: { _id: '$groupName', count: { $sum: 1 } } }
        ]).toArray();
        const studentPromise = studentCollection.countDocuments({});
        const recentPromise = attendanceCollection.find({}).sort({ timestamp: -1 }).limit(10).toArray();

        const [total, today, groups, students, recent] = await Promise.all([
            totalPromise, todayPromise, groupPromise, studentPromise, recentPromise
        ]);

        return {
            total,
            today,
            groups: groups.map(g => ({ group_name: g._id, count: g.count })),
            students,
            recent
        };
    }

    async close() {
        if (this.client) {
            await this.client.close();
        }
    }
}
