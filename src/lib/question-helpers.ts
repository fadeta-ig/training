import type { QuestionType } from '@/lib/validations/questionSchema';

interface QuestionInputData {
    question_type: QuestionType;
    options?: { text: string; image?: string | null }[];
    correct_option_index?: number;
    correct_option_indices?: number[];
    correct_answer?: string;
    matching_pairs?: { left: string; right: string }[];
}

interface QuestionDataResult {
    optionsJson: string | null;
    finalCorrectIndex: number | null;
    finalCorrectAnswer: string | null;
}

/**
 * Builds the derived fields (optionsJson, correctIndex, correctAnswer)
 * from a parsed question input. Eliminates the duplicated switch statement
 * in questions/route.ts POST and questions/[id]/route.ts PUT.
 */
export function buildQuestionData(data: QuestionInputData): QuestionDataResult {
    let optionsJson: string | null = null;
    let finalCorrectIndex: number | null = null;
    let finalCorrectAnswer: string | null = null;

    switch (data.question_type) {
        case 'multiple_choice':
            optionsJson = JSON.stringify(data.options);
            finalCorrectIndex = data.correct_option_index ?? null;
            break;
        case 'multiple_select':
            optionsJson = JSON.stringify({
                options: data.options,
                correct_indices: data.correct_option_indices,
            });
            break;
        case 'true_false':
            optionsJson = JSON.stringify([
                { text: 'Benar', image: null },
                { text: 'Salah', image: null },
            ]);
            finalCorrectIndex = data.correct_option_index ?? null;
            break;
        case 'short_answer':
            finalCorrectAnswer = data.correct_answer ?? null;
            break;
        case 'essay':
            break;
        case 'matching':
            optionsJson = JSON.stringify({ pairs: data.matching_pairs });
            break;
    }

    return { optionsJson, finalCorrectIndex, finalCorrectAnswer };
}
