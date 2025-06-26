# Philips Wave Client Application

This project is a Node.js application that allows users to interact with the Philips Wave API to select clients and devices, and send commands to those devices. The application features a user-friendly interface and is designed to be hosted on AWS.

## Project Structure

```
philips-wave-client-app
├── src
│   ├── server.js            # Entry point of the application
│   ├── routes
│   │   └── index.js        # Defines application routes
│   ├── controllers
│   │   └── clientController.js # Handles client-related logic
│   ├── models
│   │   └── clientModel.js   # Defines client data structure
│   ├── views
│   │   ├── index.html       # User interface for selecting clients and devices
│   │   └── styles.css       # Styles for the user interface
│   └── utils
│       └── awsHelper.js     # Utility functions for AWS interactions
├── package.json             # npm configuration file
└── README.md                # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd philips-wave-client-app
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Run the application:**
   ```
   npm start
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:3000`.

## Usage Guidelines

- Use the interface to select clients from the Philips Wave application.
- Choose devices from the selected clients' locations.
- Send commands to the devices as needed.

## Deployment

This application can be deployed on AWS. Refer to the `awsHelper.js` for utility functions that assist with AWS resource management.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.