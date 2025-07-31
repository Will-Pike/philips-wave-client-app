# Philips Wave Client Application

This project is a Node.js application that allows users to interact with the Philips Wave API to manage clients and devices, perform configuration checks, and apply corrections to ensure devices meet recommended settings. The application features a user-friendly interface and supports both SignJet device management and comprehensive device configuration validation.

## Features

- **Device Configuration Validation**: Check multiple devices against recommended settings
- **Streaming Batch Processing**: Process thousands of devices efficiently in batches
- **Content Source Management**: Prioritize SignJet apps with CUSTOM fallback
- **Recommended Settings Corrections**: Automatically apply Wave API recommended settings  
- **Real-time Progress Updates**: Live updates during batch operations
- **Device Matching**: Match SignJet and Wave devices by location
- **Secure Authentication**: Environment-based authentication

## Project Structure

```
philips-wave-client-app
├── src
│   ├── server.js                     # Entry point of the application
│   ├── routes
│   │   ├── index.js                  # Main application routes
│   │   └── matcher.js                # Device matching logic
│   ├── controllers
│   │   ├── clientController.js       # Client management
│   │   ├── authController.js         # Authentication handling
│   │   ├── configCheckController.js  # Configuration validation
│   │   └── configUpdateController.js # Configuration updates
│   ├── models
│   │   └── clientModel.js            # Client data structure
│   ├── views
│   │   ├── index.html                # Main user interface
│   │   ├── app.js                    # Frontend application logic
│   │   └── styles.css                # UI styles
│   └── utils
│       ├── awsHelper.js              # AWS utility functions
│       └── waveApi.js                # Wave API GraphQL client
├── .env.example                      # Environment variables template
├── package.json                      # npm configuration
└── README.md                         # Project documentation
```

## Setup Instructions

### 1. Clone the repository
```bash
git clone <repository-url>
cd philips-wave-client-app
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual values:
# WAVE_API_KEY=Basic YOUR_WAVE_API_KEY_HERE
# LOGIN_PASSWORD=your_secure_password_here
# PORT=3000
```

### 4. Run the application
```bash
npm start
```

### 5. Access the application
Open your browser and navigate to `http://localhost:3000`

## Deployment

### Environment Variables Required
- `WAVE_API_KEY`: Your Wave API authentication key
- `LOGIN_PASSWORD`: Secure password for application access
- `PORT`: Server port (defaults to 3000)

### Production Deployment
1. Set environment variables on your server
2. Ensure Node.js is installed
3. Run `npm install --production`
4. Start with `npm start`

## Usage Guidelines

### Configuration Checking
- Upload device lists or use API to fetch devices
- Select configuration checks to perform
- Monitor real-time progress during batch processing
- Review results and apply corrections as needed

### Content Source Preferences
- **Current Source**: SignJet (preferred) → CUSTOM (acceptable)
- **Default Source**: SignJet (preferred) → CUSTOM (acceptable)
- Automatic fallback handling when SignJet unavailable

### Device Matching
- Match SignJet devices with Wave API devices by location
- Fuzzy matching for similar names and addresses
- Export matched results for further processing
- Send commands to the devices as needed.

## Deployment

This application can be deployed on AWS. Refer to the `awsHelper.js` for utility functions that assist with AWS resource management.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.