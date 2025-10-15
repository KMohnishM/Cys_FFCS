# Cyscom FFCS Portal

A Next.js + Firebase application for managing VIT Cyscom club FFCS (Fully Flexible Credit System) activities. This portal helps students select departments, join projects, submit contributions, and tracks points on a leaderboard.

## Features

- Google Authentication (restricted to @vitstudent.ac.in emails)
- Department selection with seat limits
- Project joining and reviews
- Contribution submission with admin verification
- Points system and leaderboard
- Admin panel for verification and management
- Superadmin controls for system configuration

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Deployment**: Vercel/Firebase Hosting

## Setup Instructions

### Prerequisites

- Node.js (v14+ recommended)
- npm or yarn
- Firebase account and project

### Installation

1. Clone the repository

```bash
git clone https://github.com/your-username/cyscom-ffcs.git
cd cyscom-ffcs
```

2. Install dependencies

```bash
npm install
```

3. Configure Firebase

- Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/)
- Enable Authentication with Google provider
- Enable Firestore Database
- Enable Storage
- Add a web app to your project and get the configuration
- Add the configuration to `.env.local` file (use `.env.example` as a template)

4. Run the development server

```bash
npm run dev
```

5. Deploy Firebase rules and indexes

```bash
npm install -g firebase-tools
firebase login
npm run firebase:rules
```

### Deployment

#### Option 1: Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

#### Option 2: Deploy to Firebase Hosting

1. Build the Next.js app

```bash
npm run build
npm run export
```

2. Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

## Firebase Configuration

### Authentication

- Setup Google Authentication provider
- Restrict to domain: `vitstudent.ac.in`

### Firestore

- Database structure is defined in the security rules
- Indexes are provided in `firestore.indexes.json`

### Storage

- Used for contribution image uploads
- CORS configuration included in `firebase.json`

## Project Structure

- `/pages`: Next.js pages (including API routes)
- `/lib`: Utility functions including Firebase helpers
- `/styles`: Global CSS and Tailwind configuration
- `/types`: TypeScript type definitions
- `/scripts`: Helper scripts, including seeding data

## Development Workflow

1. Students sign in with Google (@vitstudent.ac.in account)
2. Select exactly two departments (with seat limits)
3. Join a project (max 4 members per project)
4. Submit contributions with images
5. Admins verify contributions and award points
6. Leaderboard tracks top contributors

## License

MIT