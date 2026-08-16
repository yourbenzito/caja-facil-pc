/**
 * User Repository
 * Handles all database operations for Users
 */
class UserRepository extends BaseRepository {
    constructor() {
        super('users');
    }

    /**
     * Find user by username
     * @param {string} username - Username
     * @returns {Promise<Object|null>}
     */
    async findByUsername(username) {
        const users = await this.findByIndex('username', username);
        return users.length > 0 ? users[0] : null;
    }

    /**
     * Find user by phone number
     * @param {string} phone - Phone number
     * @returns {Promise<Object|null>}
     */
    async findByPhone(phone) {
        try {
            const users = await this.findByIndex('phone', phone);
            return users.length > 0 ? users[0] : null;
        } catch (error) {
            // If index fails, search manually
            const allUsers = await this.findAll();
            return allUsers.find(u => u.phone === phone) || null;
        }
    }
}
