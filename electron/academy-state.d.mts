import type { AcademyState } from '../src/types';

/** Maximum raw file size. The decoded application state has a smaller limit. */
export const MAX_BACKUP_BYTES: number;
export function parseBackup(text: string): AcademyState;
export function serializeBackup(input: AcademyState): string;
export function safeFilePath(value: string): string;
export function validateUrl(value: string): string;
