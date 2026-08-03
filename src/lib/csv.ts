export type CsvObjectRow = Record<string, string>;

export function parseCsvRows(input: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        const nextChar = input[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentValue += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            currentRow.push(currentValue);
            currentValue = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentRow.push(currentValue);
            rows.push(currentRow);
            currentRow = [];
            currentValue = '';
            continue;
        }

        currentValue += char;
    }

    currentRow.push(currentValue);
    rows.push(currentRow);

    return rows.filter((row) => row.some((value) => value.trim() !== ''));
}

export function parseCsvToObjects(input: string): CsvObjectRow[] {
    const rows = parseCsvRows(input);
    if (rows.length === 0) return [];

    const headers = rows[0].map((header, index) => {
        const cleanHeader = header.replace(/^\uFEFF/, '').trim();
        return cleanHeader || `kolom_${index + 1}`;
    });

    return rows.slice(1).map((row) => {
        const item: CsvObjectRow = {};
        headers.forEach((header, index) => {
            item[header] = (row[index] || '').trim();
        });
        return item;
    });
}

export function objectsToCsv(rows: Array<Record<string, unknown>>, headers?: string[]): string {
    const keys = headers && headers.length > 0
        ? headers
        : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

    const escapeValue = (value: unknown): string => {
        const rawText = value === null || value === undefined ? '' : String(value);
        const text = /^[=+\-@\t\r]/.test(rawText) ? `'${rawText}` : rawText;
        if (/[",\r\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    };

    return [
        keys.map(escapeValue).join(','),
        ...rows.map((row) => keys.map((key) => escapeValue(row[key])).join(',')),
    ].join('\r\n');
}
