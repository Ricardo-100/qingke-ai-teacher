export type BoardBlock = { type: 'heading' | 'text' | 'formula' | 'table' | 'flow'; text?: string; title?: string; headers?: string[]; rows?: string[][]; nodes?: string[] };
export type ClassBeat = { speech: string; blocks: BoardBlock[] };
export type Turn = { id: string; role: 'user' | 'assistant'; text: string };
export type Track = { id: string; beats: ClassBeat[]; cursor: number; done: boolean; failed?: boolean };
export type BoardEntry = { id: string; blocks: BoardBlock[]; answer: boolean };
