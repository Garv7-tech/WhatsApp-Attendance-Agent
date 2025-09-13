export default class MessageParser {

    constructor() {
        this.patterns = [

            { regex: /^(.+?)\s+(\d+)$/, nameGroup: 1, rollGroup: 2 }, // Example : "FName LName 221099"

            { regex: /^(?:[A-Za-z]+)\s+(\d{4,})$/, nameGroup: 1, rollGroup: 2 }, // Example : "Name 221099"

            { regex: /^(\d{4,})\s*$/, nameGroup: null, rollGroup: 1 }, // Example : "12345"
        ];
    }

    parseAttendanceMultiple(messageText) {
        if (!messageText || typeof messageText !== 'string') return []

        let matches = []
        for (const pattern of this.patterns) {
            let result
            while ((result = pattern.regex.exec(messageText)) !== null) {
                matches.push({
                    name: pattern.nameGroup ? result[pattern.nameGroup]?.trim() : null,
                    rollNo: result[pattern.rollGroup]?.trim(),
                    originalMessage: messageText
                })
            }
            // Reset regex index for next pattern
            pattern.regex.lastIndex = 0
        }
        return matches
    }
}
