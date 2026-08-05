export type ExamQuestionType =
    | 'multiple_choice'
    | 'multiple_select'
    | 'true_false'
    | 'short_answer'
    | 'essay'
    | 'matching';

export interface ExamOption {
    text: string;
    image: string | null;
}

export interface MatchingPair {
    left: string;
    right: string;
}

export interface GradableQuestion {
    question_type: ExamQuestionType;
    options_json: unknown;
    correct_option_index: number | null;
    correct_answer: string | null;
}

export interface ParticipantQuestionShape {
    question_type: ExamQuestionType;
    options_json: unknown;
}

export function parseOptionsJson(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    if (!value.trim()) return null;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function normalizeOptions(value: unknown): ExamOption[] {
    if (!Array.isArray(value)) return [];

    return value.map((option) => {
        if (typeof option === 'string') {
            return { text: option, image: null };
        }

        if (option && typeof option === 'object') {
            const candidate = option as { text?: unknown; image?: unknown };
            return {
                text: typeof candidate.text === 'string' ? candidate.text : '',
                image: typeof candidate.image === 'string' && candidate.image ? candidate.image : null,
            };
        }

        return { text: '', image: null };
    });
}

export function parseStrictIndex(value: string, optionCount: number): number | null {
    if (!/^\d+$/.test(value)) return null;
    const index = Number(value);
    return Number.isSafeInteger(index) && index >= 0 && index < optionCount ? index : null;
}

export function parseIndexSet(value: string, optionCount: number): number[] | null {
    if (!value.trim()) return [];

    const chunks = value.split(',');
    const indices = chunks.map((chunk) => parseStrictIndex(chunk.trim(), optionCount));
    if (indices.some((index) => index === null)) return null;

    const normalized = indices as number[];
    if (new Set(normalized).size !== normalized.length) return null;
    return normalized.sort((a, b) => a - b);
}

export function serializeIndexSet(indices: number[]): string {
    return [...new Set(indices)].sort((a, b) => a - b).join(',');
}

export function parseMatchingAnswer(value: string): MatchingPair[] | null {
    if (!value.trim()) return [];

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return null;

        const pairs: MatchingPair[] = [];
        for (const pair of parsed) {
            if (!pair || typeof pair !== 'object') return null;
            const candidate = pair as { left?: unknown; right?: unknown };
            if (typeof candidate.left !== 'string' || typeof candidate.right !== 'string') return null;
            pairs.push({ left: candidate.left, right: candidate.right });
        }
        return pairs;
    } catch {
        return null;
    }
}

function getParticipantOptions(question: ParticipantQuestionShape): ExamOption[] {
    const parsed = parseOptionsJson(question.options_json);
    if (question.question_type === 'multiple_select' && parsed && typeof parsed === 'object') {
        return normalizeOptions((parsed as { options?: unknown }).options);
    }
    return normalizeOptions(parsed);
}

export function toParticipantQuestionShape(question: ParticipantQuestionShape): ParticipantQuestionShape {
    const parsed = parseOptionsJson(question.options_json);

    if (question.question_type === 'multiple_select') {
        const options = parsed && typeof parsed === 'object'
            ? normalizeOptions((parsed as { options?: unknown }).options)
            : [];
        return { question_type: question.question_type, options_json: { options } };
    }

    if (question.question_type === 'matching') {
        const rawPairs = parsed && typeof parsed === 'object' && Array.isArray((parsed as { pairs?: unknown }).pairs)
            ? (parsed as { pairs: unknown[] }).pairs
            : [];
        const pairs = rawPairs.filter((pair): pair is MatchingPair => {
            if (!pair || typeof pair !== 'object') return false;
            const candidate = pair as { left?: unknown; right?: unknown };
            return typeof candidate.left === 'string' && typeof candidate.right === 'string';
        });

        return {
            question_type: question.question_type,
            options_json: {
                lefts: pairs.map((pair) => pair.left),
                rights: pairs.map((pair) => pair.right),
            },
        };
    }

    return {
        question_type: question.question_type,
        options_json: question.question_type === 'short_answer' || question.question_type === 'essay'
            ? null
            : normalizeOptions(parsed),
    };
}

export function validateParticipantAnswer(
    question: ParticipantQuestionShape,
    selectedOption: string,
): string | null {
    const parsed = parseOptionsJson(question.options_json);

    switch (question.question_type) {
        case 'multiple_choice':
        case 'true_false': {
            if (!selectedOption) return null;
            const options = getParticipantOptions(question);
            return parseStrictIndex(selectedOption, options.length) === null
                ? 'Pilihan jawaban tidak valid'
                : null;
        }
        case 'multiple_select': {
            const options = getParticipantOptions(question);
            return parseIndexSet(selectedOption, options.length) === null
                ? 'Pilihan multi-jawaban tidak valid'
                : null;
        }
        case 'matching': {
            const shape = parsed && typeof parsed === 'object'
                ? parsed as { lefts?: unknown; rights?: unknown }
                : null;
            const lefts = Array.isArray(shape?.lefts) ? shape.lefts.filter((item): item is string => typeof item === 'string') : [];
            const rights = Array.isArray(shape?.rights) ? shape.rights.filter((item): item is string => typeof item === 'string') : [];
            const pairs = parseMatchingAnswer(selectedOption);
            if (pairs === null || pairs.length > lefts.length) return 'Jawaban pencocokan tidak valid';

            const usedLefts = new Set<string>();
            const usedRights = new Set<string>();
            for (const pair of pairs) {
                if (!lefts.includes(pair.left) || !rights.includes(pair.right)) return 'Pasangan jawaban tidak tersedia';
                if (usedLefts.has(pair.left) || usedRights.has(pair.right)) return 'Pasangan jawaban tidak boleh duplikat';
                usedLefts.add(pair.left);
                usedRights.add(pair.right);
            }
            return null;
        }
        case 'short_answer':
        case 'essay':
            return null;
        default:
            return 'Tipe soal tidak didukung';
    }
}

export function isAnswerComplete(question: ParticipantQuestionShape, selectedOption: string): boolean {
    if (validateParticipantAnswer(question, selectedOption) !== null) return false;

    const parsed = parseOptionsJson(question.options_json);
    switch (question.question_type) {
        case 'multiple_choice':
        case 'true_false':
            return selectedOption !== '';
        case 'multiple_select':
            return (parseIndexSet(selectedOption, getParticipantOptions(question).length) || []).length > 0;
        case 'matching': {
            const lefts = parsed && typeof parsed === 'object' && Array.isArray((parsed as { lefts?: unknown }).lefts)
                ? (parsed as { lefts: unknown[] }).lefts
                : [];
            const pairs = parseMatchingAnswer(selectedOption) || [];
            return lefts.length > 0 && pairs.length === lefts.length && pairs.every((pair) => pair.right.trim().length > 0);
        }
        case 'short_answer':
        case 'essay':
            return selectedOption.trim().length > 0;
        default:
            return false;
    }
}

export function gradeQuestionAnswer(question: GradableQuestion, selectedOption: string): boolean {
    const parsed = parseOptionsJson(question.options_json);

    switch (question.question_type) {
        case 'multiple_choice':
        case 'true_false': {
            const options = normalizeOptions(parsed);
            const selectedIndex = parseStrictIndex(selectedOption, options.length);
            return selectedIndex !== null && selectedIndex === Number(question.correct_option_index);
        }
        case 'multiple_select': {
            if (!parsed || typeof parsed !== 'object') return false;
            const shape = parsed as { options?: unknown; correct_indices?: unknown };
            const options = normalizeOptions(shape.options);
            const selected = parseIndexSet(selectedOption, options.length);
            const correct = Array.isArray(shape.correct_indices)
                ? shape.correct_indices.filter((index): index is number => Number.isInteger(index)).sort((a, b) => a - b)
                : [];
            return selected !== null
                && selected.length > 0
                && selected.length === correct.length
                && selected.every((index, position) => index === correct[position]);
        }
        case 'short_answer':
            return !!question.correct_answer
                && selectedOption.trim().normalize('NFC').toLocaleLowerCase('id-ID')
                    === question.correct_answer.trim().normalize('NFC').toLocaleLowerCase('id-ID');
        case 'essay':
            return false;
        case 'matching': {
            if (!parsed || typeof parsed !== 'object') return false;
            const rawExpected = Array.isArray((parsed as { pairs?: unknown }).pairs)
                ? (parsed as { pairs: unknown[] }).pairs
                : [];
            const expected = rawExpected.filter((pair): pair is MatchingPair => {
                if (!pair || typeof pair !== 'object') return false;
                const candidate = pair as { left?: unknown; right?: unknown };
                return typeof candidate.left === 'string' && typeof candidate.right === 'string';
            });
            if (expected.length === 0 || expected.length !== rawExpected.length) return false;
            const submitted = parseMatchingAnswer(selectedOption);
            if (!submitted || submitted.length !== expected.length) return false;

            const submittedMap = new Map(submitted.map((pair) => [pair.left, pair.right]));
            return submittedMap.size === expected.length
                && expected.every((pair) => submittedMap.get(pair.left) === pair.right);
        }
        default:
            return false;
    }
}

export function createQuestionSnapshot(question: {
    id: string;
    exam_id: string;
    question_type: ExamQuestionType;
    question_text: string;
    question_image: string | null;
    options_json: unknown;
    correct_option_index: number | null;
    correct_answer: string | null;
    points: number;
}): string {
    return JSON.stringify({
        id: question.id,
        exam_id: question.exam_id,
        question_type: question.question_type,
        question_text: question.question_text,
        question_image: question.question_image,
        options_json: parseOptionsJson(question.options_json),
        correct_option_index: question.correct_option_index,
        correct_answer: question.correct_answer,
        points: Number(question.points) || 1,
    });
}
