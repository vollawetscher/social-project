export const AUDIO_VALIDATION = {
  MIN_DURATION_SECONDS: 1,
  MAX_DURATION_SECONDS: 7200,
  MIN_FILE_SIZE_BYTES: 1024,
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024,
}

export const VALIDATION_MESSAGES = {
  DURATION_TOO_SHORT: 'Die Audiodatei ist zu kurz. Mindestens 1 Sekunde erforderlich.',
  DURATION_TOO_LONG: 'Die Audiodatei ist zu lang. Maximum 2 Stunden.',
  FILE_TOO_SMALL: 'Die Datei scheint leer oder beschädigt zu sein.',
  INVALID_AUDIO: 'Die Audiodatei konnte nicht geladen werden. Bitte überprüfen Sie das Format.',
}
