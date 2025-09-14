# Fitness Booking Platform

A multi-brand fitness booking platform that enables fitness businesses to manage their classes and sessions while providing clients with a unified interface to discover and book fitness services.

## Features

- **Multi-brand Support**: Multiple fitness brands can operate on the same platform
- **Direct Payments**: Brands receive payments directly to their Stripe accounts
- **Flexible Booking**: Support for both credit-based and subscription-based booking models
- **Session Management**: Comprehensive class and session scheduling
- **Real-time Availability**: Live capacity tracking and booking management

## Tech Stack

- **Backend**: Node.js with TypeScript and Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with bcrypt password hashing
- **Payments**: Stripe Connect for direct brand payments
- **File Storage**: Cloudinary for image uploads
- **Testing**: Jest with MongoDB Memory Server

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local installation or MongoDB Atlas)
- Stripe account for payment processing

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fitness-booking-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration values
```

4. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in your .env file).

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm start` - Start the production server
- `npm test` - Run the test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix

## API Endpoints

### Health Check
- `GET /health` - Server health status
- `GET /api` - API information

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route handlers
├── middleware/      # Express middleware
├── models/          # Mongoose schemas
├── routes/          # Route definitions
├── services/        # Business logic
├── utils/           # Utility functions
├── test/            # Test setup and utilities
├── app.ts           # Express app configuration
└── server.ts        # Server entry point
```

## Environment Variables

See `.env.example` for all required environment variables.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License.