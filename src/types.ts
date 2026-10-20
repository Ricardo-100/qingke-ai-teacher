export type Target = { id: string; text: string; x: number; y: number; w: number; h: number; charEdges?: number[] };
export type Action = { type: 'circle' | 'underline' | 'highlight' | 'arrow' | 'note'; x: number; y: number; w: number; h: number; text?: string; targetId?: string; quote?: string };
export type Beat = { speech: string; actions: Action[]; board: string };
export type Quiz = { question: string; options: string[]; answer: number; explanation: string };
export type Lesson = { beats: Beat[]; quiz?: Quiz; source?: 'ai' | 'demo'; model?: string };
export type Slide = { title: string; subtitle: string; text: string; image: string; width: number; height: number; targets: Target[]; demoLesson?: Lesson };
export type Message = { role: 'user' | 'assistant'; text: string };
