/**
 * Password Reset Model
 * Manages password reset attempts, logging, and rate limiting
 */
class PasswordReset {
    static _repository = new PasswordResetRepository();
    
    // Maximum reset attempts per hour
    static MAX_ATTEMPTS_PER_HOUR = 5;
    
    /**
     * Log a password reset attempt
     * @param {Object} data - Attempt data
     * @param {number} data.userId - User ID (null if user not found)
     * @param {string} data.method - Reset method ('adminPIN' or 'recoveryCode')
     * @param {boolean} data.success - Whether the attempt was successful
     * @param {string} data.ipAddress - IP address (use 'local' for offline apps)
     * @param {string} data.notes - Additional notes
     * @returns {Promise<number>} - Reset attempt ID
     */
    static async logAttempt(data) {
        const attempt = {
            userId: data.userId || null,
            method: data.method || 'unknown',
            success: data.success || false,
            ipAddress: data.ipAddress || 'local',
            date: new Date().toISOString(),
            notes: data.notes || ''
        };
        
        return await this._repository.create(attempt);
    }
    
    /**
     * Check if reset attempts are rate limited
     * @param {string} ipAddress - IP address (optional)
     * @returns {Promise<boolean>} - True if rate limited
     */
    static async isRateLimited(ipAddress = 'local') {
        const recentFailed = await this._repository.countRecentFailedAttempts(ipAddress);
        return recentFailed >= this.MAX_ATTEMPTS_PER_HOUR;
    }
    
    /**
     * Get reset attempt history for a user
     * @param {number} userId - User ID
     * @returns {Promise<Array>}
     */
    static async getHistory(userId) {
        return await this._repository.findByUserId(userId);
    }
    
    /**
     * Get all recent reset attempts
     * @param {string} ipAddress - IP address (optional)
     * @returns {Promise<Array>}
     */
    static async getRecentAttempts(ipAddress = 'local') {
        return await this._repository.findRecentAttempts(ipAddress);
    }
}
