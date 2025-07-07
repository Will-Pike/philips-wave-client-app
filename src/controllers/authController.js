// src/controllers/authController.js
module.exports = {
    login: (req, res) => {
        const { password } = req.body;
        // In production, use env vars and hashing
        const CORRECT_PASSWORD = process.env.LOGIN_PASSWORD || 'rj2Y7#jV*5updA';
        if (password === CORRECT_PASSWORD) {
            // Optionally, set a session or JWT here
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Incorrect password.' });
        }
    }
};
