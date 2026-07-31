/**
 * Session Status State Machine
 * Validates and manages session status transitions
 */

export type SessionStatus = 
  | 'created' 
  | 'uploading' 
  | 'transcribing' 
  | 'awaiting_speaker_review'
  | 'summarizing' 
  | 'done' 
  | 'error'

/**
 * Valid state transitions for session status
 * Each status can only transition to specific next states
 */
const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  created: ['uploading', 'transcribing', 'error'],
  uploading: ['created', 'transcribing', 'error'],
  transcribing: ['awaiting_speaker_review', 'done', 'summarizing', 'error'],
  awaiting_speaker_review: ['done', 'summarizing', 'error'], // User confirms speakers → analysis
  summarizing: ['done', 'error'],
  done: ['transcribing', 'summarizing', 'awaiting_speaker_review'], // Allow regeneration
  error: ['created', 'uploading', 'transcribing', 'summarizing'], // Allow recovery from error
}

/**
 * Validate if a status transition is allowed
 * @param from Current status
 * @param to Desired next status
 * @returns true if transition is valid
 */
export function isValidTransition(from: SessionStatus, to: SessionStatus): boolean {
  const allowedTransitions = VALID_TRANSITIONS[from]
  return allowedTransitions.includes(to)
}

/**
 * Get all valid next statuses from current status
 * @param current Current status
 * @returns Array of valid next statuses
 */
export function getValidNextStatuses(current: SessionStatus): SessionStatus[] {
  return VALID_TRANSITIONS[current] || []
}

/**
 * Validate status transition and throw error if invalid
 * @param from Current status
 * @param to Desired next status
 * @throws Error if transition is invalid
 */
export function validateTransition(from: SessionStatus, to: SessionStatus): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid status transition from '${from}' to '${to}'. ` +
      `Valid transitions from '${from}': ${getValidNextStatuses(from).join(', ')}`
    )
  }
}

/**
 * Safely transition session status with validation
 * @param currentStatus Current session status
 * @param newStatus Desired new status
 * @returns The new status if valid
 * @throws Error if transition is invalid
 */
export function transitionStatus(
  currentStatus: SessionStatus,
  newStatus: SessionStatus
): SessionStatus {
  validateTransition(currentStatus, newStatus)
  return newStatus
}

/**
 * Check if a status represents a processing state
 * @param status Session status to check
 * @returns true if status is a processing state
 */
export function isProcessingStatus(status: SessionStatus): boolean {
  return ['uploading', 'transcribing', 'summarizing'].includes(status)
}

/**
 * Check if a status represents a final state
 * @param status Session status to check
 * @returns true if status is a final state
 */
export function isFinalStatus(status: SessionStatus): boolean {
  return ['done', 'error'].includes(status)
}

/**
 * Check if a session can accept file uploads
 * @param status Current session status
 * @returns true if files can be uploaded
 */
export function canUploadFiles(status: SessionStatus): boolean {
  return status === 'created' || status === 'error'
}

/**
 * Check if transcription can be triggered
 * @param status Current session status
 * @returns true if transcription can be started
 */
export function canTranscribe(status: SessionStatus): boolean {
  return ['created', 'done', 'error'].includes(status)
}

/**
 * Check if report generation can be triggered
 * @param status Current session status
 * @returns true if report can be generated
 */
export function canGenerateReport(status: SessionStatus): boolean {
  return status === 'done' || (status === 'error' && false) // Don't allow report gen from error
}
