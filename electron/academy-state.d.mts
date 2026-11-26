import type { AcademyState } from '../src/types';

/** Maximum raw file size. The decoded application state has a smaller limit. */
export const MAX_BACKUP_BYTES: number;
export const MAX_PROJECTS: number;
export const MAX_DISPATCH_DRAFT_LENGTH: number;
export function safeName(value: string): string;
export function isReservedResourceName(value: unknown): boolean;
export class ReservedResourceNameError extends Error {}
export function validateState(input: unknown): AcademyState;
export function parseBackup(text: string): AcademyState;
export function serializeBackup(input: AcademyState): string;
export function safeFilePath(value: string): string;
export function validateProjectFiles(files: Record<string, string>): Record<string, string>;
export function validateUrl(value: string): string;
