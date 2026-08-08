# Autonomous AI Creator - Backend

This is the backend service for the Autonomous AI Creator system, built using Node.js, Express, and TypeScript.

## Folder Structure

```text
backend/
├── src/
│   ├── config/          # Configuration loader (environment variables)
│   ├── controllers/     # Route handlers/controllers
│   ├── middleware/      # Custom Express middleware (errorHandler, notFound)
│   ├── routes/          # Express router configurations
│   ├── services/        # Business logic services (for future stages)
│   ├── models/          # Data schemas/models (for future stages)
│   ├── utils/           # Utility functions (for future stages)
│   └── server.ts        # App bootstrap and initialization
├── tests/               # Jest integration/unit tests
├── package.json         # NPM packages and script definitions
├── tsconfig.json        # TypeScript configuration options
├── .env.example         # Environment template file
└── README.md            # This documentation file
```

## Setup Instructions

### 1. Installation
Install the project dependencies using npm:
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file from the example:
```bash
cp .env.example .env
```
Ensure the port and CORS origin settings match your development requirements.

### 3. Development Mode
Run the development server with live reloading:
```bash
npm run dev
```

### 4. Build Project
Compile TypeScript code to production-ready Javascript in the `dist/` directory:
```bash
npm run build
```

### 5. Production Start
Run the compiled server:
```bash
npm start
```

### 6. Run Tests
Run the Jest test suite:
```bash
npm test
```

## API Endpoints

- **GET `/health`**: Returns HTTP status 200 and `{ "status": "ok" }`.
