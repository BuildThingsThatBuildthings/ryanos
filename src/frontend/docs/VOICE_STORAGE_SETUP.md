# Voice Storage Setup Guide

This guide explains how to set up and use the Supabase Storage integration for voice recordings in the fitness tracker application.

## Overview

The voice system now uses Supabase Storage to:
- Store audio recordings securely with user-based access control
- Generate signed URLs for playback without exposing storage directly
- Track audio metadata and processing information
- Provide storage usage analytics

## Database Setup

### 1. Run Storage Configuration SQL

Execute the SQL script located at `/src/supabase/storage-setup.sql` in your Supabase SQL Editor. This will:

- Create the `voice-recordings` storage bucket
- Set up Row Level Security (RLS) policies
- Add audio file columns to `voice_sessions` table
- Create helper functions for signed URLs and cleanup
- Add analytics views and functions

### 2. Environment Variables

Ensure your environment variables are set:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Components

### VoiceLogger
Main component for managing voice recordings:

```jsx
import { VoiceLogger } from '../voice';

<VoiceLogger
  workoutId="optional-workout-id"
  onTranscriptUpdate={(transcript) => console.log(transcript)}
  showStorageInfo={true}
  maxRecordings={10}
/>
```

### VoicePlayback
Component for playing back recorded audio:

```jsx
import { VoicePlayback } from '../voice';

<VoicePlayback
  sessionId="session-id"
  audioFilePath="user-id/session-audio.webm"
  duration={30}
  onPlayStateChange={(isPlaying) => console.log(isPlaying)}
  showControls={true}
/>
```

### VoiceRecorder
Advanced recording component with settings:

```jsx
import { VoiceRecorder } from '../voice';

<VoiceRecorder
  workoutId="optional-workout-id"
  onRecordingComplete={(result) => console.log(result)}
  autoSave={true}
  processingOptions={{
    enableRealTimeTranscription: true,
    confidenceThreshold: 0.8,
    workoutContextEnabled: true
  }}
/>
```

## API Functions

### Upload Voice Recording
```typescript
import { uploadVoiceRecording } from '../voice';

const result = await uploadVoiceRecording(audioBlob, sessionId, userId);
if (result.success) {
  console.log('Uploaded to:', result.filePath);
}
```

### Get Playback URL
```typescript
import { getVoicePlaybackUrl } from '../voice';

const urlData = await getVoicePlaybackUrl(filePath, 3600); // 1 hour expiry
if (urlData) {
  console.log('Playback URL:', urlData.url);
}
```

### Storage Usage Analytics
```typescript
import { getVoiceStorageUsage } from '../voice';

const usage = await getVoiceStorageUsage(userId);
console.log('Total size:', usage.totalSizeMB, 'MB');
console.log('Recording count:', usage.recordingCount);
```

## Voice Processing

### Basic Processing
```typescript
import { VoiceProcessor } from '../voice';

const processor = new VoiceProcessor({
  enableRealTimeTranscription: false,
  confidenceThreshold: 0.7,
  workoutContextEnabled: true
});

const result = await processor.processAudio(audioBlob, sessionId, userId);
if (result.success) {
  console.log('Transcript:', result.transcript);
  console.log('Extracted data:', result.extractedData);
}
```

### Batch Processing
```typescript
const results = await processor.batchProcessAudio([
  { blob: audioBlob1, sessionId: 'session-1', userId: 'user-id' },
  { blob: audioBlob2, sessionId: 'session-2', userId: 'user-id' }
]);
```

## Storage Policies

The storage bucket uses Row Level Security (RLS) with the following policies:

1. **Upload Policy**: Users can only upload to their own folder (`user-id/`)
2. **Read Policy**: Users can only read their own recordings
3. **Update Policy**: Users can only update their own recordings
4. **Delete Policy**: Users can only delete their own recordings

## File Organization

Voice recordings are stored with the following structure:
```
voice-recordings/
  └── {user-id}/
      ├── {session-id}-{timestamp}.webm
      ├── {session-id}-{timestamp}.wav
      └── ...
```

## Cleanup and Retention

### Automatic Cleanup
- Recordings older than 90 days are automatically cleaned up
- Database references are updated when files are deleted
- This runs weekly via the `cleanup_old_voice_recordings()` function

### Manual Cleanup
```sql
SELECT cleanup_old_voice_recordings();
```

## Error Handling

The system includes comprehensive error handling:

1. **Upload Failures**: Graceful degradation when storage is unavailable
2. **Playback Errors**: Fallback messaging when audio cannot be played
3. **Processing Errors**: Session marked as error state with retry capability
4. **Network Issues**: Offline support with sync queuing

## Performance Considerations

### File Compression
- WebM/Opus format provides good compression (~64kbps)
- Audio duration tracked for bandwidth estimation
- Metadata analysis for optimization recommendations

### Caching
- Signed URLs cached client-side with expiration tracking
- Automatic cleanup of expired URLs
- Progressive loading for large recordings

### Storage Limits
- 50MB maximum file size per recording
- User storage analytics for quota management
- Compression recommendations based on usage patterns

## Security Features

### Access Control
- All storage operations require user authentication
- RLS policies prevent cross-user access
- Signed URLs expire after 1 hour by default

### Data Protection
- Audio files stored with content-type validation
- MIME type restrictions on upload
- Audit trail via database timestamps

## Troubleshooting

### Common Issues

1. **Upload Fails**
   - Check user authentication
   - Verify file size under 50MB
   - Confirm MIME type is supported

2. **Playback Not Working**
   - Check if signed URL expired
   - Verify audio file exists in storage
   - Test browser audio support

3. **Processing Errors**
   - Check Edge Function logs
   - Verify database permissions
   - Test with smaller audio files

### Debug Commands

```typescript
// Check storage usage
const usage = await getVoiceStorageUsage(userId);
console.log('Usage:', usage);

// Get processing analytics
const processor = new VoiceProcessor();
const analytics = await processor.getProcessingAnalytics(sessionId);
console.log('Analytics:', analytics);

// Test audio metadata
const metadata = await analyzeAudioMetadata(audioBlob);
console.log('Metadata:', metadata);
```

## Migration Guide

If migrating from a previous voice system:

1. **Database Migration**: Run the storage setup SQL
2. **Component Updates**: Replace old voice components with new ones
3. **API Changes**: Update any direct database calls to use new utilities
4. **Storage Migration**: Existing recordings can be migrated using batch upload functions

## Support and Monitoring

### Analytics
- Processing time tracking
- Confidence score monitoring  
- Storage usage analytics
- Error rate tracking

### Maintenance
- Weekly cleanup runs automatically
- Storage usage alerts available
- Performance metrics in database
- Audit trail for troubleshooting