const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate, sanitize } = require('../validators/validate');
const { voiceSessionSchema, voiceEventSchema } = require('../validators/schemas');
const { NotFoundError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

const router = express.Router();

// Create new voice session
router.post('/sessions',
  sanitize(),
  validate(voiceSessionSchema),
  asyncHandler(async (req, res) => {
    const { sessionType, metadata } = req.body;

    const sessionData = {
      id: uuidv4(),
      user_id: req.user.id,
      session_type: sessionType,
      status: 'active',
      started_at: db.fn.now(),
      metadata: metadata || {}
    };

    const [session] = await db('voice_sessions')
      .insert(sessionData)
      .returning([
        'id', 'user_id', 'session_type', 'status', 
        'started_at', 'metadata', 'created_at'
      ]);

    logger.info('Voice session created', {
      sessionId: session.id,
      userId: req.user.id,
      sessionType: session.session_type,
      requestId: req.requestId
    });

    res.status(201).json({
      message: 'Voice session created successfully',
      session: {
        voiceSessionId: session.id,
        userId: session.user_id,
        sessionType: session.session_type,
        status: session.status,
        startedAt: session.started_at,
        metadata: session.metadata,
        createdAt: session.created_at
      }
    });
  })
);

// Get voice session by ID
router.get('/sessions/:id',
  asyncHandler(async (req, res) => {
    const sessionId = req.params.id;

    const session = await db('voice_sessions')
      .select([
        'id', 'user_id', 'session_type', 'status', 
        'started_at', 'ended_at', 'duration_seconds',
        'metadata', 'created_at', 'updated_at'
      ])
      .where('id', sessionId)
      .where('user_id', req.user.id)
      .first();

    if (!session) {
      throw new NotFoundError('Voice session not found');
    }

    // Get session events
    const events = await db('voice_events')
      .select([
        'id', 'intent', 'payload', 'transcript', 
        'confidence_score', 'timestamp', 'created_at'
      ])
      .where('session_id', sessionId)
      .orderBy('timestamp', 'asc');

    res.json({
      session: {
        voiceSessionId: session.id,
        userId: session.user_id,
        sessionType: session.session_type,
        status: session.status,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        durationSeconds: session.duration_seconds,
        metadata: session.metadata,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      },
      events: events.map(event => ({
        id: event.id,
        intent: event.intent,
        payload: event.payload,
        transcript: event.transcript,
        confidenceScore: event.confidence_score,
        timestamp: event.timestamp,
        createdAt: event.created_at
      }))
    });
  })
);

// Get user's voice sessions
router.get('/sessions',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, sessionType } = req.query;
    const offset = (page - 1) * limit;

    let query = db('voice_sessions')
      .select([
        'id', 'session_type', 'status', 'started_at', 
        'ended_at', 'duration_seconds', 'created_at'
      ])
      .where('user_id', req.user.id)
      .orderBy('started_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (status) {
      query = query.where('status', status);
    }

    if (sessionType) {
      query = query.where('session_type', sessionType);
    }

    const sessions = await query;

    // Get total count
    let countQuery = db('voice_sessions')
      .where('user_id', req.user.id)
      .count('* as count');

    if (status) {
      countQuery = countQuery.where('status', status);
    }

    if (sessionType) {
      countQuery = countQuery.where('session_type', sessionType);
    }

    const [{ count }] = await countQuery;

    res.json({
      sessions: sessions.map(session => ({
        voiceSessionId: session.id,
        sessionType: session.session_type,
        status: session.status,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        durationSeconds: session.duration_seconds,
        createdAt: session.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        totalPages: Math.ceil(count / limit)
      }
    });
  })
);

// End voice session
router.patch('/sessions/:id/end',
  asyncHandler(async (req, res) => {
    const sessionId = req.params.id;

    // Get session
    const session = await db('voice_sessions')
      .select(['id', 'started_at', 'status'])
      .where('id', sessionId)
      .where('user_id', req.user.id)
      .first();

    if (!session) {
      throw new NotFoundError('Voice session not found');
    }

    if (session.status !== 'active') {
      throw new ValidationError('Session is not active');
    }

    // Calculate duration
    const endedAt = new Date();
    const startedAt = new Date(session.started_at);
    const durationSeconds = Math.floor((endedAt - startedAt) / 1000);

    const [updatedSession] = await db('voice_sessions')
      .where('id', sessionId)
      .update({
        status: 'completed',
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        updated_at: db.fn.now()
      })
      .returning([
        'id', 'status', 'started_at', 'ended_at', 
        'duration_seconds', 'updated_at'
      ]);

    logger.info('Voice session ended', {
      sessionId: session.id,
      userId: req.user.id,
      durationSeconds,
      requestId: req.requestId
    });

    res.json({
      message: 'Voice session ended successfully',
      session: {
        voiceSessionId: updatedSession.id,
        status: updatedSession.status,
        startedAt: updatedSession.started_at,
        endedAt: updatedSession.ended_at,
        durationSeconds: updatedSession.duration_seconds,
        updatedAt: updatedSession.updated_at
      }
    });
  })
);

// Create voice event
router.post('/events',
  sanitize(),
  validate(voiceEventSchema),
  asyncHandler(async (req, res) => {
    const { sessionId, intent, payload, transcript, confidenceScore, timestamp } = req.body;

    // Verify session exists and belongs to user
    const session = await db('voice_sessions')
      .select(['id', 'status'])
      .where('id', sessionId)
      .where('user_id', req.user.id)
      .first();

    if (!session) {
      throw new NotFoundError('Voice session not found');
    }

    if (session.status !== 'active') {
      throw new ValidationError('Cannot add events to inactive session');
    }

    const eventData = {
      id: uuidv4(),
      session_id: sessionId,
      intent,
      payload,
      transcript,
      confidence_score: confidenceScore,
      timestamp: timestamp || db.fn.now()
    };

    const [event] = await db('voice_events')
      .insert(eventData)
      .returning([
        'id', 'session_id', 'intent', 'payload', 'transcript',
        'confidence_score', 'timestamp', 'created_at'
      ]);

    logger.info('Voice event created', {
      eventId: event.id,
      sessionId: event.session_id,
      userId: req.user.id,
      intent: event.intent,
      requestId: req.requestId
    });

    res.status(201).json({
      message: 'Voice event created successfully',
      event: {
        id: event.id,
        sessionId: event.session_id,
        intent: event.intent,
        payload: event.payload,
        transcript: event.transcript,
        confidenceScore: event.confidence_score,
        timestamp: event.timestamp,
        createdAt: event.created_at
      }
    });
  })
);

// Get events for a session
router.get('/sessions/:id/events',
  asyncHandler(async (req, res) => {
    const sessionId = req.params.id;
    const { page = 1, limit = 50, intent } = req.query;
    const offset = (page - 1) * limit;

    // Verify session belongs to user
    const session = await db('voice_sessions')
      .select(['id'])
      .where('id', sessionId)
      .where('user_id', req.user.id)
      .first();

    if (!session) {
      throw new NotFoundError('Voice session not found');
    }

    let query = db('voice_events')
      .select([
        'id', 'intent', 'payload', 'transcript', 
        'confidence_score', 'timestamp', 'created_at'
      ])
      .where('session_id', sessionId)
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .offset(offset);

    if (intent) {
      query = query.where('intent', intent);
    }

    const events = await query;

    // Get total count
    let countQuery = db('voice_events')
      .where('session_id', sessionId)
      .count('* as count');

    if (intent) {
      countQuery = countQuery.where('intent', intent);
    }

    const [{ count }] = await countQuery;

    res.json({
      events: events.map(event => ({
        id: event.id,
        intent: event.intent,
        payload: event.payload,
        transcript: event.transcript,
        confidenceScore: event.confidence_score,
        timestamp: event.timestamp,
        createdAt: event.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        totalPages: Math.ceil(count / limit)
      }
    });
  })
);

module.exports = router;