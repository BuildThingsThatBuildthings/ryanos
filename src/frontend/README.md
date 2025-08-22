# Fitness Tracker Frontend

A comprehensive mobile-first React application for fitness tracking with voice logging capabilities, built with modern web technologies.

## Features

### Core Functionality
- **Workout Management**: Create, track, and manage workouts with detailed set tracking
- **Voice Logging**: Record workout sets using voice commands with real-time transcription
- **Exercise Library**: Comprehensive database of exercises with filtering and search
- **Goal Setting**: Track fitness goals with progress visualization
- **Offline Support**: Full offline functionality with automatic sync when online

### Mobile-First Design
- **Progressive Web App (PWA)**: Install as native app on mobile devices
- **Touch Optimized**: Designed for mobile interaction with appropriate touch targets
- **Responsive Layout**: Optimized for mobile with desktop support
- **Bottom Navigation**: Easy thumb navigation on mobile devices
- **Swipe Gestures**: Natural mobile interactions

### Technical Features
- **Real-time Updates**: Live workout tracking with timer functionality
- **State Management**: Efficient state handling with Zustand
- **Offline Sync**: IndexedDB storage with background synchronization
- **Type Safety**: Full TypeScript implementation
- **Performance**: Optimized bundle splitting and lazy loading

## Tech Stack

### Core Technologies
- **React 19**: Latest React with concurrent features
- **TypeScript**: Full type safety throughout the application
- **Vite**: Fast development and optimized builds
- **Tailwind CSS**: Utility-first styling with custom design system

### State & Data Management
- **Zustand**: Lightweight state management with persistence
- **Axios**: HTTP client with interceptors and offline handling
- **IndexedDB**: Client-side database for offline storage

### UI & UX
- **Lucide React**: Beautiful, consistent icons
- **Framer Motion**: Smooth animations and transitions
- **React Hot Toast**: User-friendly notifications
- **Headless UI**: Accessible, unstyled UI components

### Voice & Audio
- **Web Speech API**: Speech recognition for voice logging
- **MediaRecorder API**: Audio recording capabilities
- **Web Audio API**: Audio processing and analysis

### PWA & Performance
- **Service Worker**: Caching and background sync
- **Web App Manifest**: Native app-like installation
- **Bundle Optimization**: Code splitting and tree shaking

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3001`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript compiler

## Environment Variables

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api

# Feature Flags
VITE_ENABLE_VOICE=true
VITE_ENABLE_OFFLINE=true
VITE_ENABLE_PWA=true

# Development
VITE_ENV=development
VITE_DEBUG=true
```

## Architecture Overview

The application follows a modern React architecture with:

- **Component-based design**: Reusable UI components with props interface
- **Centralized state management**: Zustand stores for different domains
- **Type-safe development**: Comprehensive TypeScript coverage
- **API layer abstraction**: Centralized HTTP client with error handling
- **Offline-first approach**: IndexedDB storage with sync capabilities

## License

This project is part of a larger fitness tracking system.