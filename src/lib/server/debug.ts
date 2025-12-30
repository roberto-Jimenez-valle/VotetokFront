
// Helper for debugging
import fs from 'fs';
import path from 'path';

export function logDebug(message: string) {
    try {
        const logPath = path.join(process.cwd(), 'debug_rells.log');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `${timestamp} - ${message}\n`);
    } catch (e) {
        console.error('Failed to write log', e);
    }
}
