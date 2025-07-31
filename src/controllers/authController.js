// src/controllers/authController.js
module.exports = {
    login: (req, res) => {
        const { password } = req.body;
        // Use environment variable for production security
        const CORRECT_PASSWORD = process.env.LOGIN_PASSWORD;
        
        if (!CORRECT_PASSWORD) {
            return res.status(500).json({ success: false, message: 'Server configuration error.' });
        }
        
        if (password === CORRECT_PASSWORD) {
            // Optionally, set a session or JWT here
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Incorrect password.' });
        }
    }
};
